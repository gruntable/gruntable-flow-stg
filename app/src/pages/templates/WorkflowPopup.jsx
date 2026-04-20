import { marked } from 'marked';
import { C, S } from '../../styles.jsx';

marked.setOptions({ headerIds: false, mangle: false });

function CollectionChip({ label, type }) {
  const icon = type === 'data_source' ? '📄' : '🎯';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', border: `1px solid ${C.border}`,
      borderRadius: 20, fontSize: 12, fontWeight: 500, color: '#666666',
      background: C.white,
    }}>
      {icon} {label}
    </span>
  );
}

export default function WorkflowPopup({ template, collections, onClose, onUseTemplate }) {
  if (!template) return null;

  const imageUrls = Array.isArray(template.image_urls)
    ? template.image_urls
    : JSON.parse(template.image_urls || '[]');
  const videoUrl = template.video_url?.trim() || '';

  const templateCollections = (template.collection_ids || [])
    .map(id => collections.find(c => c.id === id))
    .filter(Boolean);

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
          width: 620, maxHeight: '85vh',
          overflowY: 'auto', position: 'relative',
          ...S.col(0),
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            border: 'none', background: 'none', fontSize: 18,
            cursor: 'pointer', color: C.mid, lineHeight: 1, zIndex: 1,
          }}
        >
          ✕
        </button>

        <div style={{ padding: '28px 32px 20px', ...S.col(14) }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.black, paddingRight: 32 }}>
            {template.name}
          </div>

          <div style={{ ...S.flex(10) }}>
            <button
              style={{ ...S.btnP, padding: '8px 20px', fontSize: 13 }}
              onClick={onUseTemplate}
            >
              Use this Template
            </button>
          </div>

          {templateCollections.length > 0 && (
            <div style={{ ...S.flex(8), flexWrap: 'wrap' }}>
              {templateCollections.map(col => (
                <CollectionChip key={col.id} label={col.filter_value} type={col.filter_type} />
              ))}
            </div>
          )}
        </div>

        {(videoUrl || imageUrls.length > 0) && (
          <div style={{ padding: '0 32px', display: 'flex', gap: 16 }}>
            {videoUrl && (
              <div style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', height: 160 }}>
                <iframe src={videoUrl} width="100%" height="100%" allowFullScreen style={{ display: 'block', border: 'none' }} />
              </div>
            )}
            {imageUrls.length > 0 && (
              <div style={{ flex: 1, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', height: 160 }}>
                <img src={imageUrls[0]} alt={template.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '8px 32px 32px' }}>
          <style>{`
            .md-body p { margin: 0 0 10px; }
            .md-body p:last-child { margin-bottom: 0; }
            .md-body h1, .md-body h2, .md-body h3 { margin: 14px 0 6px; font-weight: 600; color: #111; }
            .md-body h1 { font-size: 16px; }
            .md-body h2 { font-size: 14px; }
            .md-body h3 { font-size: 13px; }
            .md-body ul, .md-body ol { margin: 0 0 10px 18px; padding: 0; }
            .md-body li { margin-bottom: 4px; }
            .md-body code { background: #f0f0f0; border-radius: 3px; padding: 1px 5px; font-size: 12px; }
            .md-body pre { background: #f0f0f0; border-radius: 6px; padding: 12px; overflow-x: auto; margin-bottom: 10px; }
            .md-body pre code { background: none; padding: 0; }
            .md-body strong { font-weight: 600; color: #333; }
            .md-body a { color: #0066cc; }
          `}</style>
          <div
            className="md-body"
            style={{ fontSize: 13, color: C.mid, lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: marked.parse(template.description || '') }}
          />
        </div>
      </div>
    </div>
  );
}