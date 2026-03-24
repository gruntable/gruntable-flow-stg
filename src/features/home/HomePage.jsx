import { useState, useRef } from 'react';
import { C, S } from '../../platform/styles.jsx';
import WorkflowCard from './components/WorkflowCard.jsx';
import TemplateCard from './components/TemplateCard.jsx';
import EmptyWorkflowsPanel from './components/EmptyWorkflowsPanel.jsx';
import TemplatePreviewPopup from './components/TemplatePreviewPopup.jsx';

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_WORKFLOWS = [
  { id: 1, name: 'Importer Transaksi Penjualan', platform: 'Accurate', inputMethod: 'Manual Import',    lastRun: '12 Sep 2025' },
  { id: 2, name: 'Importer Transaksi Penjualan', platform: 'Accurate', inputMethod: 'Manual Import',    lastRun: '10 Sep 2025' },
  { id: 3, name: 'Importer Transaksi Penjualan', platform: 'Accurate', inputMethod: 'Manual Import',    lastRun: '8 Sep 2025'  },
];

const MOCK_TEMPLATES = [
  { id: 1, name: 'Importer Transaksi Penjualan', platform: 'Accurate', inputMethod: 'Manual Import'    },
  { id: 2, name: 'Importer Transaksi Penjualan', platform: 'Accurate', inputMethod: 'Manual Import'    },
  { id: 3, name: 'Importer Transaksi Penjualan', platform: 'Accurate', inputMethod: 'Direct API Input' },
  { id: 4, name: 'Importer Transaksi Penjualan', platform: 'Accurate', inputMethod: 'Manual Import'    },
  { id: 5, name: 'Importer Transaksi Penjualan', platform: 'Accurate', inputMethod: 'Manual Import'    },
  { id: 6, name: 'Importer Transaksi Penjualan', platform: 'Accurate', inputMethod: 'Direct API Input' },
];

const PLATFORMS = [
  { key: 'All',      label: 'All',      logo: null,   bg: null       },
  { key: 'Excel',    label: 'Excel',    logo: 'X',    bg: '#217346'  },
  { key: 'Accurate', label: 'Accurate', logo: 'A',    bg: '#00a651'  },
  { key: 'Jurnal',   label: 'Jurnal',   logo: 'J',    bg: '#f5821f'  },
  { key: 'Zahir',    label: 'Zahir',    logo: 'Z',    bg: '#005baa'  },
];
const INPUT_METHODS = [
  { key: 'All',              label: 'All',              icon: '⊞' },
  { key: 'Manual Import',    label: 'Manual Import',    icon: '👆' },
  { key: 'Direct API Input', label: 'Direct API Input', icon: '⚡' },
];

// ─── HomePage ─────────────────────────────────────────────────────────────────

export default function HomePage({ onNavigateToWorkflow }) {
  const [showEmpty,       setShowEmpty]       = useState(false);
  const [platformFilter,  setPlatformFilter]  = useState('All');
  const [methodFilter,    setMethodFilter]    = useState('All');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const templatesSectionRef = useRef(null);

  function scrollToTemplates() {
    const el = templatesSectionRef.current;
    if (el) window.scrollTo({ top: el.offsetTop - 800, behavior: 'smooth' });
  }

  const filteredTemplates = MOCK_TEMPLATES.filter(t => {
    const matchPlatform = platformFilter === 'All' || t.platform    === platformFilter;
    const matchMethod   = methodFilter   === 'All' || t.inputMethod === methodFilter;
    return matchPlatform && matchMethod;
  });

  return (
    <div style={{
      minHeight: '100vh', background: C.white,
      padding: '100px 150px', boxSizing: 'border-box',
      fontFamily: 'system-ui, sans-serif',
      overflowY: 'auto',
    }}>

      {/* ── My Workflows ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>

        {/* Header row */}
        <div style={{ ...S.flex(12), marginBottom: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: C.black }}>My Workflows</span>

          {!showEmpty && (
            <button style={{ ...S.btnS, fontSize: 14, background: '#111', color: '#fff', border: '1px solid #111' }} onClick={onNavigateToWorkflow}>
              + New Workflow
            </button>
          )}

          {/* DEV TOGGLE — remove once real data is wired */}
          <label style={{
            ...S.flex(6), fontSize: 11, color: C.muted,
            border: `1px dashed ${C.border}`, borderRadius: 4,
            padding: '2px 8px', cursor: 'pointer', userSelect: 'none',
          }}>
            <input
              type="checkbox"
              checked={showEmpty}
              onChange={e => setShowEmpty(e.target.checked)}
              style={{ margin: 0 }}
            />
            empty state
          </label>

        </div>

        {/* Content */}
        {showEmpty ? (
          <EmptyWorkflowsPanel
            onBrowseTemplates={scrollToTemplates}
            onNewWorkflow={onNavigateToWorkflow}
          />
        ) : (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'nowrap' }}>
            {MOCK_WORKFLOWS.map(wf => (
              <WorkflowCard
                key={wf.id}
                name={wf.name}
                platform={wf.platform}
                inputMethod={wf.inputMethod}
                lastRun={wf.lastRun}
                onClick={() => onNavigateToWorkflow(wf.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Popular Templates ─────────────────────────────────────────────── */}
      <section ref={templatesSectionRef}>

        <div style={{ fontSize: 18, fontWeight: 700, color: C.black, marginBottom: 16 }}>
          Popular Templates by Target Platform
        </div>

        {/* Platform filter — icon+label buttons */}
        <div style={{ ...S.flex(8), marginBottom: 10, flexWrap: 'wrap' }}>
          {PLATFORMS.map(({ key, label, logo }) => {
            const active = platformFilter === key;
            return (
              <button
                key={key}
                onClick={() => setPlatformFilter(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${active ? C.black : C.border}`,
                  background: active ? '#E0FEAA' : C.white,
                  color: active ? C.black : C.muted,
                  fontWeight: active ? 600 : 400,
                  fontSize: 13,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: active ? C.black : '#e0e0e0',
                  color: active ? '#E0FEAA' : C.muted,
                  fontWeight: 700, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {logo ?? '⊞'}
                </span>
                {label}
              </button>
            );
          })}
        </div>

        {/* Input Method filter — chip toggles */}
        <div style={{ ...S.flex(8), marginBottom: 24, flexWrap: 'wrap' }}>
          {INPUT_METHODS.map(({ key, label, icon }) => {
            const active = methodFilter === key;
            return (
              <button
                key={key}
                onClick={() => setMethodFilter(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400,
                  cursor: 'pointer', border: `1.5px solid ${active ? C.black : C.border}`,
                  background: active ? '#E0FEAA' : C.white,
                  color:      active ? C.black : C.muted,
                  transition: 'all 0.12s',
                }}
              >
                <span style={{ fontSize: 13 }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </div>

        {/* Template grid */}
        {filteredTemplates.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '48px 0',
            fontSize: 14, color: C.muted,
          }}>
            No templates found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {filteredTemplates.map(t => (
              <TemplateCard
                key={t.id}
                name={t.name}
                platform={t.platform}
                inputMethod={t.inputMethod}
                onClick={() => setSelectedTemplate(t)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Template Preview Popup ────────────────────────────────────────── */}
      <TemplatePreviewPopup
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        onUseTemplate={() => {
          setSelectedTemplate(null);
          onNavigateToWorkflow();
        }}
      />
    </div>
  );
}
