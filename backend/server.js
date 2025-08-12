const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const WebSocket = require('ws');
const { Pool } = require('pg');
require('dotenv').config();
const http = require('http');

const {
  emptyBoard, drop, isBoardFull, checkWinner, botChooseColumn
} = require('./game_logic');

const PORT = process.env.PORT || 4000;
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---- PostgreSQL Connection ----
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

// ---- DB Functions ----
async function saveCompletedGame(game) {
  await pool.query(
    `INSERT INTO games (player1, player2, winner)
     VALUES ($1, $2, $3)`,
    [game.players[0], game.players[1], game.winner]
  );
}

const disconnectedPlayers = new Map(); // key: username, value: { gameId, playerNum, timer }

async function getLeaderboard() {
  const result = await pool.query(`
    SELECT winner AS username, COUNT(*) AS wins
    FROM games
    WHERE winner IS NOT NULL AND winner <> 'draw'
    GROUP BY winner
    ORDER BY wins DESC
    LIMIT 10
  `);
  return result.rows;
}

// ---- REST Endpoints ----
app.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await getLeaderboard();
    res.json(leaderboard);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching leaderboard' });
  }
});

app.use(express.static('public'));
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// ---- WebSocket Setup ----


const server = http.createServer(app);

const wss = new WebSocket.Server({ server, path: '/ws' });


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


const games = new Map();
const waiting = [];

// Broadcast leaderboard to all connected clients
async function broadcastLeaderboard() {
  try {
    const leaderboard = await getLeaderboard();

    const msg = JSON.stringify({
      type: 'leaderboard',
      leaderboard,
    });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  } catch (err) {
    console.error('Error broadcasting leaderboard:', err);
  }
}

function startGame(p1, p2) {
  const gameId = uuidv4();
  const game = {
    id: gameId,
    board: emptyBoard(),
    players: {
      1: { username: p1.username, ws: p1.ws, isBot: false },
      2: p2
        ? { username: p2.username, ws: p2.ws, isBot: false }
        : { username: 'BOT', ws: null, isBot: true }
    },
    turn: 1,
    status: 'playing'
  };
  games.set(gameId, game);

  [p1, p2].forEach((p, idx) => {
    if (!p) return;
    try {
      p.ws.send(JSON.stringify({
        type: 'start',
        gameId,
        playerNumber: idx + 1,
        opponent: idx === 0 ? game.players[2].username : game.players[1].username,
        board: game.board,
        turn: game.turn
      }));
    } catch (e) { }
  });

  if (game.players[1].isBot) botMove(game);
}

function botMove(game) {
  const col = botChooseColumn(game.board);
  if (col === undefined || col === null) return;
  const pos = drop(game.board, col, 2);
  if (!pos) return;

  const winner = checkWinner(game.board);
  const draw = isBoardFull(game.board);
  game.turn = 1;

  broadcast(game, {
    type: 'update',
    board: game.board,
    turn: game.turn,
    lastMove: { player: 2, col, row: pos.row }
  });

  if (winner || draw) endGame(game, winner);
}

function broadcast(game, msg) {
  Object.values(game.players).forEach(p => {
    if (!p.isBot && p.ws && p.ws.readyState === WebSocket.OPEN) {
      try { p.ws.send(JSON.stringify(msg)); } catch (e) { }
    }
  });
}

async function endGame(game, winnerNum) {
  if (game.status === 'finished') return;
  game.status = 'finished';
  const winnerName = winnerNum
    ? game.players[winnerNum].username
    : 'draw';

  broadcast(game, { type: 'end', winner: winnerName });

  await saveCompletedGame({
    id: game.id,
    players: [game.players[1].username, game.players[2].username],
    winner: winnerName
  });

  await broadcastLeaderboard();
}

function forfeitGame(game, quitterNum) {
  if (game.status !== 'playing') return;
  const winnerNum = quitterNum === 1 ? 2 : 1;
  endGame(game, winnerNum);
}

