// ─────────────────────────────────────────────
// DESIGN TOKENS & SHARED STYLES
// ─────────────────────────────────────────────

export const C = {
  // colors
  black:  "#111",
  mid:    "#555",
  muted:  "#999",
  border: "#e0e0e0",
  bg:     "#fafafa",
  white:  "#fff",
  blue:   "#2563eb",
  green:  "#16a34a",
  amber:  "#d97706",
  red:    "#dc2626",
  purple: "#7c3aed",
};

export const S = {
  // layout helpers
  flex:   (gap=0) => ({ display:"flex", alignItems:"center", gap }),
  col:    (gap=0) => ({ display:"flex", flexDirection:"column", gap }),
  grow:   { flex:1 },
  // panels
  panel:  { borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", overflow:"hidden" },
  // typography
  h1:     { fontSize:24, fontWeight:700, color:C.black },
  h2:     { fontSize:16, fontWeight:700, color:C.black },
  h3:     { fontSize:13, fontWeight:700, color:C.black },
  small:  { fontSize:11, color:C.muted },
  label:  { fontSize:11, fontWeight:600, color:C.mid, marginBottom:3 },
  // buttons
  btnP:   { padding:"8px 18px", border:"none", borderRadius:5, background:C.black, color:C.white, fontSize:12, fontWeight:600, cursor:"pointer" },
  btnS:   { padding:"8px 18px", border:`1px solid ${C.border}`, borderRadius:5, background:C.white, color:C.black, fontSize:12, fontWeight:600, cursor:"pointer" },
  btnGhost: { padding:"4px 10px", border:"none", background:"none", color:C.muted, fontSize:11, cursor:"pointer" },
  // inputs
  input:  { width:"100%", padding:"7px 10px", border:`1px solid ${C.border}`, borderRadius:5, fontSize:12, boxSizing:"border-box", background:C.white },
  // tab
  tab:    (active) => ({
    flex:1, padding:"9px 0", textAlign:"center", fontSize:12, fontWeight:600, cursor:"pointer",
    color: active ? C.black : C.muted, background:"none", border:"none",
    borderBottom: active ? `2px solid ${C.black}` : `2px solid transparent`,
  }),
  modal: {
    background: C.white,
    borderRadius: 8,
    padding: 24,
    width: 360,
    boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
  },
  // node card
  nodeCard: (selected, executing, completed, error) => ({
    padding:"10px 12px", border: selected ? `2px solid ${C.black}` : `1px solid ${C.border}`,
    borderRadius:6, cursor:"pointer", fontSize:12, position:"relative",
    background: error ? "#fff1f1" : executing ? "#fffbeb" : completed ? "#f9fafb" : C.white,
    transition:"all 0.15s",
  }),
  // section bar
  sectionBar: (color) => ({
    fontSize:11, fontWeight:700, color:C.black, letterSpacing:0.3,
    padding:"8px 12px", marginTop:24, marginBottom:12, marginLeft:-20, marginRight:-20,
    background:"#f8f8f8", borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
    borderLeft:`3px solid ${color}`, paddingLeft:12,
    display:"flex", alignItems:"center", gap:6,
  }),
  fieldRow:   { marginBottom:10 },
  fieldValue: { padding:"7px 10px", background:"#f5f5f5", borderRadius:4, fontSize:12, color:"#333", whiteSpace:"pre-line", lineHeight:1.5 },
};

export const BICON = {
  // Legacy behavior types (for backward compatibility)
  input: "📥",
  interactive: "📝✨",
  auto: "⚡✨",
  export: "📤",

  // New behavior types
  basic_form: "📝",
  basic_go: "⚡",
  ai_form: "📝✨",
  ai_go: "⚡✨",
  basic_export: "📤",
  ai_export: "📤✨",
};

// User-friendly display names for behaviors
export const BEHAVIOR_LABELS = {
  basic_form: "Basic Form",
  basic_go: "Basic Go",
  ai_form: "AI Form",
  ai_go: "AI Go",
  basic_export: "Basic Export",
  ai_export: "AI Export",

  // Legacy mappings
  input: "Input",
  interactive: "AI Form",
  auto: "AI Go",
  export: "Basic Export",
  file_export: "Basic Export",
};
