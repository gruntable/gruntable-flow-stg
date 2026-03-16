import { useState, useRef, useEffect } from "react";
import { C, S, BICON, BEHAVIOR_LABELS } from "../../../platform/styles.jsx";
import { listTables, deleteTable } from "../../../services/table.js";

// Helper function to sanitize table name
const sanitizeTableName = (name) => {
  return name.trim();
};

// Find existing table with case-insensitive matching
const findExistingTable = (inputName, existingTables) => {
  const sanitizedInput = sanitizeTableName(inputName);
  if (!sanitizedInput) return null;
  
  // Case-insensitive search
  return existingTables.find(t => t.toLowerCase() === sanitizedInput.toLowerCase());
};

// Check if table name is new (doesn't exist in database)
const isNewTable = (inputName, existingTables) => {
  const sanitizedInput = sanitizeTableName(inputName);
  if (!sanitizedInput) return false;
  
  // Strict character matching - case-insensitive only
  return !existingTables.some(t => t.toLowerCase() === sanitizedInput.toLowerCase());
};

// Generic Text Input Component with proper undo/redo support
function UndoableInput({ value, onChange, saveToHistory, triggerSave, placeholder, style, type = "input" }) {
  const [localValue, setLocalValue] = useState(value);
  const isTypingRef = useRef(false);
  
  // Sync with external changes (undo/redo) when not typing
  useEffect(() => {
    if (!isTypingRef.current) {
      setLocalValue(value);
    }
  }, [value]);
  
  const handleBlur = (e) => {
    isTypingRef.current = false;
    saveToHistory?.();
    onChange(e.target.value);
    triggerSave?.();
  };
  
  const commonProps = {
    style: style || S.input,
    placeholder,
    value: localValue,
    onChange: (e) => {
      isTypingRef.current = true;
      setLocalValue(e.target.value);
    },
    onBlur: handleBlur
  };
  
  return type === "textarea" 
    ? <textarea {...commonProps} />
    : <input {...commonProps} />;
}

// Prompt TextArea Component (legacy - uses UndoableInput internally)
function PromptTextArea({ node, nodePrompts, setNodePrompts, saveToHistory, triggerSave }) {
  return (
    <UndoableInput
      type="textarea"
      style={{ ...S.input, resize: "vertical", minHeight: 120, lineHeight: 1.5, fontFamily: "inherit" }}
      placeholder={node.prompt_placeholder ?? "Describe what you want…"}
      value={nodePrompts[node.id] ?? ""}
      onChange={val => setNodePrompts(p => ({ ...p, [node.id]: val }))}
      saveToHistory={saveToHistory}
      triggerSave={triggerSave}
    />
  );
}