wss.on('connection', ws => {
  // Send current leaderboard immediately on new connection
  (async () => {
    const leaderboard = await getLeaderboard();
    ws.send(JSON.stringify({ type: 'leaderboard', leaderboard }));
  })();

  ws.on('message', async data => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    // --- Handle player reconnecting ---
    if (msg.type === 'rejoin') {
      const info = disconnectedPlayers.get(msg.username);
      if (info) {
        const game = games.get(info.gameId);
        if (game && game.status === 'playing') {
          // Restore ws for player
          game.players[info.playerNum].ws = ws;

          // Clear the timeout to prevent forfeiting
          clearTimeout(info.timer);
          disconnectedPlayers.delete(msg.username);

          // Send current game state to rejoined player
          ws.send(JSON.stringify({
            type: 'start',
            gameId: game.id,
            playerNumber: info.playerNum,
            opponent: info.playerNum === 1 ? game.players[2].username : game.players[1].username,
            board: game.board,
            turn: game.turn,
            status: game.status,
          }));

          console.log(`Player ${msg.username} rejoined game ${game.id}`);

          return;
        }
      }
      // If no game found, send error
      ws.send(JSON.stringify({ type: 'error', message: 'No active game found for reconnection' }));
      return;
    }

    if (msg.type === 'join') {
      if (!msg.username) {
        ws.send(JSON.stringify({ type: 'error', message: 'username required' }));
        return;
      }
      const player = { username: msg.username, ws };
      if (waiting.length) {
        startGame(waiting.shift(), player);
      } else {
        waiting.push(player);
        setTimeout(() => {
          const idx = waiting.findIndex(p => p.ws === ws);
          if (idx !== -1) {
            waiting.splice(idx, 1);
            startGame(player, null);
          }
        }, 10000);
      }
    }

    if (msg.type === 'move') {
      const game = games.get(msg.gameId);
      if (!game || game.status !== 'playing') {
        ws.send(JSON.stringify({ type: 'error', message: 'game not found or not playing' }));
        return;
      }
      const currentPlayerObj = game.players[game.turn];
      if (!currentPlayerObj.ws || currentPlayerObj.ws !== ws) {
        ws.send(JSON.stringify({ type: 'error', message: 'not your turn' }));
        return;
      }

      const col = parseInt(msg.col);
      if (isNaN(col) || col < 0) {
        ws.send(JSON.stringify({ type: 'error', message: 'invalid column' }));
        return;
      }

      const pos = drop(game.board, col, game.turn);
      if (!pos) {
        ws.send(JSON.stringify({ type: 'error', message: 'column full or invalid' }));
        return;
      }

      const movedPlayer = game.turn;
      const winner = checkWinner(game.board);
      const draw = isBoardFull(game.board);
      game.turn = (game.turn === 1) ? 2 : 1;

      broadcast(game, {
        type: 'update',
        board: game.board,
        turn: game.turn,
        lastMove: { player: movedPlayer, col, row: pos.row }
      });

      if (winner || draw) {
        endGame(game, winner);
      } else if (game.players[game.turn].isBot) {
        setTimeout(() => botMove(game), 200);
      }
    }

    if (msg.type === 'forfeit') {
      const game = games.get(msg.gameId);
      if (game) {
        const quitterNum = Object.keys(game.players).find(
          num => game.players[num].ws === ws
        );
        if (quitterNum) forfeitGame(game, parseInt(quitterNum));
      }
    }
  });

  ws.on('close', () => {
    for (const [gameId, game] of games.entries()) {
      for (const [num, player] of Object.entries(game.players)) {
        if (player.ws === ws && game.status === 'playing') {
          // Mark player disconnected
          player.ws = null; // remove ws to indicate disconnected

          // Start 30 sec timer
          const timeout = setTimeout(() => {
            // Timer expired, player didn't reconnect
            forfeitGame(game, parseInt(num));
            disconnectedPlayers.delete(player.username);
          }, 30000); // 30,000 ms = 30 seconds

          disconnectedPlayers.set(player.username, { gameId, playerNum: parseInt(num), timer: timeout });

          console.log(`Player ${player.username} disconnected from game ${gameId}. Waiting 30s for reconnect.`);

          break;
        }
      }
    }
  });
});
