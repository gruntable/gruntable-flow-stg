import { useState, useEffect } from "react";
import { C, S } from "../../../../styles.jsx";
import { listTables } from "../../services/table.js";

function getCleanTableName(technicalName) {
  const match = technicalName?.match(/^[\w-]+_[a-z0-9]+_(.+)$/);
  return match ? match[1].replace(/_/g, ' ') : technicalName;
}

// ─────────────────────────────────────────────
// TABLE PICKER MODAL
// ─────────────────────────────────────────────
export default function TablePicker({ onSelect, onCreateTable, onClose }) {
  const [search, setSearch] = useState("");
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        setLoading(true);
        const result = await listTables();
        setTables(result.tables || []);
      } catch (err) {
        setError(err.message || "Failed to load tables");
      } finally {
        setLoading(false);
      }
    };

    // Fetch tables on mount
      fetchTables();
  }, []);

  const trimmedSearch = search.trim();
  const filteredTables = tables
    .filter(t =>
      !trimmedSearch ||
      t.toLowerCase().includes(trimmedSearch.toLowerCase()) ||
      getCleanTableName(t).toLowerCase().includes(trimmedSearch.toLowerCase())
    )
    .sort((a, b) => getCleanTableName(a).toLowerCase().localeCompare(getCleanTableName(b).toLowerCase()));
  const hasExactMatch = tables.some(
    t => t === trimmedSearch || getCleanTableName(t).toLowerCase() === trimmedSearch.toLowerCase()
  );
  const showCreateOption = onCreateTable && trimmedSearch && !hasExactMatch;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.white, borderRadius: 10, width: 420, maxHeight: "72vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}
      >
        <div style={{ padding: "16px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Create or Open Table</div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search or name a new table..."
            style={S.input}
            autoFocus
          />
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
          {loading && (
            <div style={{ padding: "24px 18px", color: C.muted, fontSize: 13, textAlign: "center" }}>
              Loading tables...
            </div>
          )}

          {error && (
            <div style={{ padding: "24px 18px", color: "#dc2626", fontSize: 13, textAlign: "center" }}>
              {error}
            </div>
          )}

          {showCreateOption && (
            <button
              onClick={() => { onCreateTable(trimmedSearch); onClose(); }}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 18px",
                border: "none", background: "none", cursor: "pointer",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <div style={{ fontWeight: 600, fontSize: 12, color: "#2563eb" }}>
                + Create "{trimmedSearch}"
              </div>
            </button>
          )}

          {!loading && !error && filteredTables.length === 0 && !showCreateOption && (
            <div style={{ padding: "24px 18px", color: C.muted, fontSize: 13 }}>
              {tables.length === 0 ? "No tables yet. Type a name above to create one." : `No tables match "${search}"`}
            </div>
          )}

          {!loading && !error && filteredTables.length > 0 && (
            filteredTables.map(table => (
              <button
                key={table}
                onClick={() => { onSelect(table); onClose(); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", padding: "10px 18px",
                  border: "none", background: "none",
                  cursor: "pointer",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <div style={{ fontWeight: 600, fontSize: 12, color: C.black }}>
                  {getCleanTableName(table)}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
