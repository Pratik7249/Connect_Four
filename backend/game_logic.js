const COLS = 7, ROWS = 6;

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function cloneBoard(board) {
  return board.map(row => [...row]);
}

function drop(board, col, player) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === 0) {
      board[r][col] = player;
      return { row: r, col };
    }
  }
  return null; // column full
}

function isBoardFull(board) {
  return board[0].every(cell => cell !== 0);
}

function checkWinner(board) {
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1]
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const player = board[r][c];
      if (!player) continue;
      for (const [dr, dc] of directions) {
        let count = 1;
        let nr = r + dr, nc = c + dc;
        while (
          nr >= 0 && nr < ROWS &&
          nc >= 0 && nc < COLS &&
          board[nr][nc] === player
        ) {
          count++;
          nr += dr;
          nc += dc;
        }
        if (count >= 4) return player;
      }
    }
  }
  return null;
}

// BOT AI: win > block > center-first
function botChooseColumn(board, botPlayer = 2, opponent = 1) {
  // Try winning move
  for (let c = 0; c < COLS; c++) {
    const copy = cloneBoard(board);
    if (drop(copy, c, botPlayer) && checkWinner(copy) === botPlayer) return c;
  }
  // Block opponent
  for (let c = 0; c < COLS; c++) {
    const copy = cloneBoard(board);
    if (drop(copy, c, opponent) && checkWinner(copy) === opponent) return c;
  }
  // Center preference
  const order = [3, 2, 4, 1, 5, 0, 6];
  return order.find(c => board[0][c] === 0);
}

module.exports = {
  COLS, ROWS,
  emptyBoard, drop, isBoardFull, checkWinner,
  botChooseColumn, cloneBoard
};
