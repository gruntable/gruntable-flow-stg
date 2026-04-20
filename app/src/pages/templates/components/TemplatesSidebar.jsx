import { C } from '../../../styles.jsx';

const COUNTRIES = ['Indonesia'];

const shimmerStyle = {
  background: 'linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite',
};

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: '#666666',
      letterSpacing: 0.8, textTransform: 'uppercase',
      padding: '16px 16px 6px',
    }}>
      {children}
    </div>
  );
}

function FilterItem({ label, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px', cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? C.black : C.mid,
        background: active ? '#f0f0f0' : 'transparent',
        borderRadius: 4,
        margin: '1px 8px',
        userSelect: 'none',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.bg; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      <span>{label}</span>
      {active && <span style={{ color: C.black, fontSize: 12 }}>✓</span>}
    </div>
  );
}

export default function TemplatesSidebar({ country, onCountryChange, searchQuery, onSearchChange, dataSources, targetPlatforms, activeFilters, onFilterChange, loading }) {

  return (
    <div style={{
      width: 200,
      minWidth: 200,
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
      paddingTop: 36,
      paddingBottom: 36,
      boxSizing: 'border-box',
    }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* Country */}
      <SectionLabel>🌍 Country</SectionLabel>
      <div style={{ padding: '0 16px 8px' }}>
        <select
          value={country}
          onChange={e => onCountryChange(e.target.value)}
          disabled={loading}
          style={{
            width: '100%', padding: '6px 8px',
            border: `1px solid ${C.border}`, borderRadius: 5,
            fontSize: 13, background: C.white, color: C.black, cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {COUNTRIES.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Data Source */}
      <SectionLabel>📄 Data Source</SectionLabel>
      {loading ? (
        [0,1,2,3].map(i => (
          <div key={i} style={{ ...shimmerStyle, height: 10, borderRadius: 4, margin: '6px 8px', padding: '6px 16px' }} />
        ))
      ) : (
        dataSources.map(ds => (
          <FilterItem
            key={ds.id}
            label={ds.filter_value}
            active={activeFilters.includes(ds.id)}
            onClick={() => onFilterChange(ds.id)}
          />
        ))
      )}

      {/* Target Platform */}
      <SectionLabel>🎯 Target Platform</SectionLabel>
      {loading ? (
        [0,1,2,3].map(i => (
          <div key={i} style={{ ...shimmerStyle, height: 10, borderRadius: 4, margin: '6px 8px', padding: '6px 16px' }} />
        ))
      ) : (
        targetPlatforms.map(tp => (
          <FilterItem
            key={tp.id}
            label={tp.filter_value}
            active={activeFilters.includes(tp.id)}
            onClick={() => onFilterChange(tp.id)}
          />
        ))
      )}
    </div>
  );
}
