import { useState } from 'react';
import { C } from '../../../styles.jsx';

export default function CollectionCard({ collection, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        cursor: 'pointer',
        background: C.white,
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        transition: 'box-shadow 0.15s',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px 0 0',
      }}
    >
      {collection.thumbnail_url ? (
        <img
          src={collection.thumbnail_url}
          alt={collection.filter_value}
          style={{
            width: 48,
            height: 48,
            flexShrink: 0,
            objectFit: 'cover',
            padding: 10,
          }}
        />
      ) : (
        <div style={{
          width: 48,
          height: 48,
          flexShrink: 0,
          background: '#f5f5f5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#cccccc',
          fontSize: 16,
        }}>
          ✕
        </div>
      )}
      {/* Label */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {hovered && (
          <div style={{ fontSize: 12, fontWeight: 500, color: '#888888', letterSpacing: '0.04em' }}>
            Filter by
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            fontSize: 16,
            fontWeight: 500,
            color: C.black,
            lineHeight: 1.3,
          }}>
            {collection.filter_value}
          </div>
          {hovered && <span style={{ fontSize: 12, color: '#888888' }}>❯</span>}
        </div>
      </div>
    </div>
  );
}