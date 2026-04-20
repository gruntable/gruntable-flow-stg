import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, S } from '../../styles.jsx';
import { HOME_ENDPOINTS } from '../../config.js';
import { getUserId, setUserId } from '../workflow/services/user.js';
import { listWorkflows, renameWorkflow as apiRenameWorkflow, deleteWorkflow as apiDeleteWorkflow } from '../workflow/services/workflowApi.js';
import Sidebar from './components/Sidebar.jsx';
import BannerCard from './components/BannerCard.jsx';
import WorkflowCard from './components/WorkflowCard.jsx';
import TemplateCard from './components/TemplateCard.jsx';
import EmptyWorkflowsPanel from './components/EmptyWorkflowsPanel.jsx';

const shimmerStyle = {
  background: 'linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

const INIT_WORKFLOWS = [
  { id: 1, name: 'Importer Transaksi Penjualan', lastRun: '12 Sep 2025' },
  { id: 2, name: 'Rekap Data Pelanggan',         lastRun: '10 Sep 2025' },
  { id: 3, name: 'Laporan Keuangan Bulanan',     lastRun: '8 Sep 2025'  },
];

export default function HomePage({ onNavigateToWorkflow }) {
  const navigate = useNavigate();

  const [banners,        setBanners]        = useState([]);
  const [templates,      setTemplates]      = useState([]);
  const [workflows,      setWorkflows]      = useState(INIT_WORKFLOWS);
  const [deleteTarget,   setDeleteTarget]   = useState(null);
  const [homeLoading,    setHomeLoading]    = useState(true);
  const [homeError,      setHomeError]      = useState(null);
  const [workflowLoading, setWorkflowLoading] = useState(true);
  const [workflowError,   setWorkflowError]   = useState(null);
  const [userId,         setUserIdState]    = useState(() => getUserId());
  const [editUserId,     setEditUserId]      = useState(() => getUserId());
  const [workflowSort,   setWorkflowSort]    = useState('lastEdited');
  const [deleteLoading,  setDeleteLoading]   = useState(false);
  const [deleteError,    setDeleteError]      = useState(null);

  useEffect(() => {
    fetch(HOME_ENDPOINTS.CARDS)
      .then(async res => {
        const text = await res.text();
        if (!res.ok) throw new Error(`Failed to fetch home cards: ${res.status} - ${text}`);
        return text ? JSON.parse(text) : {};
      })
      .then(data => {
        setBanners(data.banners || []);
        setTemplates(data.templates || []);
        setHomeLoading(false);
      })
      .catch(err => {
        console.error('Home cards fetch error:', err);
        setHomeError(err.message);
        setHomeLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!userId) return;
    listWorkflows(userId)
      .then(data => {
        setWorkflows(data.workflows || []);
        setWorkflowLoading(false);
      })
      .catch(err => {
        console.error('Workflow list fetch error:', err);
        setWorkflowError(err.message);
        setWorkflowLoading(false);
      });
  }, [userId]);

  const formatTemplateFilters = (t) => {
    return t.target_url?.split('=')[1] || t.filters || '';
  };

  function handleRenameWorkflow(id, newName) {
    setWorkflows(prev => prev.map(w => w.id === id ? { ...w, name: newName } : w));
    apiRenameWorkflow(id, newName, userId).catch(err => {
      console.error('Rename workflow error:', err);
    });
  }

  function handleDeleteWorkflow(id) {
    setDeleteLoading(true);
    setDeleteError(null);
    apiDeleteWorkflow(id, userId)
      .then(() => {
        setWorkflows(prev => prev.filter(w => w.id !== id));
        setDeleteTarget(null);
        setDeleteLoading(false);
      })
      .catch(err => {
        console.error('Delete workflow error:', err);
        setDeleteError(err.message);
        setDeleteLoading(false);
      });
  }

  function handleUserIdChange(e) {
    const newValue = e.target.value;
    setEditUserId(newValue);
  }

  function handleUserIdBlur() {
    if (editUserId && editUserId !== userId) {
      setUserId(editUserId);
      setUserIdState(editUserId);
    }
  }

  function handleUserIdKeyDown(e) {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  }

  const sortedWorkflows = [...workflows].sort((a, b) => {
    if (workflowSort === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (workflowSort === 'lastEdited') {
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    const aTime = a.lastRun ? new Date(a.lastRun).getTime() : 0;
    const bTime = b.lastRun ? new Date(b.lastRun).getTime() : 0;
    if (aTime === 0 && bTime === 0) return a.name.localeCompare(b.name);
    if (aTime === 0) return 1;
    if (bTime === 0) return -1;
    return bTime - aTime;
  });

  const showLearn     = banners.length > 0;
  const showFeatured  = templates.length > 0;

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'system-ui, sans-serif', background: C.white }}>

        <Sidebar activePage="home" />

        <div style={{ flex: 1, overflowY: 'auto', padding: '36px 48px', boxSizing: 'border-box' }}>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 26, fontWeight: 700, color: C.black }}>Home</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 12, color: C.muted }}>User ID:</label>
              <input
                type="text"
                value={editUserId}
                onChange={handleUserIdChange}
                onBlur={handleUserIdBlur}
                onKeyDown={handleUserIdKeyDown}
                style={{
                  fontSize: 12,
                  padding: '4px 8px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  width: 280,
                  fontFamily: 'monospace',
                }}
                placeholder="Enter user ID..."
              />
            </div>
          </div>

          {homeLoading ? (
            <div style={{ display: 'flex', gap: 28, marginBottom: 48, height: 260 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ ...shimmerStyle, width: 80, height: 20, borderRadius: 4, marginBottom: 12 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '115px 115px', gap: 12 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ ...shimmerStyle, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ ...shimmerStyle, width: 160, height: 20, borderRadius: 4, marginBottom: 12 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '115px 115px', gap: 12 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ ...shimmerStyle, borderRadius: 8, border: '1px solid #e0e0e0', padding: 14 }}>
                      <div style={{ ...shimmerStyle, width: '60%', height: 16, borderRadius: 4, marginBottom: 8 }} />
                      <div style={{ ...shimmerStyle, width: '80%', height: 12, borderRadius: 4 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : homeError ? (
            <div style={{ color: C.red, marginBottom: 48 }}>Error: {homeError}</div>
          ) : (showLearn || showFeatured) && (
            <div style={{ display: 'flex', gap: 28, marginBottom: 48, height: 260 }}>

              {showLearn && (
                <div style={{ flex: '0 0 calc(50% - 14px)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.black, marginBottom: 12 }}>Learn</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '115px 115px', gap: 12 }}>
                    {banners.slice(0, 4).map((b, idx) => (
                      <BannerCard key={`banner-${idx}`} img_url={b.img_url} target_url={b.target_url} title={b.title} />
                    ))}
                  </div>
                </div>
              )}

              {showFeatured && (
                <div style={{ flex: '0 0 calc(50% - 14px)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.black, marginBottom: 12 }}>Featured Templates</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '115px 115px', gap: 12 }}>
                    {templates.slice(0, 4).map((t, idx) => (
                      <TemplateCard
                        key={`template-${idx}`}
                        name={t.title}
                        description={t.description}
                        showChips={false}
                        imgStyle={true}
                        img_url={t.img_url}
                        onClick={() => navigate(`/templates?filters=${formatTemplateFilters(t)}`)}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          <section style={{ marginBottom: 48 }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: C.black, flex: 1 }}>My Workflows</span>

                <select
                  value={workflowSort}
                  onChange={e => setWorkflowSort(e.target.value)}
                  style={{ ...S.input, width: 'auto', fontSize: 12, padding: '5px 10px' }}
                >
                  <option value="lastEdited">Sort by last edited</option>
                  <option value="lastRun">Sort by last run</option>
                  <option value="name">Sort by name (A-Z)</option>
                </select>
              </div>

            {workflowLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ height: 140, ...shimmerStyle, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                ))}
              </div>
            ) : workflowError ? (
              <div style={{ color: C.red, padding: 16 }}>Error loading workflows: {workflowError}</div>
            ) : (workflows.length === 0) ? (
              <EmptyWorkflowsPanel
                onNewWorkflow={onNavigateToWorkflow}
              />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>

                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: 16,
                  border: `2px dashed ${C.border}`, borderRadius: 8,
                  background: C.white,
                }}>
                  <button style={{ ...S.btnP, fontSize: 14 }} onClick={() => onNavigateToWorkflow()}>
                    + New Workflow
                  </button>
                  <span
                    style={{ fontSize: 13, color: C.mid, cursor: 'pointer' }}
                    onClick={() => navigate('/templates')}
                  >
                    or browse templates
                  </span>
                </div>

                {sortedWorkflows.map(wf => (
                  <WorkflowCard
                    key={wf.id}
                    name={wf.name}
                    lastRun={wf.lastRun}
                    lastEdited={wf.updated_at}
                    onClick={() => { console.log('[HomePage] Clicked workflow:', wf); onNavigateToWorkflow(wf.id); }}
                    onRename={newName => handleRenameWorkflow(wf.id, newName)}
                    onDelete={() => setDeleteTarget({ id: wf.id, name: wf.name })}
                  />
                ))}
              </div>
            )}
          </section>

        </div>

        {deleteTarget && (
          <div
            onClick={() => !deleteLoading && setDeleteTarget(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000,
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: C.white, borderRadius: 10,
                padding: '32px 36px', width: 380,
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: C.black }}>Delete this workflow?</div>
              <div style={{ fontSize: 13, color: C.mid }}>"{deleteTarget.name}"</div>
              <div style={{ fontSize: 13, color: C.muted }}>This action cannot be undone.</div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button
                  style={{
                    ...S.btnS,
                    opacity: deleteLoading ? 0.6 : 1,
                    cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  }}
                  disabled={deleteLoading}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  style={{
                    ...S.btnP,
                    background: C.red,
                    border: `1px solid ${C.red}`,
                    opacity: deleteLoading ? 0.7 : 1,
                    cursor: deleteLoading ? 'not-allowed' : 'pointer',
                  }}
                  disabled={deleteLoading}
                  onClick={() => handleDeleteWorkflow(deleteTarget.id)}
                >
                  {deleteLoading ? 'Deleting...' : 'Delete'}
                </button>
              </div>
              {deleteError && (
                <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>{deleteError}</div>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  );
}