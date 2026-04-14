import { useState } from 'react';
import { C, S } from '../../../styles.jsx';

const PLATFORM_ICON = {
  Accurate: '🔵',
  Excel:    '📊',
  Jurnal:   '🟢',
  Zahir:    '🟡',
};

const METHOD_ICON = {
  'Manual Import':    '👆',
  'Direct API Input': '⚡',
};

function Chip({ icon, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', border: `1px solid ${C.border}`,
      borderRadius: 20, fontSize: 11, fontWeight: 400, color: C.black,
      background: C.white, whiteSpace: 'nowrap',
    }}>
      {icon} {label}
    </span>
  );
}

export default function TemplateCard({ name, platform, inputMethod, description, showChips = true, imgStyle = false, img_url = null, onClick }) {
  const [hovered,  setHovered]  = useState(false);
  const [imgError, setImgError] = useState(false);

  if (imgStyle) {
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative', borderRadius: 8, overflow: 'hidden',
          border: `1px solid ${C.border}`, cursor: 'pointer',
          background: C.bg, height: '100%',
          boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
          transition: 'box-shadow 0.15s',
        }}
      >
        {/* Faint background image */}
        {img_url && !imgError ? (
          <img
            src={img_url}
            onError={() => setImgError(true)}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%', objectFit: 'cover',
              opacity: 0.12, display: 'block',
            }}
            alt=""
          />
        ) : null}

        {/* Content */}
        <div style={{
          position: 'relative', zIndex: 1,
          padding: 14, height: '100%', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.black, lineHeight: 1.35, display: 'flex', alignItems: 'center', gap: 6 }}>
            {name}{hovered && <span style={{ fontSize: 12, color: '#888888' }}>❯</span>}
          </div>
          {description && (
            <div style={{ fontSize: 14, color: '#666666', lineHeight: 1.5 }}>{description}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...S.col(8),
        padding: 16, border: `1px solid ${C.border}`, borderRadius: 8,
        cursor: 'pointer', background: C.white,
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        transition: 'box-shadow 0.15s',
        height: '100%', boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 20, lineHeight: 1 }}>🗂️</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.black, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 6 }}>
        {name}{hovered && <span style={{ fontSize: 14, color: '#888888' }}>❯</span>}
      </div>

      {description && (
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
          {description}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {showChips && (
        <div style={{ ...S.flex(6) }}>
          <Chip icon={PLATFORM_ICON[platform] ?? '🔘'} label={platform} />
          <Chip icon={METHOD_ICON[inputMethod]  ?? '•'}  label={inputMethod} />
        </div>
      )}
    </div>
  );
}
