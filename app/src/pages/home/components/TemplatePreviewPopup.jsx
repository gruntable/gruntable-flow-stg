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
      padding: '4px 10px', border: `1px solid ${C.border}`,
      borderRadius: 20, fontSize: 12, fontWeight: 500, color: C.black,
      background: C.white,
    }}>
      {icon} {label}
    </span>
  );
}

export default function TemplatePreviewPopup({ template, onClose, onUseTemplate }) {
  if (!template) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.white, borderRadius: 10,
          padding: '32px 36px', width: 560, maxHeight: '80vh',
          overflowY: 'auto', position: 'relative',
          ...S.col(20),
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            border: 'none', background: 'none', fontSize: 18,
            cursor: 'pointer', color: C.mid, lineHeight: 1,
          }}
        >
          ✕
        </button>

        {/* Title */}
        <div style={{ fontSize: 18, fontWeight: 700, color: C.black }}>
          {template.name}
        </div>

        {/* Description */}
        <div style={{ fontSize: 13, color: C.mid, lineHeight: 1.7 }}>
          This template helps you extract and transform data from documents into a structured format
          compatible with {template.platform}. Customize the workflow to fit your exact use case.
        </div>

        {/* Image placeholder */}
        <div style={{
          border: `1px solid ${C.border}`, borderRadius: 6,
          background: C.bg, height: 160,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.muted, fontSize: 12,
        }}>
          Screenshot / Image
        </div>

        {/* Video placeholder */}
        <div style={{
          border: `1px solid ${C.border}`, borderRadius: 6,
          background: C.bg, height: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, color: C.muted, fontSize: 12,
        }}>
          ▶ Video Walkthrough
        </div>

        {/* Metadata */}
        <div style={{ ...S.col(8) }}>
          <div style={{ ...S.flex(12), fontSize: 12 }}>
            <span style={{ color: C.muted, width: 100 }}>Platform:</span>
            <Chip icon={PLATFORM_ICON[template.platform] ?? '🔘'} label={template.platform} />
          </div>
          <div style={{ ...S.flex(12), fontSize: 12 }}>
            <span style={{ color: C.muted, width: 100 }}>Input Method:</span>
            <Chip icon={METHOD_ICON[template.inputMethod] ?? '•'} label={template.inputMethod} />
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
          <button style={{ ...S.btnP, padding: '10px 32px', fontSize: 13 }} onClick={onUseTemplate}>
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}
