import React from 'react';

const ROWS = 6;
const COLS = 7;

function Cell({ value, isLastMove }) {
  const colors = {
    0: '#ffffff',
    1: '#e63946', // red
    2: '#f1c40f', // yellow
  };

  const style = {
    width: 48,
    height: 48,
    borderRadius: '50%',
    backgroundColor: colors[value] || '#fff',
    boxShadow: isLastMove ? '0 0 8px 3px #4caf50' : 'inset 0 2px 4px rgba(0,0,0,0.15)',
    border: '1.5px solid #ccc',
    margin: 4,
    transition: 'box-shadow 0.3s',
  };

  return <div style={style} />;
}

export default function Board({ board, lastMove, turn, playerNumber, status, onColumnClick }) {
  return (
    <div>
      <div style={styles.controls}>
        {Array(COLS).fill(null).map((_, col) => (
          <button
            key={col}
            onClick={() => onColumnClick(col)}
            disabled={status !== 'playing' || turn !== playerNumber}
            style={{
              ...styles.dropButton,
              cursor: status === 'playing' && turn === playerNumber ? 'pointer' : 'not-allowed',
              backgroundColor: status === 'playing' && turn === playerNumber ? '#007bff' : '#bbb',
            }}
            aria-label={`Drop disc in column ${col + 1}`}
            title={`Drop disc in column ${col + 1}`}
          >
            ↓
          </button>
        ))}
      </div>

      <div style={styles.boardGrid}>
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isLast = lastMove?.row === rowIndex && lastMove?.col === colIndex;
            return <Cell key={`${rowIndex}-${colIndex}`} value={cell} isLastMove={isLast} />;
          })
        )}
      </div>
    </div>
  );
}

const styles = {
  controls: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dropButton: {
    margin: '0 3px',
    padding: '6px 10px',
    fontSize: 20,
    borderRadius: 5,
    border: 'none',
    color: 'white',
    userSelect: 'none',
  },
  boardGrid: {
    display: 'grid',
    gridTemplateColumns: `repeat(${COLS}, 56px)`,
    justifyContent: 'center',
    backgroundColor: '#1d3557',
    padding: 12,
    borderRadius: 8,
    boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
  },
};
