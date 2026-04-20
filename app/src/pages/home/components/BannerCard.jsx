import { useState } from 'react';
import { C } from '../../../styles.jsx';

export default function BannerCard({ img_url, target_url, title }) {
  const [imgError, setImgError] = useState(false);

  return (
    <a
      href={target_url}
      target="_blank"
      rel="noreferrer"
      style={{
        display: 'block', position: 'relative',
        borderRadius: 8, overflow: 'hidden',
        background: C.bg, border: `1px solid ${C.border}`,
        cursor: 'pointer', textDecoration: 'none',
        height: '100%',
      }}
    >
      {img_url && !imgError ? (
        <img
          src={img_url}
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          alt={title}
        />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          background: '#e0e0e0',
        }} />
      )}

      {/* Title overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
        padding: '24px 12px 10px',
        color: '#fff', fontSize: 16, fontWeight: 600,
        lineHeight: 1.3,
      }}>
        {title}
      </div>
    </a>
  );
}
