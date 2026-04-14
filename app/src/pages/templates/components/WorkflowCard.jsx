import { useState } from 'react';
import { C } from '../../../styles.jsx';

export default function WorkflowCard({ name, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 16,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        background: C.white,
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        transition: 'box-shadow 0.15s',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 12 }}>▶️</div>
      <div style={{
        fontSize: 16,
        fontWeight: 600,
        color: C.black,
        lineHeight: 1.4,
      }}>
        {name}
      </div>
    </div>
  );
}