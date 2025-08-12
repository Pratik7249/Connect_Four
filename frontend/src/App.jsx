import React, { useState, useEffect, useRef } from 'react';
import Leaderboard from './components/Leaderboard.jsx';
import Board from './components/Board.jsx';

const WS_URL = import.meta.env.VITE_WS_URL ||
  (import.meta.env.MODE === 'development' ? 'ws://localhost:4000/ws' : 'wss://connect-backend-production-8fb3.up.railway.app/');




export default function App() {
  const [username, setUsername] = useState('');
  const [joined, setJoined] = useState(false);
  const [ws, setWs] = useState(null);

  const [gameId, setGameId] = useState(null);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [opponent, setOpponent] = useState('');
  const [board, setBoard] = useState(Array(6).fill(null).map(() => Array(7).fill(0)));
  const [turn, setTurn] = useState(1);
  const [status, setStatus] = useState('waiting'); // waiting, playing, ended
  const [message, setMessage] = useState('');
  const [lastMove, setLastMove] = useState(null);
  const [winner, setWinner] = useState(null);

  const [leaderboard, setLeaderboard] = useState([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const wsRef = useRef(null);

  useEffect(() => {
    if (!joined) return;

    const socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      console.log('WebSocket connected');
      socket.send(JSON.stringify({ type: 'join', username }));
      setMessage('Joined, waiting for game to start...');
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'start':
          setGameId(data.gameId);
          setPlayerNumber(data.playerNumber);
          setOpponent(data.opponent);
          setBoard(data.board);
          setTurn(data.turn);
          setStatus('playing');
          setWinner(null);
          setMessage(`Game started! You are Player ${data.playerNumber}. Your opponent: ${data.opponent}`);
          setLastMove(null);
          break;

        case 'rejoin':
          setGameId(data.gameId);
          setPlayerNumber(data.playerNumber);
          setOpponent(data.opponent);
          setBoard(data.board);
          setTurn(data.turn);
          setStatus(data.status || 'playing');
          setWinner(null);
          setMessage(`Rejoined game as Player ${data.playerNumber}. Opponent: ${data.opponent}`);
          setLastMove(null);
          break;

        case 'update':
          setBoard(data.board);
          setTurn(data.turn);
          setLastMove(data.lastMove);
          setMessage(data.turn === playerNumber ? "Your turn" : "Opponent's turn");
          break;

        case 'end':
          setStatus('ended');
          setWinner(data.winner);
          setMessage(data.winner === 'draw' ? 'Game ended in a draw!' : `Game over! Winner: ${data.winner}`);
          break;

        case 'leaderboard':
          setLeaderboard(data.leaderboard);
          break;

        case 'error':
          setMessage(`Error: ${data.message}`);
          break;

        case 'info':
          setMessage(data.message);
          break;

        default:
          break;
      }
    };

    socket.onclose = () => {
      console.log('WebSocket closed');
      resetGameState();
      setMessage('Disconnected from server');
    };

    socket.onerror = (e) => {
      console.error('WebSocket error', e);
      setMessage('WebSocket error occurred.');
    };

    wsRef.current = socket;
    setWs(socket);

    return () => {
      socket.close();
    };
  }, [joined, username]);

  const resetGameState = () => {
    setStatus('waiting');
    setGameId(null);
    setPlayerNumber(null);
    setOpponent('');
    setBoard(Array(6).fill(null).map(() => Array(7).fill(0)));
    setTurn(1);
    setWinner(null);
    setLastMove(null);
    setWs(null);
    setJoined(false);
    setMessage('');
  };

  const handleJoin = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    setJoined(true);
  };

  const handleColumnClick = (col) => {
    if (!ws || status !== 'playing') return;
    if (turn !== playerNumber) {
      setMessage("It's not your turn");
      return;
    }
    ws.send(JSON.stringify({ type: 'move', gameId, col }));
  };

  const handleForfeit = () => {
    if (!ws || !gameId) return;
    ws.send(JSON.stringify({ type: 'forfeit', gameId }));
  };

  const handleDisconnect = () => {
    if (ws) {
      ws.close();
    } else {
      resetGameState();
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '20px auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Connect Four</h1>

      {!joined ? (
        <>
          <div>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{ padding: 8, fontSize: 16 }}
            />
            <button onClick={handleJoin} style={{ padding: '8px 16px', marginLeft: 8, fontSize: 16 }}>
              Join Game
            </button>
            <button
              onClick={() => setShowLeaderboard(!showLeaderboard)}
              style={{ padding: '8px 16px', marginLeft: 8, fontSize: 16 }}
            >
              {showLeaderboard ? 'Hide Leaderboard' : 'See Leaderboard'}
            </button>
          </div>

          {showLeaderboard && (
            <>
              <hr style={{ margin: '20px 0' }} />
              <Leaderboard leaderboard={leaderboard} />
            </>
          )}
        </>
      ) : (
        <>
          <p><b>{message}</b></p>
          <p>You are Player {playerNumber} ({playerNumber === 1 ? 'Red' : 'Yellow'}), Opponent: {opponent}</p>

          <Board
            board={board}
            lastMove={lastMove}
            turn={turn}
            playerNumber={playerNumber}
            status={status}
            onColumnClick={handleColumnClick}
          />

          {status === 'playing' && (
            <>
              <button
                onClick={handleForfeit}
                style={{ marginTop: 20, padding: '8px 16px', fontSize: 16, backgroundColor: '#cc3300', color: 'white', border: 'none', borderRadius: 5, marginRight: 10 }}
              >
                Forfeit
              </button>
              <button
                onClick={handleDisconnect}
                style={{ marginTop: 20, padding: '8px 16px', fontSize: 16, backgroundColor: '#444', color: 'white', border: 'none', borderRadius: 5 }}
              >
                Disconnect
              </button>
            </>
          )}

          {status === 'ended' && (
            <button
              onClick={() => {
                setJoined(false);
                ws?.close();
              }}
              style={{ marginTop: 20, padding: '8px 16px', fontSize: 16 }}
            >
              Play Again
            </button>
          )}

          <hr style={{ margin: '40px 0' }} />

          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            style={{ marginBottom: 10, padding: '6px 12px', fontSize: 14 }}
          >
            {showLeaderboard ? 'Hide Leaderboard' : 'See Leaderboard'}
          </button>

          {showLeaderboard && <Leaderboard leaderboard={leaderboard} />}
        </>
      )}
    </div>
  );
}
