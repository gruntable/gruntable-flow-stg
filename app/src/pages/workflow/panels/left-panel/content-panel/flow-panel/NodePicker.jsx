import { useState } from "react";
import { C, S } from "../../../../../../styles.jsx";
import { NODE_CATALOGUE } from "../../../../utils/catalogue.js";

const ADVANCED_NODE_TYPES = ["ai_export", "code"];

// ─────────────────────────────────────────────
// NODE PICKER MODAL
// ─────────────────────────────────────────────
export default function NodePicker({ onAdd, onClose }) {
  const [tab, setTab] = useState("starter");
  const [search, setSearch] = useState("");
  const filtered = NODE_CATALOGUE.filter(n => {
    const matchesSearch = !search ||
      n.label.toLowerCase().includes(search.toLowerCase()) ||
      n.desc.toLowerCase().includes(search.toLowerCase());
    const isAdvanced = ADVANCED_NODE_TYPES.includes(n.node_type);
    const matchesTab = tab === "starter" ? !isAdvanced : isAdvanced;
    return matchesSearch && matchesTab;
  });
  const groups = ["Extract and Process", "Export", "Integration", "Transform", "Utilities"];

  const getCategoryIcon = (cat) => {
    switch (cat) {
      case "Extract and Process": return "🔄";
      case "Export": return "📤";
      case "Integration": return "🔗";
      case "Transform": return "🌳";
      case "Utilities": return "🛠";
      default: return "•";
    }
  };

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
          <div style={{ fontWeight:700, fontSize:15, marginBottom:10 }}>Add Step</div>
<input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes…"
            style={S.input}
            autoFocus
          />
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, marginTop:10 }}>
            {["starter", "advanced"].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={S.tab(tab === t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowY:"auto", flex:1, padding:"8px 0" }}>
          {groups.map(cat => {
            const nodes = filtered.filter(n => n.category === cat);
            if (!nodes.length) return null;
            return (
              <div key={cat}>
                <div style={{ fontSize:10, fontWeight:700, color:C.muted, padding:"10px 18px 4px", textTransform:"uppercase", letterSpacing:0.5 }}>
                  {getCategoryIcon(cat)} {cat}
                </div>
                {nodes.map(n => (
                    <button
                      key={n.node_type}
                      onClick={() => { onAdd(n); onClose(); }}
                      style={{
                        display:"block", width:"100%", textAlign:"left", padding:"9px 18px",
                        border:"none", background:"none", cursor:"pointer",
                        transition:"background 0.1s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#f5f5f5"; }}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}
                    >
                      <div style={{ fontWeight:600, fontSize:12, color:C.black }}>{n.icon} {n.label}</div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{n.desc}</div>
                    </button>
                ))}
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