// Table Name Combobox Component
function TableNameCombobox({
  node,
  tableNames,
  setTableNames,
  allTables,
  triggerSave,
  setTableNameWarning,
  warningTimeoutRef,
  generateUniqueTableName,
  setNodes,
  onDeleteTable,
  onRefresh,
  saveToHistory
}) {
  const [inputValue, setInputValue] = useState(tableNames[node.id] || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const justSelectedRef = useRef(false);
  const isTypingRef = useRef(false);
  
  // Sync with external changes (undo/redo) when not typing
  useEffect(() => {
    if (!isTypingRef.current) {
      setInputValue(tableNames[node.id] || "");
    }
  }, [node.id, tableNames[node.id]]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  const currentName = sanitizeTableName(inputValue);
  const isExisting = currentName && !isNewTable(currentName, allTables);
  const matchingTable = isExisting ? findExistingTable(currentName, allTables) : null;
  
  // Filter suggestions based on input
  const getSuggestions = () => {
    const sanitized = sanitizeTableName(inputValue);
    if (!sanitized) return allTables.slice(0, 10); // Show first 10 if empty
    
    const filtered = allTables.filter(t => 
      t.toLowerCase().includes(sanitized.toLowerCase())
    );
    return filtered.slice(0, 10); // Limit to 10 suggestions
  };
  
  const suggestions = getSuggestions();
  const showNewOption = currentName && isNewTable(currentName, allTables);
  
  const handleInputChange = (e) => {
    const value = e.target.value;
    isTypingRef.current = true;
    setInputValue(value);
    setShowDropdown(true);
    setHighlightedIndex(-1);
    
    // Check if it would be a new table (for UI purposes only)
    const existingMatch = findExistingTable(value, allTables);
    setNodes(ns => ns.map(x => x.id === node.id
      ? { ...x, tableOutput: { ...x.tableOutput, isNewTable: !existingMatch } }
      : x
    ));
  };
  
  const handleSelectExisting = (tableName) => {
    justSelectedRef.current = true;
    setInputValue(tableName);
    setTableNames(t => ({ ...t, [node.id]: tableName }));
    setNodes(ns => ns.map(x => x.id === node.id
      ? { ...x, tableOutput: { ...x.tableOutput, isNewTable: false } }
      : x
    ));
    setShowDropdown(false);
    triggerSave();
  };
  
  const handleSelectNew = () => {
    justSelectedRef.current = true;
    const sanitized = sanitizeTableName(inputValue);
    // Generate unique name if conflict with other nodes
    const uniqueName = generateUniqueTableName(sanitized, node.id);
    
    if (uniqueName !== sanitized) {
      setInputValue(uniqueName);
      setTableNames(t => ({ ...t, [node.id]: uniqueName }));
      setTableNameWarning(`${sanitized} table already exists in this workflow`);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = setTimeout(() => {
        setTableNameWarning(null);
      }, 5000);
    } else {
      setTableNames(t => ({ ...t, [node.id]: sanitized }));
      setTableNameWarning(null);
    }
    
    setNodes(ns => ns.map(x => x.id === node.id
      ? { ...x, tableOutput: { ...x.tableOutput, isNewTable: true } }
      : x
    ));
    setShowDropdown(false);
    triggerSave();
  };
  
  const handleKeyDown = (e) => {
    const totalOptions = suggestions.length + (showNewOption ? 1 : 0);
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % totalOptions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + totalOptions) % totalOptions);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelectExisting(suggestions[highlightedIndex]);
      } else if (showNewOption && highlightedIndex === suggestions.length) {
        handleSelectNew();
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };
  
  const handleBlur = () => {
    // Mark that user is done typing
    isTypingRef.current = false;
    
    // Save history BEFORE any state changes, so we capture the old state
    saveToHistory?.();
    
    // Delay to allow click on dropdown items
    setTimeout(() => {
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }
      // Trim leading and trailing spaces
      const trimmed = inputValue.trim();
      
      if (trimmed) {
        // Check for case-insensitive match with existing table
        const existingMatch = findExistingTable(trimmed, allTables);
        if (existingMatch) {
          // Auto-select the existing table (preserve original casing)
          setInputValue(existingMatch);
          setTableNames(t => ({ ...t, [node.id]: existingMatch }));
          setNodes(ns => ns.map(x => x.id === node.id
            ? { ...x, tableOutput: { ...x.tableOutput, isNewTable: false } }
            : x
          ));
        } else {
          // Generate unique name if conflict with other nodes
          const uniqueName = generateUniqueTableName(trimmed, node.id);
          setInputValue(uniqueName);
          setTableNames(t => ({ ...t, [node.id]: uniqueName }));
          setNodes(ns => ns.map(x => x.id === node.id
            ? { ...x, tableOutput: { ...x.tableOutput, isNewTable: true } }
            : x
          ));
          
          if (uniqueName !== trimmed) {
            setTableNameWarning(`${trimmed} table already exists in this workflow`);
            if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
            warningTimeoutRef.current = setTimeout(() => {
              setTableNameWarning(null);
            }, 5000);
          } else {
            setTableNameWarning(null);
          }
        }
      } else {
        // Empty value - just update with trimmed version
        setInputValue(trimmed);
        setTableNames(t => ({ ...t, [node.id]: trimmed }));
      }
      
      setShowDropdown(false);
      triggerSave();
    }, 200);
  };

  return (
    <div style={S.fieldRow}>
      <div style={S.label}>
        Table name
        <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>required</span>
      </div>
      <div style={{ position: "relative" }} ref={dropdownRef}>
        <input
          ref={inputRef}
          style={S.input}
          placeholder="e.g. AI Extraction Output"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            setShowDropdown(true);
            onRefresh?.();
          }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        
        {showDropdown && (suggestions.length > 0 || showNewOption) && (
          <div style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            border: `1px solid ${C.border}`,
            borderRadius: 4,
            marginTop: 4,
            maxHeight: 200,
            overflowY: "auto",
            zIndex: 1000,
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
          }}>
            {suggestions.map((table, index) => (
              <div
                key={table}
                style={{
                  display: "flex", alignItems: "center",
                  background: highlightedIndex === index ? "#f3f4f6" : "transparent",
                  borderBottom: "1px solid #f3f4f6",
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div
                  onClick={() => handleSelectExisting(table)}
                  style={{ flex: 1, padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
                >
                  {table}
                </div>
                {onDeleteTable && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteTable(table); }}
                    style={{
                      padding: "4px 10px", background: "none", border: "none",
                      cursor: "pointer", color: "#ef4444", fontSize: 14, flexShrink: 0,
                    }}
                    title="Delete table"
                  >🗑</button>
                )}
              </div>
            ))}
            
            {showNewOption && (
              <div
                onClick={handleSelectNew}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  background: highlightedIndex === suggestions.length ? "#f3f4f6" : "transparent",
                  borderTop: suggestions.length > 0 ? "1px solid #e5e7eb" : "none",
                  fontSize: 13,
                  color: "#2563eb",
                  fontWeight: 500
                }}
                onMouseEnter={() => setHighlightedIndex(suggestions.length)}
              >
                + Create "{sanitizeTableName(inputValue)}"
              </div>
            )}
          </div>
        )}
      </div>
      
      {!currentName && (
        <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
          Output table name is required before running
        </div>
      )}
      <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
        Type a new name or select from existing tables (case-insensitive)
      </div>
    </div>
  );
}

