import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { C, S } from '../../styles.jsx';
import CollectionCard from './components/CollectionCard.jsx';
import WorkflowCard from './components/WorkflowCard.jsx';
import TemplatesSidebar from './components/TemplatesSidebar.jsx';
import WorkflowPopup from './WorkflowPopup.jsx';
import { listTemplateRegistry } from './services/templates.js';

const shimmerStyle = {
  background: 'linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

function SectionHeader({ label, onArrowClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ ...S.flex(0), marginBottom: 12 }}>
      <div
        onClick={onArrowClick}
        onMouseEnter={() => onArrowClick && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display: 'flex', flexDirection: 'column', gap: 1, cursor: onArrowClick ? 'pointer' : 'default' }}
      >
        <div style={{ fontSize: 12, fontWeight: 500, color: hovered ? '#888888' : 'transparent', letterSpacing: '0.04em' }}>
          Filter by
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.black }}>{label}</span>
          {onArrowClick && <span style={{ fontSize: 14, color: '#888888' }}>❯</span>}
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const [country, setCountry] = useState('Indonesia');
  const [searchParams, setSearchParams] = useSearchParams();
  const [collections, setCollections] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    listTemplateRegistry(country)
      .then(data => {
        setCollections(data.collections ?? []);
        setTemplates(data.templates ?? []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Templates fetch error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [country]);

  const dataSources     = collections.filter(c => c.filter_type === 'data_source');
  const targetPlatforms = collections.filter(c => c.filter_type === 'target_platform');

  const dataSourceSections = dataSources.map(ds => ({ label: `📄 Data Source: ${ds.filter_value}`, collectionId: ds.id }));
  const targetPlatformSections = targetPlatforms.map(tp => ({ label: `🎯 Target Platform ${tp.filter_value}`, collectionId: tp.id }));

  const activeFilters = searchParams.get('filters')
    ? searchParams.get('filters').split(',')
    : [];
  const searchQuery = searchParams.get('q') ?? '';
  const templateId = searchParams.get('template');
  const selectedTemplate = templateId
    ? templates.find(t => t.id === templateId)
    : null;

  function updateFilters(newFilters, newQuery) {
    const params = new URLSearchParams(searchParams);
    if (newFilters.length > 0) params.set('filters', newFilters.join(','));
    else params.delete('filters');
    if (newQuery.trim()) params.set('q', newQuery);
    else params.delete('q');
    setSearchParams(params, { replace: true });
  }

  function toggleFilter(id) {
    if (id === null) { updateFilters([], ''); return; }
    const next = activeFilters.includes(id)
      ? activeFilters.filter(x => x !== id)
      : [...activeFilters, id];
    updateFilters(next, '');
  }

  function openTemplate(t) {
    const params = new URLSearchParams(searchParams);
    params.set('template', t.id);
    setSearchParams(params);
  }

  function closeTemplate() {
    const params = new URLSearchParams(searchParams);
    params.delete('template');
    setSearchParams(params, { replace: true });
  }

  function getTemplatesForCollection(collectionId) {
    return templates
      .filter(t => t.collection_ids.includes(collectionId))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 6);
  }

  function getFilteredTemplates() {
    let results = templates;
    if (activeFilters.length > 0) {
      const selectedDataSources     = activeFilters.filter(id => dataSources.some(c => c.id === id));
      const selectedTargetPlatforms = activeFilters.filter(id => targetPlatforms.some(c => c.id === id));
      results = results.filter(t => {
        const matchesDS = selectedDataSources.length === 0     || selectedDataSources.some(id => t.collection_ids.includes(id));
        const matchesTP = selectedTargetPlatforms.length === 0 || selectedTargetPlatforms.some(id => t.collection_ids.includes(id));
        return matchesDS && matchesTP;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(t => t.name.toLowerCase().includes(q));
    }
    return results;
  }

  function getActiveFilterLabel() {
    if (activeFilters.length === 0) return null;
    const getLabel = id => {
      const collection = collections.find(c => c.id === id);
      if (!collection) return id;
      const prefix = collection.filter_type === 'data_source' ? '📄 Data Source:' : '🎯 Target Platform:';
      return `${prefix} ${collection.filter_value}`;
    };
    if (activeFilters.length === 1) return getLabel(activeFilters[0]);
    if (activeFilters.length === 2) return activeFilters.map(getLabel).join(', ');
    return `${getLabel(activeFilters[0])}, ${getLabel(activeFilters[1])} +${activeFilters.length - 2} more`;
  }

  const filteredTemplates = getFilteredTemplates();
  const activeLabel = getActiveFilterLabel();

  return (
    <>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{ height: '100vh', overflowY: 'scroll', fontFamily: 'system-ui, sans-serif', background: C.white }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 48px', boxSizing: 'border-box', display: 'flex', gap: 40 }}>

          <TemplatesSidebar
            country={country}
            onCountryChange={setCountry}
            searchQuery={searchQuery}
            onSearchChange={q => updateFilters(activeFilters, q)}
            dataSources={dataSources}
            targetPlatforms={targetPlatforms}
            activeFilters={activeFilters}
            onFilterChange={toggleFilter}
            loading={loading}
          />

          <div style={{ flex: 1, minWidth: 0, paddingTop: 36, paddingBottom: 36 }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: C.black }}>Templates</div>
          <div style={{ fontSize: 16, color: '#666666', marginTop: 4 }}>Ready-to-use workflows that are fully customizable</div>
        </div>

        {loading ? (
          <div>
            <div style={{ marginBottom: 40 }}>
              <div style={{ ...shimmerStyle, width: 200, height: 32, borderRadius: 4, marginBottom: 8 }} />
              <div style={{ ...shimmerStyle, width: 350, height: 20, borderRadius: 4 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginBottom: 40 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{ ...shimmerStyle, height: 48, borderRadius: 6 }} />
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[0,1,2,3,4].map(i => (
                  <div key={i} style={{ ...shimmerStyle, height: 48, borderRadius: 6 }} />
                ))}
              </div>
            </div>
            {[0,1,2].map(sectionIdx => (
              <div key={sectionIdx} style={{ marginBottom: 40 }}>
                <div style={{ ...shimmerStyle, width: 220, height: 28, borderRadius: 4, marginBottom: 16 }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  {[0,1,2,3,4,5].map(i => (
                    <div key={i} style={{ ...shimmerStyle, height: 100, borderRadius: 8, border: '1px solid #e0e0e0' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div style={{ color: C.red, padding: 16 }}>Error loading templates: {error}</div>
        ) : activeFilters.length > 0 ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.black }}>{activeLabel}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: C.muted }}>
                {filteredTemplates.length} Workflow Template{filteredTemplates.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {filteredTemplates.map(t => (
                <WorkflowCard
                  key={t.id}
                  name={t.name}
                  onClick={() => openTemplate(t)}
                />
              ))}
            </div>

            {filteredTemplates.length === 0 && (
              <div style={{ textAlign: 'center', color: C.muted, fontSize: 13, paddingTop: 48 }}>
                No templates found.
              </div>
            )}
          </div>
        ) : (
          <div style={{ ...S.col(40) }}>

            {/* Data Sources + Target Platform side by side */}
            <section style={{ marginBottom: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>

                <div>
                  <SectionHeader label="📄 Data Sources" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {dataSources.slice(0, 5).map(collection => (
                      <CollectionCard
                        key={collection.id}
                        collection={collection}
                        onClick={() => toggleFilter(collection.id)}
                      />
                    ))}
                  </div>
                  {dataSources.length > 5 && (
                    <div style={{ marginTop: 8, fontSize: 14, color: '#666666' }}>
                      ← See more filters on the left panel
                    </div>
                  )}
                </div>

                <div>
                  <SectionHeader label="🎯 Target Platform" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {targetPlatforms.slice(0, 5).map(collection => (
                      <CollectionCard
                        key={collection.id}
                        collection={collection}
                        onClick={() => toggleFilter(collection.id)}
                      />
                    ))}
                  </div>
                  {targetPlatforms.length > 5 && (
                    <div style={{ marginTop: 8, fontSize: 14, color: '#666666' }}>
                      ← See more filters on the left panel
                    </div>
                  )}
                </div>

              </div>
            </section>

            <div style={{ height: 1, background: '#c1c1c1' }} />

            {/* Data Source Workflow sections */}
            {dataSourceSections.map(({ label, collectionId }) => {
              const sectionTemplates = getTemplatesForCollection(collectionId);
              return (
                <section key={collectionId}>
                  <SectionHeader
                    label={label}
                    onArrowClick={() => toggleFilter(collectionId)}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    {sectionTemplates.map(t => (
                      <WorkflowCard
                        key={t.id}
                        name={t.name}
                        onClick={() => openTemplate(t)}
                      />
                    ))}
                  </div>
                  {sectionTemplates.length === 0 && (
                    <div style={{ color: C.muted, fontSize: 13 }}>No templates yet.</div>
                  )}
                </section>
              );
            })}

            <div style={{ height: 1, background: '#c1c1c1' }} />

            {/* Target Platform Workflow sections */}
            {targetPlatformSections.map(({ label, collectionId }) => {
              const sectionTemplates = getTemplatesForCollection(collectionId);
              return (
                <section key={collectionId}>
                  <SectionHeader
                    label={label}
                    onArrowClick={() => toggleFilter(collectionId)}
                  />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    {sectionTemplates.map(t => (
                      <WorkflowCard
                        key={t.id}
                        name={t.name}
                        onClick={() => openTemplate(t)}
                      />
                    ))}
                  </div>
                  {sectionTemplates.length === 0 && (
                    <div style={{ color: C.muted, fontSize: 13 }}>No templates yet.</div>
                  )}
                </section>
              );
            })}

          </div>
        )}
          </div>
      </div>

      {selectedTemplate && (
        <WorkflowPopup
          template={selectedTemplate}
          collections={collections}
          onClose={closeTemplate}
          onUseTemplate={() => navigate('/workflow?new=true', { state: { templateWorkflowJson: selectedTemplate.workflow_json ?? null, templateName: selectedTemplate.name ?? null } })}
        />
      )}

    </div>
    </>
  );
}
