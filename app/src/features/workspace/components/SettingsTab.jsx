import { useState, useRef } from "react";
import { C, S, BICON, BEHAVIOR_LABELS } from "../../../platform/styles.jsx";

export default function SettingsTab({
  selNode, nodes, tableNames, nodePrompts, nodeSourceTables,
  setNodes, setTableNames, setNodePrompts, setNodeSourceTables,
  triggerSave, updateNodeTitle,
}) {
  const [titleHover, setTitleHover] = useState(false);
  const [tableNameWarning, setTableNameWarning] = useState(null);
  const warningTimeoutRef = useRef(null);
  const n = selNode;

  const isFirst = nodes.indexOf(n) === 0;
  const noTableInput = !n.requires_table_input;

  const upstreamTables = (() => {
    const tables = [];
    for (const x of nodes) {
      if (x.id === n.id) break;
      const name = tableNames[x.id]?.trim();
      if (name) tables.push(name);
    }
    return [...new Set(tables)];
  })();

  const MAX_INPUT_TABLES = 5;

  const getSourceTablesArray = (nodeId) => {
    const value = nodeSourceTables[nodeId];
    if (!value) return [""];
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.startsWith("[")) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return [value];
      }
    }
    return [value];
  };

  const sourceTablesArray = n.node_type === "ai_transformation" ? getSourceTablesArray(n.id) : [];
  const canAddMoreInputs = sourceTablesArray.length < MAX_INPUT_TABLES;

  // Helper function to generate unique table name
  const generateUniqueTableName = (baseName, currentNodeId) => {
    const trimmedName = baseName.trim();
    if (!trimmedName) return trimmedName;
    
    // Get all table names from other nodes
    const existingNames = Object.entries(tableNames)
      .filter(([nodeId, name]) => nodeId !== currentNodeId && name?.trim())
      .map(([_, name]) => name.trim());
    
    // Check if name already exists
    if (!existingNames.includes(trimmedName)) {
      return trimmedName;
    }
    
    // Generate unique name with counter
    let counter = 2;
    let uniqueName = `${trimmedName} (${counter})`;
    while (existingNames.includes(uniqueName)) {
      counter++;
      uniqueName = `${trimmedName} (${counter})`;
    }
    
    return uniqueName;
  };

  const renderUserForm = () => {
    if (!n.requires_file) return null;

    const fileTypeOptions = n.file_type_options || [
      { value: "pdf", label: "PDF" },
      { value: "spreadsheet", label: "Spreadsheet (XLSX, CSV)" },
      { value: "image", label: "Image (PNG, JPG, JPEG)" }
    ];
    const currentFileType = n.settings?.file_type || n.file_type || "pdf";
    const sheetName = n.settings?.sheet_name || n.sheet_name || "";

    return (
      <>
        <div style={S.sectionBar("#3b82f6")}>
          <span>📁</span> User Form
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={S.fieldRow}>
            <div style={S.label}>File Type</div>
            <select
              style={S.input}
              value={currentFileType}
              onChange={e => {
                setNodes(ns => ns.map(x => x.id === n.id
                  ? { ...x, settings: { ...x.settings, file_type: e.target.value } }
                  : x
                ));
                triggerSave();
              }}
            >
              {fileTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {currentFileType === "spreadsheet" && (
            <div style={S.fieldRow}>
              <div style={S.label}>
                Sheet Name
                <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>required</span>
              </div>
              <input
                style={S.input}
                placeholder="e.g. Sheet1"
                value={sheetName}
                onChange={e => {
                  setNodes(ns => ns.map(x => x.id === n.id
                    ? { ...x, settings: { ...x.settings, sheet_name: e.target.value } }
                    : x
                  ));
                  triggerSave();
                }}
              />
            </div>
          )}
        </div>
      </>
    );
  };

  const renderProcessingParams = () => {
    if (n.behavior === "basic_export" || n.behavior === "export") {
      const rawVal = nodePrompts[n.id] ?? "";
      const baseName = rawVal.endsWith(".xlsx") ? rawVal.slice(0, -5) : rawVal;
      return (
        <div style={{ marginBottom: 8 }}>
          <div style={S.fieldRow}>
            <div style={S.label}>File name</div>
            <div style={{ position: "relative" }}>
              <input
                style={{ ...S.input, paddingRight: baseName ? 46 : 10 }}
                placeholder="e.g. report"
                value={baseName}
                onChange={e => {
                  const base = e.target.value.replace(/\.xlsx$/i, "");
                  const stored = base ? `${base}.xlsx` : "";
                  setNodePrompts(p => ({ ...p, [n.id]: stored }));
                  triggerSave();
                }}
              />
              {baseName && (
                <span style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  fontSize: 11, color: C.muted, pointerEvents: "none", userSelect: "none",
                }}>
                  .xlsx
                </span>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (n.behavior === "ai_export") {
      const rawVal = nodePrompts[n.id] ?? "";
      const currentFormat = n.settings?.processing?.outputFormat || n.default_output_format || "json";
      const defaultExt = currentFormat === "xml" ? ".xml" : ".json";
      const defaultJsonPrompt = n.default_prompt_json || "";
      const defaultXmlPrompt = n.default_prompt_xml || "";
      
      const handleFormatChange = (newFormat) => {
        const newExt = newFormat === "xml" ? ".xml" : ".json";
        const currentFileName = n.settings?.processing?.file_name || "";
        const newFileName = currentFileName.replace(/\.[^.]+$/, "") + newExt;
        
        // Auto-update prompt if it's still the default for the old format
        const currentDefaultPrompt = currentFormat === "xml" ? defaultXmlPrompt : defaultJsonPrompt;
        const newDefaultPrompt = newFormat === "xml" ? defaultXmlPrompt : defaultJsonPrompt;
        
        // Check if current prompt matches the old format's default
        const isUsingDefaultPrompt = rawVal === currentDefaultPrompt || rawVal === "";
        
        setNodes(ns => ns.map(x => x.id === n.id
          ? { ...x, settings: { ...x.settings, processing: { ...x.settings?.processing, outputFormat: newFormat, file_name: newFileName } } }
          : x
        ));
        
        // If using default prompt, switch to new format's default
        if (isUsingDefaultPrompt && newDefaultPrompt) {
          setNodePrompts(p => ({ ...p, [n.id]: newDefaultPrompt }));
        }
        
        triggerSave();
      };
      
      return (
        <div style={{ marginBottom: 8 }}>
          <div style={S.fieldRow}>
            <div style={S.label}>Output Format</div>
            <select
              style={S.input}
              value={currentFormat}
              onChange={e => handleFormatChange(e.target.value)}
            >
              <option value="json">JSON</option>
              <option value="xml">XML</option>
            </select>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={S.fieldRow}>
              <div style={{ ...S.label, display: "flex", alignItems: "center", gap: 4 }}>
                {n.prompt_label || "Export Prompt"}
                <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700 }}>required</span>
              </div>
            </div>
            <textarea
              style={{ ...S.input, minHeight: 80, resize: "vertical" }}
              placeholder={n.prompt_placeholder || "Describe the output format (e.g. Export as nested JSON with 'records' as root array)"}
              value={rawVal}
              onChange={e => {
                setNodePrompts(p => ({ ...p, [n.id]: e.target.value }));
                triggerSave();
              }}
            />
          </div>
          <div style={{ marginTop: 4 }}>
            <div style={S.fieldRow}>
              <div style={S.label}>File name (optional)</div>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...S.input, paddingRight: 46 }}
                  placeholder="e.g. output"
                  value={n.settings?.processing?.file_name?.replace(/\.[^.]+$/, "") || ""}
                  onChange={e => {
                    const base = e.target.value.replace(/\.[^.]+$/, "");
                    setNodes(ns => ns.map(x => x.id === n.id
                      ? { ...x, settings: { ...x.settings, processing: { ...x.settings?.processing, file_name: base ? `${base}${defaultExt}` : "" } } }
                      : x
                    ));
                    triggerSave();
                  }}
                />
                <span style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  fontSize: 11, color: C.muted, pointerEvents: "none", userSelect: "none",
                }}>
                  {defaultExt}
                </span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const hasPrompt = n.requires_prompt || n.prompt_label;
    if (!hasPrompt) {
      return (
        <div style={{ color: C.muted, fontSize: 12, fontStyle: "italic", marginBottom: 8 }}>
          No processing parameters for this node.
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 8 }}>
        <div>
          <div style={S.fieldRow}>
            <div style={{ ...S.label, display: "flex", alignItems: "center", gap: 4 }}>
              {n.prompt_label ?? "Prompt"}
              {n.requires_prompt && (
                <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700 }}>required</span>
              )}
            </div>
            <textarea
              style={{ ...S.input, resize: "vertical", minHeight: 80, lineHeight: 1.5, fontFamily: "inherit" }}
              placeholder={n.prompt_placeholder ?? "Describe what you want…"}
              value={nodePrompts[n.id] ?? ""}
              onChange={e => {
                setNodePrompts(p => ({ ...p, [n.id]: e.target.value }));
                triggerSave();
              }}
            />
          </div>
          {n.requires_prompt && !nodePrompts[n.id]?.trim() && (
            <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
              A prompt is required before this node can run.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 2 }}>
        <div
          contentEditable
          suppressContentEditableWarning
          style={{
            fontWeight: 700,
            fontSize: 14,
            borderBottom: titleHover ? `2px solid ${C.black}` : "2px solid transparent",
            outline: "none",
            background: "transparent",
            padding: "6px 0",
            fontFamily: "inherit",
            transition: "border-color 0.15s ease",
            cursor: "text",
            minWidth: 20,
            display: "inline-block",
            whiteSpace: "pre",
          }}
          onMouseEnter={() => setTitleHover(true)}
          onMouseLeave={() => setTitleHover(false)}
          onBlur={e => {
            if (updateNodeTitle) {
              updateNodeTitle(n.id, e.target.innerText.slice(0, 40));
            }
          }}
        >
          {n.title || n.label}
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.muted, marginBottom: 16 }}>
        <span>{n.label}</span>
        <span style={{ margin: "0 6px", color: "#ccc" }}>•</span>
        <span>{BEHAVIOR_LABELS[n.behavior] || n.behavior}</span>
        <span style={{ marginLeft: 4, minWidth: 44, display: 'inline-block', textAlign: 'center', whiteSpace: 'nowrap' }}>{BICON[n.behavior]}</span>
      </div>

      {!noTableInput && (
        <>
          <div style={{ ...S.sectionBar("#22c55e"), opacity: isFirst ? 0.45 : 1 }}>
            <span>📊</span> Table Source
          </div>
          {isFirst ? (
            <div style={{ marginBottom: 8, opacity: 0.45 }}>
              <div style={{ ...S.input, background: "#f5f5f5", color: C.muted, fontStyle: "italic" }}>
                No upstream table exists yet.
              </div>
            </div>
          ) : upstreamTables.length > 0 ? (
            n.node_type === "ai_transformation" ? (
              <div style={{ marginBottom: 8 }}>
                {sourceTablesArray.map((tableValue, idx) => (
                  <div key={idx} style={{ ...S.fieldRow, marginBottom: 6 }}>
                    <div style={S.label}>{idx === 0 ? "Input tables" : ""}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      <select
                        style={{ ...S.input, flex: 1 }}
                        value={tableValue}
                        onChange={e => {
                          const newArray = [...sourceTablesArray];
                          newArray[idx] = e.target.value;
                          setNodeSourceTables(s => ({ ...s, [n.id]: newArray }));
                          triggerSave();
                        }}
                      >
                        <option value="">Select table...</option>
                        {upstreamTables.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {sourceTablesArray.length > 1 && (
                        <button
                          onClick={() => {
                            const newArray = sourceTablesArray.filter((_, i) => i !== idx);
                            setNodeSourceTables(s => ({ ...s, [n.id]: newArray }));
                            triggerSave();
                          }}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            fontSize: 16, color: "#ef4444", padding: "4px 8px"
                          }}
                          title="Remove input"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  {canAddMoreInputs ? (
                    <button
                      onClick={() => {
                        const newArray = [...sourceTablesArray, ""];
                        setNodeSourceTables(s => ({ ...s, [n.id]: newArray }));
                        triggerSave();
                      }}
                      style={{
                        background: "none", border: "1px dashed #ccc", borderRadius: 4,
                        padding: "4px 12px", fontSize: 12, cursor: "pointer", color: "#666"
                      }}
                    >
                      + Add Input
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: C.muted }}>Maximum {MAX_INPUT_TABLES} inputs</span>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 8 }}>
                <div style={S.fieldRow}>
                  <div style={S.label}>Input table</div>
                  <select
                    style={S.input}
                    value={nodeSourceTables[n.id] ?? upstreamTables[0]}
                    onChange={e => {
                      setNodeSourceTables(s => ({ ...s, [n.id]: e.target.value }));
                      triggerSave();
                    }}
                  >
                    {upstreamTables.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            )
          ) : (
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...S.input, background: "#f5f5f5", color: C.muted, fontStyle: "italic" }}>
                No upstream table exists yet
              </div>
            </div>
          )}
        </>
      )}

      {renderUserForm()}

      <div style={S.sectionBar("#f59e0b")}>
        <span>⚙️</span> Processing Parameters
      </div>
      {renderProcessingParams()}

      {(n.behavior !== "basic_export" && n.behavior !== "ai_export" && n.behavior !== "export") && (
        <>
          <div style={S.sectionBar("#8b5cf6")}>
            <span>📤</span> Table Output
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={S.fieldRow}>
              <div style={S.label}>Output mode</div>
              <select
                style={S.input}
                value={n.tableOutput?.mode ?? "create"}
                onChange={e => {
                  setNodes(ns => ns.map(x => x.id === n.id
                    ? { ...x, tableOutput: { ...x.tableOutput, mode: e.target.value } }
                    : x
                  ));
                  triggerSave();
                }}
              >
                <option value="create">Create new table</option>
                {(n.output_modes ?? ["create"]).includes("overwrite") && !isFirst && (
                  <option value="overwrite">Select existing table (overwrite)</option>
                )}
              </select>
            </div>
            <div style={S.fieldRow}>
              <div style={S.label}>Table name</div>
              {(n.tableOutput?.mode ?? "create") === "create" ? (
                <input
                  style={S.input}
                  placeholder="e.g. AI Extraction Output"
                  value={tableNames[n.id] ?? ""}
                  onChange={e => {
                    const value = e.target.value.replace(/_/g, ' ');
                    setTableNames(t => ({ ...t, [n.id]: value }));
                  }}
                  onBlur={e => {
                    const inputValue = e.target.value;
                    const uniqueName = generateUniqueTableName(inputValue, n.id);
                    if (uniqueName !== inputValue) {
                      setTableNames(t => ({ ...t, [n.id]: uniqueName }));
                      // Show warning that table name was auto-changed
                      const originalName = inputValue.trim();
                      setTableNameWarning(`${originalName} table already exists`);
                      // Clear previous timeout if exists
                      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
                      // Set new timeout to clear warning after 5 seconds
                      warningTimeoutRef.current = setTimeout(() => {
                        setTableNameWarning(null);
                      }, 5000);
                    } else {
                      // Clear warning if name is unique
                      setTableNameWarning(null);
                      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
                    }
                    triggerSave();
                  }}
                />
              ) : upstreamTables.length > 0 ? (
                <select style={S.input} onChange={triggerSave}>
                  {upstreamTables.map(t => <option key={t}>{t}</option>)}
                </select>
              ) : (
                <div style={{ ...S.input, background: "#f5f5f5", color: C.muted, fontStyle: "italic" }}>
                  No upstream table exists yet
                </div>
              )}
            </div>
            {(n.tableOutput?.mode ?? "create") === "create" && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                Spaces recommended (underscores will be auto-converted)
              </div>
            )}
            {n.table_name_hint && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                {n.table_name_hint}
              </div>
            )}
            {tableNameWarning && (
              <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontWeight: 500 }}>
                {tableNameWarning}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