// Custom dropdown for selecting an input table (with per-row delete button)
function TableSelectDropdown({ value, allTables, onChange, onDeleteTable, placeholder, onRefresh }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <div
        onClick={() => {
          setOpen(o => !o);
          onRefresh?.();
        }}
        style={{
          ...S.input,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", userSelect: "none",
          color: value ? "inherit" : "#aaa",
        }}
      >
        <span>{value || placeholder || "Select table..."}</span>
        <span style={{ fontSize: 10, color: "#aaa" }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          background: "white", border: `1px solid ${C.border}`,
          borderRadius: 4, marginTop: 4, maxHeight: 200,
          overflowY: "auto", zIndex: 1000,
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
        }}>
          <div
            onClick={() => { onChange(""); setOpen(false); }}
            style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, color: "#aaa", borderBottom: "1px solid #f3f4f6" }}
          >
            -- Select table --
          </div>
          {allTables.map(table => (
            <div key={table} style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #f3f4f6" }}>
              <div
                onClick={() => { onChange(table); setOpen(false); }}
                style={{ flex: 1, padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
              >
                {table}
              </div>
              {onDeleteTable && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDeleteTable(table); }}
                  style={{
                    padding: "4px 10px", background: "none", border: "none",
                    cursor: "pointer", color: "#ef4444", fontSize: 14, flexShrink: 0,
                  }}
                  title="Delete table"
                >🗑</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Conflict Mode Radio Component
function ConflictModeRadio({ node, tableNames, allTables, setNodes, triggerSave }) {
  const currentName = sanitizeTableName(tableNames[node.id] || "");
  const isNew = currentName && isNewTable(currentName, allTables);
  const isExisting = currentName && !isNew;
  const conflictMode = node.tableOutput?.conflictMode;
  
  // Don't show if no table name entered
  if (!currentName) return null;
  
  const handleChange = (mode) => {
    setNodes(ns => ns.map(x => x.id === node.id
      ? { ...x, tableOutput: { ...x.tableOutput, conflictMode: mode } }
      : x
    ));
    triggerSave();
  };
  
  return (
    <div style={{ ...S.fieldRow, marginTop: 12 }}>
      <div style={S.label}>
        If table exists
        <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>required</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0" }}>
        {[
          { value: "overwrite", label: "Overwrite", sub: "replace all data" },
          { value: "append",    label: "Append",    sub: "add rows" },
        ].map(({ value, label, sub }) => {
          const selected = conflictMode === value;
          return (
            <label key={value} style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
            }}>
              <input
                type="radio"
                name={`conflict-${node.id}`}
                value={value}
                checked={selected}
                onChange={() => handleChange(value)}
              />
              <span>
                <span style={{ fontWeight: 500, fontSize: 12 }}>{label}</span>
                <span style={{ color: C.muted, fontSize: 11, marginLeft: 4 }}>({sub})</span>
              </span>
            </label>
          );
        })}
      </div>
      
      {!conflictMode && (
        <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
          Select "Overwrite" or "Append" before running
        </div>
      )}
      
      {isNew && conflictMode && (
        <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
          New table will be created — {conflictMode === "overwrite" ? "Replace" : "Append"} setting will apply on subsequent runs
        </div>
      )}
    </div>
  );
}

export default function SettingsTab({
  selNode, nodes, tableNames, nodePrompts, nodeSourceTables,
  setNodes, setTableNames, setNodePrompts, setNodeSourceTables,
  triggerSave, updateNodeTitle, saveToHistory,
}) {
  const [titleHover, setTitleHover] = useState(false);
  const [tableNameWarning, setTableNameWarning] = useState(null);
  const [dbTables, setDbTables] = useState([]);
  const warningTimeoutRef = useRef(null);
  const n = selNode;

  const refreshTables = () => {
    listTables().then(data => setDbTables(data.tables || [])).catch(() => {});
  };

  const handleDeleteTable = async (tableName) => {
    if (!window.confirm(`Delete table "${tableName}"? This cannot be undone.`)) return;
    await deleteTable(tableName);
    refreshTables();
  };

  useEffect(() => {
    listTables()
      .then(data => {
        const tables = data.tables || [];
        setDbTables(tables);
      })
      .catch(err => {
        console.error('Failed to fetch DB tables:', err);
        setDbTables([]);
      });
  }, []);

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

  const allTables = [...new Set([...upstreamTables, ...dbTables])];

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
                saveToHistory?.();
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
              <UndoableInput
                style={S.input}
                placeholder="e.g. Sheet1"
                value={sheetName}
                onChange={val => setNodes(ns => ns.map(x => x.id === n.id
                  ? { ...x, settings: { ...x.settings, sheet_name: val } }
                  : x
                ))}
                saveToHistory={saveToHistory}
                triggerSave={triggerSave}
              />
              {!sheetName?.trim() && (
                <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                  Sheet name is required for spreadsheet files
                </div>
              )}
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
            <div style={S.label}>
              File name
              <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>required</span>
            </div>
            <div style={{ position: "relative" }}>
              <UndoableInput
                style={{ ...S.input, paddingRight: baseName ? 46 : 10 }}
                placeholder="e.g. report"
                value={baseName}
                onChange={val => {
                  const base = val.replace(/\.xlsx$/i, "");
                  const stored = base ? `${base}.xlsx` : "";
                  setNodePrompts(p => ({ ...p, [n.id]: stored }));
                }}
                saveToHistory={saveToHistory}
                triggerSave={triggerSave}
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
          {!rawVal?.trim() && (
            <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
              File name is required before running
            </div>
          )}
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
        saveToHistory?.();
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
            <UndoableInput
              type="textarea"
              style={{ ...S.input, minHeight: 120, resize: "vertical" }}
              placeholder={n.prompt_placeholder || "Describe the output format (e.g. Export as nested JSON with 'records' as root array)"}
              value={rawVal}
              onChange={val => setNodePrompts(p => ({ ...p, [n.id]: val }))}
              saveToHistory={saveToHistory}
              triggerSave={triggerSave}
            />
          </div>
          <div style={{ marginTop: 4 }}>
            <div style={S.fieldRow}>
              <div style={S.label}>
                File name
                <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>required</span>
              </div>
              <div style={{ position: "relative" }}>
                <UndoableInput
                  style={{ ...S.input, paddingRight: 46 }}
                  placeholder="e.g. output"
                  value={n.settings?.processing?.file_name?.replace(/\.[^.]+$/, "") || ""}
                  onChange={val => {
                    const base = val.replace(/\.[^.]+$/, "");
                    setNodes(ns => ns.map(x => x.id === n.id
                      ? { ...x, settings: { ...x.settings, processing: { ...x.settings?.processing, file_name: base ? `${base}${defaultExt}` : "" } } }
                      : x
                    ));
                  }}
                  saveToHistory={saveToHistory}
                  triggerSave={triggerSave}
                />
                <span style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  fontSize: 11, color: C.muted, pointerEvents: "none", userSelect: "none",
                }}>
                  {defaultExt}
                </span>
              </div>
            </div>
            {!n.settings?.processing?.file_name?.trim() && (
              <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                File name is required before running
              </div>
            )}
          </div>
        </div>
      );
    }

    const currentFileType = n.settings?.file_type || n.file_type || "pdf";
    const showExtractionMode = n.requires_file && currentFileType === "pdf";
    const currentExtractionMode = n.settings?.processing?.extractionMode || n.extraction_mode || "per_page";
    const modeOptions = n.extraction_mode_options || [
      { value: "per_page", label: "Per Page" },
      { value: "per_file", label: "Per File" },
    ];

    const hasPrompt = n.requires_prompt || n.prompt_label;
    if (!hasPrompt && !showExtractionMode) {
      return (
        <div style={{ color: C.muted, fontSize: 12, fontStyle: "italic", marginBottom: 8 }}>
          No processing parameters for this node.
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 8 }}>
        {showExtractionMode && (
          <div style={{ marginBottom: 12 }}>
            <div style={S.fieldRow}>
              <div style={S.label}>Extraction Mode</div>
              <select
                style={S.input}
                value={currentExtractionMode}
                onChange={e => {
                  setNodes(ns => ns.map(x => x.id === n.id
                    ? { ...x, settings: { ...x.settings, processing: { ...x.settings?.processing, extractionMode: e.target.value } } }
                    : x
                  ));
                  triggerSave();
                  saveToHistory?.();
                }}
              >
                {modeOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
              {currentExtractionMode === "per_file"
                ? "Sends the entire PDF to Gemini in one call. Best for short, coherent documents."
                : "Splits the PDF into pages and sends one Gemini call per page. Best for long documents."}
            </div>
          </div>
        )}
        {hasPrompt && (
          <div>
            <div style={S.fieldRow}>
              <div style={{ ...S.label, display: "flex", alignItems: "center", gap: 4 }}>
                {n.prompt_label ?? "Prompt"}
                {n.requires_prompt && (
                  <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700 }}>required</span>
                )}
              </div>
              <PromptTextArea
                node={n}
                nodePrompts={nodePrompts}
                setNodePrompts={setNodePrompts}
                saveToHistory={saveToHistory}
                triggerSave={triggerSave}
              />
            </div>
            {n.requires_prompt && !nodePrompts[n.id]?.trim() && (
              <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                A prompt is required before this node can run.
              </div>
            )}
          </div>
        )}
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
            saveToHistory?.();
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
          <div style={S.sectionBar("#22c55e")}>
            <span>📊</span> Table Source
          </div>
          {allTables.length > 0 ? (
            n.node_type === "ai_transformation" ? (
              <div style={{ marginBottom: 8 }}>
                {sourceTablesArray.map((tableValue, idx) => (
                  <div key={idx} style={{ ...S.fieldRow, marginBottom: 6 }}>
                    <div style={S.label}>{idx === 0 ? "Input tables" : ""}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                      <div style={{ flex: 1 }}>
                        <TableSelectDropdown
                          value={tableValue}
                          allTables={allTables}
                          onChange={val => {
                            const newArray = [...sourceTablesArray];
                            newArray[idx] = val;
                            setNodeSourceTables(s => ({ ...s, [n.id]: newArray }));
                            triggerSave();
                            saveToHistory?.();
                          }}
                          onDeleteTable={handleDeleteTable}
                          placeholder="Select table..."
                          onRefresh={refreshTables}
                        />
                      </div>
                      {sourceTablesArray.length > 1 && (
                        <button
                          onClick={() => {
                            const newArray = sourceTablesArray.filter((_, i) => i !== idx);
                            setNodeSourceTables(s => ({ ...s, [n.id]: newArray }));
                            triggerSave();
                            saveToHistory?.();
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
                {!sourceTablesArray.some(t => t?.trim()) && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                    At least one input table is required
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  {canAddMoreInputs ? (
                    <button
                      onClick={() => {
                        const newArray = [...sourceTablesArray, ""];
                        setNodeSourceTables(s => ({ ...s, [n.id]: newArray }));
                        triggerSave();
                        saveToHistory?.();
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
                  <div style={S.label}>
                    Input table
                    <span style={{ color: "#ef4444", fontSize: 10, fontWeight: 700, marginLeft: 4 }}>required</span>
                  </div>
                  <TableSelectDropdown
                    value={nodeSourceTables[n.id] || ""}
                    allTables={allTables}
                    onChange={val => {
                      setNodeSourceTables(s => ({ ...s, [n.id]: val }));
                      triggerSave();
                      saveToHistory?.();
                    }}
                    onDeleteTable={handleDeleteTable}
                    placeholder="-- Select input table --"
                    onRefresh={refreshTables}
                  />
                </div>
                {!nodeSourceTables[n.id]?.trim() && (
                  <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>
                    Select an input table before running
                  </div>
                )}
              </div>
            )
          ) : (
            <div style={{ marginBottom: 8 }}>
              <div style={{ ...S.input, background: "#f5f5f5", color: C.muted, fontStyle: "italic" }}>
                No tables available in database
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
            <TableNameCombobox
              node={n}
              tableNames={tableNames}
              setTableNames={setTableNames}
              allTables={allTables}
              triggerSave={triggerSave}
              setTableNameWarning={setTableNameWarning}
              warningTimeoutRef={warningTimeoutRef}
              generateUniqueTableName={generateUniqueTableName}
              setNodes={setNodes}
              onDeleteTable={handleDeleteTable}
              onRefresh={refreshTables}
              saveToHistory={saveToHistory}
            />
            
            <ConflictModeRadio
              node={n}
              tableNames={tableNames}
              allTables={allTables}
              setNodes={setNodes}
              triggerSave={triggerSave}
            />
            
            {tableNameWarning && (
              <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4, fontWeight: 500 }}>
                {tableNameWarning}
              </div>
            )}
            {n.table_name_hint && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>
                {n.table_name_hint}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
