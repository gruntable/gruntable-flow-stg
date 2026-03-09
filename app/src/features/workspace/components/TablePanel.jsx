import { useState, useRef, useEffect, Fragment, memo, useCallback } from "react";
import { C, S } from "../../../platform/styles.jsx";

// ─────────────────────────────────────────────
// TABLE PANEL — editable spreadsheet, multi-table tabs
// Right-side panel. Table data is lifted to Workspace.
// ─────────────────────────────────────────────

const COL_MIN_W = 100;
const COL_DEF_W = 140;
const ROW_H = 32;
const ROW_MIN_H = 28;
const INSERT_BTN_SIZE = 16;

function getCleanTableName(technicalName) {
  const match = technicalName.match(/^[\w-]+_[a-z0-9]+_(.+)$/); // Match pattern: project_{base36timestamp}_{table_name}
  return match ? match[1].replace(/_/g, ' ') : technicalName;
}

function CellEditor({ value, onCommit, onCancel }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const handleKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); onCommit(e.target.value); }
    if (e.key === "Escape") onCancel();
  };

  return (
    <input
      ref={ref}
      defaultValue={value}
      onBlur={e => onCommit(e.target.value)}
      onKeyDown={handleKey}
      style={{
        width: "100%", height: "100%", border: "none", outline: "none",
        padding: "0 6px", fontSize: 12, fontFamily: "inherit",
        background: "#fffde7", boxSizing: "border-box",
      }}
    />
  );
}

