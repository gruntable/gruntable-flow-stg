import { useState } from "react";
import { C, S } from "../../../platform/styles.jsx";
import { NODE_CATALOGUE } from "../nodes/catalogue.js";

// ─────────────────────────────────────────────
// NODE PICKER MODAL
// ─────────────────────────────────────────────
export default function NodePicker({ onAdd, onClose, isFirstPosition }) {
  const [search, setSearch] = useState("");
  const filtered = NODE_CATALOGUE.filter(n =>
    !search ||
    n.label.toLowerCase().includes(search.toLowerCase()) ||
    n.desc.toLowerCase().includes(search.toLowerCase())
  );
  const groups = ["AI", "Export"];
  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:C.white, borderRadius:10, width:480, maxHeight:"72vh", display:"flex", flexDirection:"column", boxShadow:"0 8px 32px rgba(0,0,0,0.15)" }}
      >
        <div style={{ padding:"16px 18px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>Add Node</div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes…"
            style={S.input}
            autoFocus
          />
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"8px 0" }}>
          {groups.map(cat => {
            const nodes = filtered.filter(n => n.category === cat);
            if (!nodes.length) return null;
            return (
              <div key={cat}>
                <div style={{ fontSize:10, fontWeight:700, color:C.muted, padding:"10px 18px 4px", textTransform:"uppercase", letterSpacing:0.5 }}>
                  {cat === "AI" ? "🤖" : cat === "Export" ? "📤" : "•"} {cat}
                </div>
                {nodes.map(n => {
                  const disabled = isFirstPosition && n.requires_table_input;
                  return (
                    <button
                      key={n.node_type}
                      onClick={() => { if (!disabled) { onAdd(n); onClose(); } }}
                      style={{
                        display:"block", width:"100%", textAlign:"left", padding:"9px 18px",
                        border:"none", background:"none",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.45 : 1,
                        transition:"background 0.1s",
                      }}
                      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = "#f5f5f5"; }}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                      <div style={{ fontWeight:600, fontSize:12, color:C.black }}>{n.label}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{n.desc}</div>
                      {disabled && (
                        <div style={{ fontSize:10, color:"#f59e0b", marginTop:3 }}>
                          Requires a table input — cannot be the first node
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!filtered.length && (
            <div style={{ padding:"24px 18px", color:C.muted, fontSize:13 }}>
              No nodes match "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
