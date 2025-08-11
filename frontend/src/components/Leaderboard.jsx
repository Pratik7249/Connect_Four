import React from 'react';

export default function Leaderboard({ leaderboard }) {
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Leaderboard</h2>
      {leaderboard.length === 0 ? (
        <p style={styles.noData}>No scores yet.</p>
      ) : (
        <table style={styles.table} aria-label="Leaderboard Table">
          <thead>
            <tr>
              <th style={styles.th}>Player</th>
              <th style={styles.th}>Wins</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map(({ username, wins, losses }) => (
              <tr key={username} style={styles.row}>
                <td style={styles.td}>{username}</td>
                <td style={styles.td}>{wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 400,
    margin: '0 auto',
    fontSize: 14,
    color: '#333',
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#222',
  },
  noData: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#666',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    borderBottom: '2px solid #007bff',
    textAlign: 'left',
    padding: '8px 12px',
    color: '#007bff',
  },
  td: {
    borderBottom: '1px solid #ddd',
    padding: '8px 12px',
  },
  row: {
    backgroundColor: 'white',
  },
};