// ── single editable table ──
const TableView = memo(function TableView({ table, onChange }) {
  const { headers, rows } = table;
  // Debug: remove in production
  // console.log('[TableView] rows:', rows, '| rows[0] isArray:', Array.isArray(rows?.[0]));
  const [editing, setEditing] = useState(null); // {type:"header"|"cell", col, row}
  const [colWidths, setColWidths] = useState(() => headers.map(() => COL_DEF_W));
  const [rowHeights, setRowHeights] = useState(() => rows.map(() => ROW_H));
  const [hoverColGap, setHoverColGap] = useState(null); // index of gap BEFORE column ci
  const [hoverRowGap, setHoverRowGap] = useState(null); // index of gap BEFORE row ri
  const dragRef = useRef(null);

  // sync colWidths when columns change
  useEffect(() => {
    setColWidths(w => {
      if (w.length === headers.length) return w;
      if (headers.length > w.length) return [...w, ...Array(headers.length - w.length).fill(COL_DEF_W)];
      return w.slice(0, headers.length);
    });
  }, [headers.length]);

  // sync rowHeights when rows change
  useEffect(() => {
    setRowHeights(h => {
      if (h.length === rows.length) return h;
      if (rows.length > h.length) return [...h, ...Array(rows.length - h.length).fill(ROW_H)];
      return h.slice(0, rows.length);
    });
  }, [rows.length]);

  // ── mutations ──
  const setHeader = (col, val) =>
    onChange({ ...table, headers: headers.map((h, i) => i === col ? val : h) });

  const setCell = (row, col, val) => {
    const newRows = rows.map((r, ri) =>
      ri === row ? r.map((c, ci) => ci === col ? val : c) : r
    );
    onChange({ ...table, rows: newRows });
  };

  const addRow = () =>
    onChange({ ...table, rows: [...rows, headers.map(() => "")] });

  const addCol = () => {
    const newHeaders = [...headers, `Col ${headers.length + 1}`];
    const newRows = rows.map(r => [...r, ""]);
    onChange({ ...table, headers: newHeaders, rows: newRows });
    setColWidths(w => [...w, COL_DEF_W]);
  };

  const insertColAt = (ci) => {
    const newHeaders = [...headers.slice(0, ci), `Col ${ci + 1}`, ...headers.slice(ci)];
    const newRows = rows.map(r => [...r.slice(0, ci), "", ...r.slice(ci)]);
    onChange({ ...table, headers: newHeaders, rows: newRows });
    setColWidths(w => [...w.slice(0, ci), COL_DEF_W, ...w.slice(ci)]);
  };

  const insertRowAt = (ri) => {
    const newRows = [...rows.slice(0, ri), headers.map(() => ""), ...rows.slice(ri)];
    onChange({ ...table, rows: newRows });
  };

  const deleteRow = (ri) =>
    onChange({ ...table, rows: rows.filter((_, i) => i !== ri) });

  const deleteCol = (ci) => {
    const newHeaders = headers.filter((_, i) => i !== ci);
    const newRows = rows.map(r => r.filter((_, i) => i !== ci));
    onChange({ ...table, headers: newHeaders, rows: newRows });
    setColWidths(w => w.filter((_, i) => i !== ci));
  };

  // ── column resize drag ──
  const startResize = (e, ci) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = colWidths[ci];
    dragRef.current = { ci, startX, startW, type: "col" };

    const onMove = (ev) => {
      const delta = ev.clientX - dragRef.current.startX;
      const newW = Math.max(COL_MIN_W, dragRef.current.startW + delta);
      setColWidths(w => w.map((v, i) => i === dragRef.current.ci ? newW : v));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── row resize drag ──
  const startRowResize = (e, ri) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = rowHeights[ri];
    dragRef.current = { ri, startY, startH, type: "row" };

    const onMove = (ev) => {
      const delta = ev.clientY - dragRef.current.startY;
      const newH = Math.max(ROW_MIN_H, dragRef.current.startH + delta);
      setRowHeights(h => h.map((v, i) => i === dragRef.current.ri ? newH : v));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const stopEdit = () => setEditing(null);

  // total width: row-num col (40) + each data col + delete/add col (40)
  const totalW = colWidths.reduce((a, b) => a + b, 0) + 40 + 40;

  return (
    <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
      <table style={{
        borderCollapse: "collapse", fontSize: 12,
        minWidth: totalW, tableLayout: "fixed",
      }}>
        <colgroup>
          <col style={{ width: 40 }} />
          {headers.map((_, ci) => (
            <col key={ci} style={{ width: colWidths[ci] ?? COL_DEF_W }} />
          ))}
          <col style={{ width: 40 }} />
        </colgroup>

        <thead>
          <tr style={{ background: "#f0f0f0", userSelect: "none" }}>
            {/* corner */}
            <th style={thStyle("#f0f0f0")} />

            {headers.map((h, ci) => (
              <th
                key={ci}
                style={{ ...thStyle("#f0f0f0"), position: "relative", padding: 0, overflow: "visible" }}
                onMouseEnter={() => setHoverColGap(ci)}
                onMouseLeave={() => setHoverColGap(null)}
              >
                {/* insert-before button, shown on left border when hovering col ci > 0 */}
                {ci > 0 && hoverColGap === ci && (
                  <button
                    onClick={() => insertColAt(ci)}
                    style={{
                      position: "absolute", left: -(INSERT_BTN_SIZE / 2), top: "50%",
                      transform: "translateY(-50%)",
                      width: INSERT_BTN_SIZE, height: INSERT_BTN_SIZE,
                      borderRadius: "50%", border: `1.5px solid ${C.black}`,
                      background: C.white, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 11, fontWeight: 700, color: C.black, zIndex: 10,
                      lineHeight: 1, padding: 0,
                    }}
                  >+</button>
                )}
                <div style={{ display: "flex", alignItems: "stretch", height: ROW_H, overflow: "hidden", position: "relative" }}>
                  {/* editable header text */}
                  <div
                    style={{ flex: 1, display: "flex", alignItems: "center", overflow: "hidden" }}
                    onDoubleClick={() => setEditing({ type: "header", col: ci })}
                  >
                    {editing?.type === "header" && editing.col === ci ? (
                      <CellEditor
                        value={h}
                        onCommit={v => { setHeader(ci, v); stopEdit(); }}
                        onCancel={stopEdit}
                      />
                    ) : (
                      <span style={{
                        padding: "0 6px", fontWeight: 700, fontSize: 11,
                        color: C.mid, whiteSpace: "nowrap", overflow: "hidden",
                        textOverflow: "ellipsis", letterSpacing: 0.3,
                        textTransform: "uppercase", cursor: "text",
                      }}>
                        {h || `Col ${ci + 1}`}
                      </span>
                    )}
                  </div>
                  {/* delete column */}
                  <button
                    onClick={() => deleteCol(ci)}
                    title="Delete column"
                    style={{
                      border: "none", background: "none", cursor: "pointer",
                      color: "#bbb", fontSize: 11, padding: "0 5px", flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >×</button>
                  {/* resize handle */}
                  <div
                    onMouseDown={e => startResize(e, ci)}
                    onClick={e => e.stopPropagation()}
                    style={{
                      position: "absolute", right: 0, top: 0, bottom: 0,
                      width: 6, cursor: "col-resize", zIndex: 5,
                      background: "transparent",
                    }}
                  />
                </div>
              </th>
            ))}

            {/* delete-row col header: shows + add-col button */}
            <th style={{ ...thStyle("#f0f0f0"), textAlign: "center", padding: 0 }}>
              <button
                onClick={addCol}
                title="Add column"
                style={{
                  width: "100%", height: ROW_H, border: "none", background: "none",
                  cursor: "pointer", color: C.muted, fontSize: 14, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >+</button>
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, ri) => (
            <Fragment key={ri}>
              {/* ── inter-row insert gap ── */}
              {ri > 0 && (
                <tr
                  style={{ height: 0 }}
                  onMouseEnter={() => setHoverRowGap(ri)}
                  onMouseLeave={() => setHoverRowGap(null)}
                >
                  {/* row-number column: insert button */}
                  <td
                    style={{
                      height: 0, padding: 0, border: "none", position: "relative",
                      overflow: "visible",
                    }}
                  >
                    {hoverRowGap === ri && (
                      <button
                        onClick={(e) => { e.stopPropagation(); insertRowAt(ri); }}
                        style={{
                          position: "absolute", left: "50%", top: -(INSERT_BTN_SIZE / 2),
                          transform: "translateX(-50%)",
                          width: INSERT_BTN_SIZE, height: INSERT_BTN_SIZE,
                          borderRadius: "50%", border: `1.5px solid ${C.black}`,
                          background: C.white, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 11, fontWeight: 700, color: C.black, zIndex: 10,
                          lineHeight: 1, padding: 0,
                        }}
                      >+</button>
                    )}
                  </td>
                  {/* rest of columns: row resize handle - invisible hit area */}
                  <td
                    colSpan={headers.length + 1}
                    style={{
                      height: 0, padding: 0, border: "none", position: "relative",
                    }}
                    onMouseDown={e => startRowResize(e, ri - 1)}
                  >
                    <div
                      style={{
                        position: "absolute", left: 0, right: 0, top: -2,
                        height: 4, cursor: "row-resize", zIndex: 3,
                      }}
                    />
                  </td>
                </tr>
              )}

              <tr
                key={ri}
                style={{ background: ri % 2 === 0 ? C.white : "#fafafa", height: rowHeights[ri] }}
              >
                {/* row number */}
                <td style={{ ...tdStyle, textAlign: "center", color: C.muted, fontWeight: 600, fontSize: 11, background: "#f7f7f7", userSelect: "none", height: rowHeights[ri] }}>
                  {ri + 1}
                </td>

                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    style={{ ...tdStyle, padding: 0, cursor: "text", position: "relative", overflow: "visible", height: rowHeights[ri] }}
                    onDoubleClick={() => setEditing({ type: "cell", row: ri, col: ci })}
                  >
                    {/* resize handle for column - appears on right edge */}
                    <div
                      onMouseDown={e => startResize(e, ci)}
                      onClick={e => e.stopPropagation()}
                      style={{
                        position: "absolute", right: 0, top: 0, bottom: 0,
                        width: 6, cursor: "col-resize", zIndex: 1,
                        background: "transparent",
                      }}
                    />
                    {editing?.type === "cell" && editing.row === ri && editing.col === ci ? (
                      <CellEditor
                        value={cell}
                        onCommit={v => { setCell(ri, ci, v); stopEdit(); }}
                        onCancel={stopEdit}
                      />
                    ) : (
                      <div style={{
                        padding: "0 6px", height: rowHeights[ri], lineHeight: `${rowHeights[ri]}px`,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {cell}
                      </div>
                    )}
                  </td>
                ))}

                {/* delete row */}
                <td style={{ ...tdStyle, textAlign: "center", padding: 0, height: rowHeights[ri] }}>
                  <button
                    onClick={() => deleteRow(ri)}
                    title="Delete row"
                    style={{
                      border: "none", background: "none", cursor: "pointer",
                      color: "#bbb", fontSize: 12, width: "100%", height: "100%",
                      lineHeight: 1,
                    }}
                  >×</button>
                </td>
              </tr>
            </Fragment>
          ))}

          {/* Empty state */}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={headers.length + 2}
                style={{ textAlign: "center", padding: 32, color: C.muted, fontSize: 12 }}
              >
                No rows yet
              </td>
            </tr>
          )}

          {/* + Row — in row-number column only */}
          <tr>
            <td
              style={{ padding: 0, border: "none", borderTop: `1px solid ${C.border}` }}
            >
              <button
                onClick={addRow}
                title="Add row"
                style={{
                  width: "100%", height: 28, border: "none", background: "none",
                  cursor: "pointer", color: C.muted, fontSize: 13, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >+</button>
            </td>
            <td colSpan={headers.length + 1} style={{ border: "none", borderTop: `1px solid ${C.border}` }} />
          </tr>
        </tbody>
      </table>
    </div>
  );
});

// ── main panel with tab bar ──
const TablePanel = memo(function TablePanel({ tables, activeTable, onChangeActive, onChangeTable }) {
  // tables: { [name]: { headers, rows } }
  // activeTable: string | null
  // onChangeActive: (name) => void
  // onChangeTable: (name, tableData) => void

  const names = Object.keys(tables);
  const current = activeTable && tables[activeTable] ? activeTable : names[0];
  const table = tables[current];
  


  const handleTableChange = useCallback((data) => {
    onChangeTable(current, data);
  }, [current, onChangeTable]);

  if (names.length === 0) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", height: "100%",
        borderLeft: `1px solid ${C.border}`, background: C.bg,
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", maxWidth: 200, lineHeight: 1.6 }}>
          No tables yet.<br />Run a node to generate output here.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      borderLeft: `1px solid ${C.border}`, background: C.white, minWidth: 0,
    }}>
      {/* Tab bar — left-aligned */}
      <div style={{
        display: "flex", alignItems: "flex-end",
        borderBottom: `1px solid ${C.border}`,
        background: C.bg, flexShrink: 0, overflowX: "auto",
        paddingLeft: 8,
      }}>
        {names.map(name => {
          const active = name === current;
          return (
            <button
              key={name}
              onClick={() => onChangeActive(name)}
              style={{
                flexShrink: 0,
                padding: "8px 14px",
                fontSize: 12, fontWeight: active ? 700 : 400,
                color: active ? C.black : C.muted,
                background: "none", border: "none", cursor: "pointer",
                borderBottom: active ? `2px solid ${C.black}` : "2px solid transparent",
                whiteSpace: "nowrap",
              }}
            >
              {getCleanTableName(name)}
            </button>
          );
        })}
      </div>

      {/* Stats bar */}
      <div style={{
        ...S.flex(6), padding: "4px 12px",
        borderBottom: `1px solid ${C.border}`,
        background: C.bg, flexShrink: 0,
        fontSize: 11, color: C.muted,
      }}>
        <span>{table.rows.length} row{table.rows.length !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span>{table.headers.length} col{table.headers.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <TableView
        table={table}
        onChange={handleTableChange}
      />

      {/* Footer hint */}
      <div style={{
        padding: "5px 12px", borderTop: `1px solid ${C.border}`,
        fontSize: 10, color: C.muted, background: C.bg, flexShrink: 0,
      }}>
        Double-click to edit · Drag column/row edges to resize · Hover between cols/rows to insert
      </div>
    </div>
  );
});

export default TablePanel;

const thStyle = (bg) => ({
  height: ROW_H, borderBottom: `2px solid ${C.border}`,
  borderRight: `1px solid ${C.border}`, background: bg,
  textAlign: "left", fontWeight: 700, overflow: "hidden",
  position: "sticky", top: 0, zIndex: 2,
});

const tdStyle = {
  height: "auto", borderBottom: `1px solid ${C.border}`,
  borderRight: `1px solid ${C.border}`, overflow: "hidden",
};
