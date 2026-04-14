import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { C, S } from '../../../styles.jsx';
import BetaBadge from '../../workflow/panels/left-panel/top-panel/BetaBadge.jsx';

const COMMUNITY_LINKS = [
  { label: 'WA Channel',       href: '#' },
  { label: 'WA Community',     href: '#' },
  { label: 'WA Admin Support', href: '#' },
  { label: 'Referral Program', href: '#' },
];

const MOCK_EMAIL = 'user@gruntable.com';

// ─── Sub-components ───────────────────────────────────────────────────────────

function CommunityPopover({ links }) {
  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      padding: '4px 0', minWidth: 180, zIndex: 200,
    }}>
      {links.map(l => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'block', padding: '8px 16px',
            fontSize: 13, color: C.black, textDecoration: 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.bg}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}

function ProfilePopover({ email }) {
  return (
    <div style={{
      position: 'absolute', bottom: '100%', left: 0, marginBottom: 4,
      background: C.white, border: `1px solid ${C.border}`,
      borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      padding: '4px 0', minWidth: 180, zIndex: 200,
    }}>
      <div style={{
        padding: '10px 16px 8px',
        fontSize: 12, color: C.muted,
        borderBottom: `1px solid ${C.border}`,
      }}>
        {email}
      </div>
      {/* <div
        style={{ padding: '8px 16px', fontSize: 13, color: C.black, cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = C.bg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        Settings
      </div> */}
      <div
        style={{ padding: '8px 16px', fontSize: 13, color: C.red, cursor: 'pointer' }}
        onMouseEnter={e => e.currentTarget.style.background = C.bg}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        Logout
      </div>
    </div>
  );
}

function navItemStyle(active, collapsed, disabled = false) {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: collapsed ? '8px 6px' : '8px 10px',
    borderRadius: 6,
    cursor: disabled ? 'default' : 'pointer',
    background: active ? '#f0f0f0' : 'transparent',
    color: disabled ? C.muted : C.black,
    fontSize: 16, fontWeight: active ? 600 : 400,
    opacity: disabled ? 0.5 : 1,
    userSelect: 'none',
    whiteSpace: 'nowrap', overflow: 'hidden',
    transition: 'background 0.1s',
  };
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({ activePage = 'home' }) {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('gruntable_sidebar_collapsed') === 'true'
  );
  const [openPopover, setOpenPopover] = useState(null);

  const referencesRef = useRef(null);
  const profileRef    = useRef(null);

  function handleToggle() {
    setCollapsed(v => {
      const next = !v;
      localStorage.setItem('gruntable_sidebar_collapsed', String(next));
      return next;
    });
  }

  // Click-outside to close popovers
  useEffect(() => {
    if (!openPopover) return;
    function handleMouseDown(e) {
      const ref = openPopover === 'references' ? referencesRef : profileRef;
      if (ref.current && !ref.current.contains(e.target)) setOpenPopover(null);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [openPopover]);

  return (
    <div style={{
      width: collapsed ? 40 : 220,
      minWidth: collapsed ? 40 : 220,
      height: '100vh',
      borderRight: `1px solid ${C.border}`,
      background: C.white,
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s, min-width 0.2s',
      overflow: 'hidden',
      flexShrink: 0,
      position: 'relative',
      zIndex: 10,
    }}>

      {/* ── Top section ── */}
      <div style={{ padding: collapsed ? '14px 6px' : '14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* Logo + toggle row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {!collapsed && <BetaBadge />}
          <button
            onClick={handleToggle}
            style={{
              border: 'none', background: 'none', cursor: 'pointer',
              color: C.muted, fontSize: 14, padding: '2px 4px',
              borderRadius: 4, lineHeight: 1,
              flexShrink: 0,
            }}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '▶' : '◀'}
          </button>
        </div>

        {/* Home nav item */}
        <div style={navItemStyle(activePage === 'home', collapsed)}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>🏠</span>
          {!collapsed && <span>Home</span>}
        </div>


      </div>

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Bottom section ── */}
      <div style={{ padding: collapsed ? '14px 6px' : '14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>

        {/* Templates ↗ */}
        <div
          onClick={() => navigate('/templates')}
          style={navItemStyle(activePage === 'templates', collapsed)}
          onMouseEnter={e => { if (activePage !== 'templates') e.currentTarget.style.background = C.bg; }}
          onMouseLeave={e => { if (activePage !== 'templates') e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 14, flexShrink: 0 }}>📄</span>
          {!collapsed && <span>Templates ↗</span>}
        </div>

        {/* References */}
        {/* <div style={{ position: 'relative' }} ref={referencesRef}>
          <div
            onClick={() => setOpenPopover(v => v === 'references' ? null : 'references')}
            style={navItemStyle(false, collapsed)}
            onMouseEnter={e => { if (openPopover !== 'references') e.currentTarget.style.background = C.bg; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>🔗</span>
            {!collapsed && <span>References</span>}
          </div>
          {openPopover === 'references' && <CommunityPopover links={COMMUNITY_LINKS} />}
        </div> */}

        {/* Profile */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <div
            onClick={() => setOpenPopover(v => v === 'profile' ? null : 'profile')}
            style={navItemStyle(false, collapsed)}
            onMouseEnter={e => { if (openPopover !== 'profile') e.currentTarget.style.background = C.bg; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ fontSize: 14, flexShrink: 0 }}>👤</span>
            {!collapsed && <span>Profile</span>}
          </div>
          {openPopover === 'profile' && <ProfilePopover email={MOCK_EMAIL} />}
        </div>

      </div>
    </div>
  );
}
