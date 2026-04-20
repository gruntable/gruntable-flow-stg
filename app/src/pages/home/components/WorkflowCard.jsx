import { useState, useEffect, useRef } from 'react';
import { C, S } from '../../../styles.jsx';

export default function WorkflowCard({ name, lastRun, lastEdited, onClick, onRename, onDelete }) {
  const [hovered,   setHovered]   = useState(false);
  const [menuOpen,  setMenuOpen]  = useState(false);
  const [renaming,  setRenaming]  = useState(false);
  const [nameValue, setNameValue] = useState(name);

  const menuRef = useRef(null);

  // Sync if parent updates name (e.g. after rename)
  useEffect(() => { setNameValue(name); }, [name]);

  // Click-outside to close menu
  useEffect(() => {
    if (!menuOpen) return;
    function handleMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [menuOpen]);

function saveRename() {
    setRenaming(false);
    if (nameValue.trim()) onRename?.(nameValue.trim());
    else setNameValue(name);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return (
    <div
      onClick={renaming ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...S.col(8),
        padding: 16, border: `1px solid ${C.border}`, borderRadius: 8,
        cursor: renaming ? 'default' : 'pointer',
        background: C.white,
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
        transition: 'box-shadow 0.15s',
        position: 'relative',
        minHeight: 0,
      }}
    >
      {/* ⋮ menu */}
      <div
        ref={menuRef}
        style={{ position: 'absolute', top: 10, right: 10 }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 18, color: C.muted, padding: '0 4px', lineHeight: 1,
          }}
        >
          ⋮
        </button>

        {menuOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 0,
            background: C.white, border: `1px solid ${C.border}`,
            borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            minWidth: 100, zIndex: 100, overflow: 'hidden',
          }}>
            <div
              style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: C.black }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { setMenuOpen(false); setRenaming(true); }}
            >
              Rename
            </div>
            <div
              style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: C.red }}
              onMouseEnter={e => e.currentTarget.style.background = C.bg}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => { setMenuOpen(false); onDelete?.(); }}
            >
              Delete
            </div>
          </div>
        )}
      </div>

      <div style={{ fontSize: 20, lineHeight: 1 }}>▶️</div>

      {/* Name — editable when renaming */}
      {renaming ? (
        <input
          autoFocus
          value={nameValue}
          onChange={e => setNameValue(e.target.value)}
          onBlur={saveRename}
          onKeyDown={e => {
            if (e.key === 'Enter')  saveRename();
            if (e.key === 'Escape') { setRenaming(false); setNameValue(name); }
          }}
          onClick={e => e.stopPropagation()}
          style={{
            ...S.input, fontSize: 14, fontWeight: 600,
            padding: '2px 6px', width: '100%', boxSizing: 'border-box',
            marginRight: 24,
          }}
        />
      ) : (
        <div style={{
          fontSize: 16, fontWeight: 600, color: C.black,
          lineHeight: 1.4, paddingRight: 24,
          height: '2.8em',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {nameValue}
        </div>
      )}

      <div style={{ fontSize: 13, color: '#666666' }}>
        <span style={{ color: lastRun ? '#666666' : '#999999' }}>
          {lastRun ? `Last run ${formatDate(lastRun)}` : 'Never run'}
        </span>
        {lastEdited && (
          <span style={{ color: '#999999', marginLeft: 8 }}>
            | Last edited {formatDate(lastEdited)}
          </span>
        )}
      </div>
    </div>
  );
}
