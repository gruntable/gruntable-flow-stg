import { useState } from 'react';
import { C, S } from '../../../platform/styles.jsx';

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

export default function TemplateCard({ name, platform, inputMethod, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...S.col(8),
        padding: 16, border: `1px solid ${C.border}`, borderRadius: 8,
        cursor: 'pointer', background: C.white, width: 300,
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        transition: 'box-shadow 0.15s',
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: C.black, lineHeight: 1.4, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
        {name}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ ...S.flex(6) }}>
        <Chip icon={PLATFORM_ICON[platform] ?? '🔘'} label={platform} />
        <Chip icon={METHOD_ICON[inputMethod] ?? '•'} label={inputMethod} />
      </div>
    </div>
  );
}
