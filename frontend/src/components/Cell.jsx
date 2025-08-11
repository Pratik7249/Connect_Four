import React from 'react';

export default function Cell({ value }) {
  const color = value === 1 ? 'red' : value === 2 ? 'yellow' : 'white';
  return (
    <div
      style={{
        width: 50,
        height: 50,
        borderRadius: '50%',
        backgroundColor: color,
        border: '2px solid black',
        margin: 4,
        boxSizing: 'border-box',
      }}
    />
  );
}
