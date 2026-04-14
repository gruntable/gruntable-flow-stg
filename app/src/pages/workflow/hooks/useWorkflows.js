import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  createWorkflow,
  normalizeName,
  normalizeWorkflowMetadata,
  serializeWorkflowMetadata,
  makeId,
} from "../utils/workflow-metadata.js";
import { saveWorkflow, listWorkflows, deleteWorkflow as deleteWorkflowApi } from "../services/workflowApi.js";
import { getUserId } from "../services/user.js";

export default function useWorkflows({ initialWorkflowId, localWorkflow } = {}) {
  const [workflows, setWorkflows] = useState([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState(() => {
    return initialWorkflowId ?? null;
  });
  const [isLoading, setIsLoading] = useState(true);

  const activeWorkflow = workflows.find((w) => w.id === activeWorkflowId) ?? workflows[0];
  const nodes = activeWorkflow?.nodes ?? [];
  const tableNames = activeWorkflow?.tableNames ?? {};
  const nodePrompts = activeWorkflow?.nodePrompts ?? {};
  const nodeSourceTables = activeWorkflow?.nodeSourceTables ?? {};
  const editMode = activeWorkflow?.editMode ?? true;

  const [showWorkflowMenu, setShowWorkflowMenu] = useState(false);
  const [workflowEditMode, setWorkflowEditMode] = useState(false);
  const [flowNotice, setFlowNotice] = useState("");
  const [flowNoticeTone, setFlowNoticeTone] = useState("neutral");
  const [accessDenied, setAccessDenied] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [saveTime, setSaveTime] = useState(null);
  const [isUsingLocalStorage, setIsUsingLocalStorage] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const importInputRef = useRef(null);
  const workflowMenuRef = useRef(null);
  const isMounted = useRef(true);
  const recentLocalWorkflowIdRef = useRef(null);

  // Undo/redo history state
  const [historyStack, setHistoryStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  const triggerSave = () => setSaveStatus("saving");

  // Helper to save current workflow state to history before mutation
  const saveToHistory = useCallback(() => {
    const currentWorkflow = workflows.find((w) => w.id === activeWorkflowId);
    if (!currentWorkflow) return;
    
    setHistoryStack(prev => {
      const snapshot = JSON.parse(JSON.stringify(currentWorkflow));
      // Keep history limit to prevent memory issues (max 50 snapshots)
      const newStack = [...prev, snapshot].slice(-50);
      return newStack;
    });
    setRedoStack([]); // Clear redo stack on new action
  }, [workflows, activeWorkflowId]);

  const undo = useCallback(() => {
    if (historyStack.length === 0) return;
    
    const currentWorkflow = workflows.find((w) => w.id === activeWorkflowId);
    const previousSnapshot = historyStack[historyStack.length - 1];
    
    setRedoStack(prev => {
      if (!currentWorkflow) return prev;
      return [...prev, JSON.parse(JSON.stringify(currentWorkflow))];
    });
    
    setHistoryStack(prev => prev.slice(0, -1));
    
    setWorkflows(prev => prev.map(w =>
      w.id === activeWorkflowId ? JSON.parse(JSON.stringify(previousSnapshot)) : w
    ));
  }, [historyStack, workflows, activeWorkflowId]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    
    const currentWorkflow = workflows.find((w) => w.id === activeWorkflowId);
    const nextSnapshot = redoStack[redoStack.length - 1];
    
    setHistoryStack(prev => {
      if (!currentWorkflow) return prev;
      return [...prev, JSON.parse(JSON.stringify(currentWorkflow))];
    });
    
    setRedoStack(prev => prev.slice(0, -1));
    
    setWorkflows(prev => prev.map(w =>
      w.id === activeWorkflowId ? JSON.parse(JSON.stringify(nextSnapshot)) : w
    ));
  }, [redoStack, workflows, activeWorkflowId]);

  const canUndo = historyStack.length > 0;
  const canRedo = redoStack.length > 0;

  const updateActiveWorkflow = useCallback((updater) => {
    setWorkflows((prev) => prev.map((workflow) => (
      workflow.id === activeWorkflowId ? updater(workflow) : workflow
    )));
    setIsDirty(true);
  }, [activeWorkflowId]);

  const setNodes = useCallback((updater) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      nodes: typeof updater === "function" ? updater(workflow.nodes) : updater,
    }));
    setIsDirty(true);
  }, [updateActiveWorkflow]);

  const setTableNames = useCallback((updater) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      tableNames: typeof updater === "function" ? updater(workflow.tableNames) : updater,
    }));
    setIsDirty(true);
  }, [updateActiveWorkflow]);

  const setNodePrompts = useCallback((updater) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      nodePrompts: typeof updater === "function" ? updater(workflow.nodePrompts) : updater,
    }));
    setIsDirty(true);
  }, [updateActiveWorkflow]);

  const setNodeSourceTables = useCallback((updater) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      nodeSourceTables: typeof updater === "function" ? updater(workflow.nodeSourceTables) : updater,
    }));
    setIsDirty(true);
  }, [updateActiveWorkflow]);

  const setEditMode = useCallback((value) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      editMode: typeof value === "function" ? value(workflow.editMode) : value,
    }));
    setIsDirty(true);
  }, [updateActiveWorkflow]);

  const persistMetadataNow = useCallback(async () => {
    if (import.meta.env.VITE_DEBUG) {
      console.log(`[persistMetadataNow] called, ${workflows.length} workflow(s)`, new Date().toISOString());
      console.trace('[persistMetadataNow] call stack');
    }
    if (typeof window === "undefined") return;

    // Save to API
    try {
      await saveWorkflow(activeWorkflow);
      if (isMounted.current) {
        setSaveStatus("saved");
        setSaveTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setIsUsingLocalStorage(false);
        setIsDirty(false);
      }
    } catch (err) {
      console.warn('[useWorkflows] API save failed:', err);
      if (isMounted.current) {
        setSaveStatus("error");
        setFlowNotice("Save failed");
        setFlowNoticeTone("error");
      }
    }
  }, [workflows, activeWorkflowId]);

  // Load from API on mount or when initialWorkflowId changes, fallback to localStorage
  useEffect(() => {
    isMounted.current = true;

    // If localWorkflow provided, use it immediately (no API call)
    if (localWorkflow) {
      if (import.meta.env.VITE_DEBUG) {
        console.log('[useWorkflows] localWorkflow provided, skipping API:', localWorkflow.id);
      }
      recentLocalWorkflowIdRef.current = localWorkflow.id;
      setWorkflows([localWorkflow]);
      setActiveWorkflowId(localWorkflow.id);
      setIsDirty(true);
      setIsLoading(false);
      return;
    }

    // If we have initialWorkflowId that matches what localWorkflow just set, skip API
    // This handles the case where localWorkflow transitions to null after being set
    // We use a ref to track recently created workflows since state may not be updated yet
    if (initialWorkflowId && recentLocalWorkflowIdRef.current === initialWorkflowId) {
      if (import.meta.env.VITE_DEBUG) {
        console.log('[useWorkflows] Workflow was just created locally, skipping API');
      }
      recentLocalWorkflowIdRef.current = null;
      setIsLoading(false);
      return;
    }

    if (import.meta.env.VITE_DEBUG) {
      console.log('[useWorkflows] localWorkflow is null, will call API with initialWorkflowId:', initialWorkflowId);
    }
    const loadFromApi = async () => {
      try {
        const userId = getUserId();
        const data = await listWorkflows(userId);
        if (!isMounted.current) return;
        
        if (data.workflows && data.workflows.length > 0) {
          const apiWorkflows = data.workflows.map(w => ({
            id: w.id,
            name: w.name,
            user_id: w.user_id,
            ...w.workflow_json,
          }));
          setWorkflows(apiWorkflows);

          if (initialWorkflowId) {
            const targetWorkflow = apiWorkflows.find(w => w.id === initialWorkflowId);
            if (import.meta.env.VITE_DEBUG) {
              console.log('[useWorkflows] API returned, looking for:', initialWorkflowId, 'found:', !!targetWorkflow);
            }
            if (targetWorkflow && targetWorkflow.user_id === userId) {
              setActiveWorkflowId(initialWorkflowId);
            } else {
              if (import.meta.env.VITE_DEBUG) {
                console.log('[useWorkflows] Setting accessDenied because targetWorkflow not found or user_id mismatch');
              }
              setAccessDenied(true);
              setFlowNotice("Workflow not found or access denied");
              setFlowNoticeTone("error");
            }
          } else {
            // No initialWorkflowId provided, use the first workflow
          setActiveWorkflowId(apiWorkflows[0].id);
        }
        setIsUsingLocalStorage(false);
        setIsLoading(false);
      } else {
        setAccessDenied(true);
        setIsLoading(false);
      }
    } catch (err) {
        console.warn('[useWorkflows] API load failed:', err);
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };
    loadFromApi();
    
    return () => {
      isMounted.current = false;
    };
  }, [initialWorkflowId, localWorkflow]);

  // Keep activeWorkflowId valid (only after API load completes)
  useEffect(() => {
    if (isLoading) return;
    if (!workflows.length) return;
    if (!workflows.some((w) => w.id === activeWorkflowId)) {
      setActiveWorkflowId(workflows[0].id);
    }
  }, [workflows, activeWorkflowId, isLoading]);



  // Auto-clear notice
  useEffect(() => {
    if (!flowNotice) return;
    const t = setTimeout(() => setFlowNotice(""), 3000);
    return () => clearTimeout(t);
  }, [flowNotice]);

  // Close menu on outside click
  useEffect(() => {
    if (!showWorkflowMenu) return;
    const onPointerDown = (event) => {
      if (workflowMenuRef.current && !workflowMenuRef.current.contains(event.target)) {
        setShowWorkflowMenu(false);
        setWorkflowEditMode(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [showWorkflowMenu]);

  const nextWorkflowName = () => {
    const base = "New Workflow";
    const existing = new Set(workflows.map((w) => w.name.trim().toLowerCase()));
    let idx = 1;
    let candidate = base;
    while (existing.has(candidate.toLowerCase())) {
      idx += 1;
      candidate = `${base} ${idx}`;
    }
    return candidate;
  };

  const normalizeWorkflowNames = () => {
    const normalized = workflows.map((workflow, index) => {
      const name = normalizeName(workflow.name, `Workflow ${index + 1}`);
      return name === workflow.name ? workflow : { ...workflow, name };
    });
    const changed = normalized.some((workflow, index) => workflow !== workflows[index]);
    if (changed) {
      setWorkflows(normalized);
    }
  };

  const selectWorkflow = (workflowId) => {
    if (workflowId === activeWorkflowId) {
      setShowWorkflowMenu(false);
      setWorkflowEditMode(false);
      return;
    }
    setActiveWorkflowId(workflowId);
    setShowWorkflowMenu(false);
    setWorkflowEditMode(false);
  };

  const addWorkflow = (onCreated) => {
    const workflow = createWorkflow(nextWorkflowName(), []); // Empty array = no nodes (for "+" button)
    setWorkflows((prev) => [...prev, workflow]);
    setActiveWorkflowId(workflow.id);
    if (onCreated) onCreated(workflow);
    setFlowNoticeTone("neutral");
    setFlowNotice("New workflow created.");
    setIsDirty(true);
  };

  const renameWorkflow = (workflowId, name) => {
    setWorkflows((prev) => prev.map((w) => (
      w.id === workflowId ? { ...w, name } : w
    )));
    setIsDirty(true);
  };

  const finalizeWorkflowName = (workflowId) => {
    const idx = workflows.findIndex((w) => w.id === workflowId);
    if (idx === -1) return;
    const workflow = workflows[idx];
    const nextName = normalizeName(workflow.name, `Workflow ${idx + 1}`);
    if (nextName === workflow.name) return;
    setWorkflows((prev) => prev.map((item) => (
      item.id === workflowId ? { ...item, name: nextName } : item
    )));
    setIsDirty(true);
  };

  const reorderWorkflow = (workflowId, direction) => {
    setWorkflows((prev) => {
      const idx = prev.findIndex((w) => w.id === workflowId);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [workflow] = next.splice(idx, 1);
      next.splice(target, 0, workflow);
      return next;
    });
  };

  const deleteWorkflow = async (workflowId) => {
    const idx = workflows.findIndex((w) => w.id === workflowId);
    if (idx === -1) return;
    if (workflows.length === 1) {
      setFlowNoticeTone("error");
      setFlowNotice("At least one workflow is required.");
      return;
    }
    const workflow = workflows[idx];
    const workflowName = normalizeName(workflow.name, `Workflow ${idx + 1}`);
    const confirmed = window.confirm(`Delete "${workflowName}"? This cannot be undone.`);
    if (!confirmed) return;

    // Try to delete from API
    try {
      await deleteWorkflowApi(workflowId);
    } catch (err) {
      console.warn('[useWorkflows] API delete failed:', err);
    }

    const nextWorkflows = workflows.filter((item) => item.id !== workflowId);
    const nextActiveWorkflowId = workflowId === activeWorkflowId
      ? (nextWorkflows[Math.min(idx, nextWorkflows.length - 1)]?.id ?? nextWorkflows[0].id)
      : activeWorkflowId;

    setWorkflows(nextWorkflows);
    if (nextActiveWorkflowId !== activeWorkflowId) setActiveWorkflowId(nextActiveWorkflowId);
    setFlowNoticeTone("neutral");
    setFlowNotice(`Deleted workflow "${workflowName}".`);
  };

  const toggleWorkflowEditMode = () => {
    if (workflowEditMode) normalizeWorkflowNames();
    setWorkflowEditMode((prev) => !prev);
  };

  const triggerFlowImport = () => importInputRef.current?.click();

  const handleFlowImport = (event, onImported) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ""));
        const metadata = normalizeWorkflowMetadata(parsed);
        const imported = metadata.workflows[0];
        if (!imported) {
          setFlowNoticeTone("error");
          setFlowNotice("Flow Import failed: no workflows found in file.");
          return;
        }

        setNodes(imported.nodes);
        setTableNames(imported.tableNames);
        setNodePrompts(imported.nodePrompts);
        setNodeSourceTables(imported.nodeSourceTables);
        updateActiveWorkflow((w) => ({ ...w, name: imported.name }));
        setShowWorkflowMenu(false);
        setWorkflowEditMode(false);
        setFlowNoticeTone("neutral");
        setFlowNotice(`Imported "${imported.name}". Save to apply changes.`);
        if (onImported) onImported(metadata);
        setIsDirty(true);
      } catch {
        setFlowNoticeTone("error");
        setFlowNotice("Flow Import failed: invalid JSON format.");
      }
    };
    reader.onerror = () => {
      setFlowNoticeTone("error");
      setFlowNotice("Flow Import failed: could not read file.");
    };
    reader.readAsText(file);
  };

  const handleFlowExport = () => {
    try {
      const payload = serializeWorkflowMetadata([activeWorkflow], activeWorkflow.id);
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeWorkflow.name}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setFlowNoticeTone("neutral");
      setFlowNotice(`Exported "${activeWorkflow.name}".`);
    } catch {
      setFlowNoticeTone("error");
      setFlowNotice("Flow Export failed.");
    }
  };

  const retrySave = async () => {
    if (import.meta.env.VITE_DEBUG) {
      console.log('[retrySave] called', new Date().toISOString());
      console.trace('[retrySave] call stack');
    }
    setSaveStatus("saving");
    try {
      await persistMetadataNow();
    } catch {
      setSaveStatus("error");
    }
  };

  const deleteNode = (id, sel, setSel, setMidTab) => {
    saveToHistory();
    const remaining = nodes.filter(n => n.id !== id);
    setNodes(remaining);
    if (sel === id) {
      setSel(remaining[0]?.id);
      setMidTab("settings");
    }
    setTableNames(t => { const q = { ...t }; delete q[id]; return q; });
    setNodePrompts(p => { const q = { ...p }; delete q[id]; return q; });
    setNodeSourceTables(s => { const q = { ...s }; delete q[id]; return q; });
    setIsDirty(true);
  };

  const addNode = (catalogNode, insertAfterIdx = null) => {
    saveToHistory();
    const newId = `node_${String(Date.now()).slice(-6)}`;

    // Generate unique table name if default already exists
    const getUniqueTableName = (baseName) => {
      if (!baseName) return "";
      const existingNames = Object.values(tableNames).map(n => n?.trim()).filter(Boolean);
      if (!existingNames.includes(baseName)) return baseName;

      let counter = 2;
      let uniqueName = `${baseName} (${counter})`;
      while (existingNames.includes(uniqueName)) {
        counter++;
        uniqueName = `${baseName} (${counter})`;
      }
      return uniqueName;
    };

    const defaultTableName = catalogNode.behavior !== "basic_export" && catalogNode.behavior !== "ai_export" && catalogNode.behavior !== "export"
      ? (catalogNode.default_table_name ?? `${catalogNode.label} Output`)
      : null;
    const uniqueTableName = defaultTableName ? getUniqueTableName(defaultTableName) : null;

    const newNode = {
      id: newId,
      node_type: catalogNode.node_type,
      behavior: catalogNode.behavior,
      label: catalogNode.label,
      title: catalogNode.label,
      icon: catalogNode.icon,
      description: catalogNode.desc,
      n8n_form_urls: catalogNode.n8n_form_urls,
      requires_file: catalogNode.requires_file ?? false,
      requires_prompt: catalogNode.requires_prompt ?? false,
      requires_table_input: catalogNode.requires_table_input ?? false,
      output_modes: catalogNode.output_modes ?? ["create"],
      output_format_options: catalogNode.output_format_options,
      default_output_format: catalogNode.default_output_format ?? "json",
      default_prompt_json: catalogNode.default_prompt_json,
      default_prompt_xml: catalogNode.default_prompt_xml,
      prompt_label: catalogNode.prompt_label,
      prompt_placeholder: catalogNode.prompt_placeholder,
      table_name_label: catalogNode.table_name_label,
      table_name_hint: catalogNode.table_name_hint,
      tableOutput: catalogNode.behavior !== "basic_export" && catalogNode.behavior !== "ai_export" && catalogNode.behavior !== "export"
        ? { mode: "create", name: uniqueTableName }
        : null,
      settings: {
        ...(catalogNode.defaults || {}),
        ...(catalogNode.default_output_format
          ? { processing: { outputFormat: catalogNode.default_output_format } }
          : {}),
      },
    };

    const defaultPrompt = catalogNode.node_type === "ai_export"
      ? (catalogNode.default_output_format === "xml"
          ? catalogNode.default_prompt_xml
          : catalogNode.default_prompt_json)
      : null;

    setNodes(ns => {
      if (insertAfterIdx !== null) {
        const safeIdx = insertAfterIdx + 1;
        return [...ns.slice(0, safeIdx), newNode, ...ns.slice(safeIdx)];
      }
      return [...ns, newNode];
    });
    setTableNames(t => ({ ...t, [newId]: uniqueTableName ?? "" }));
    if (defaultPrompt) {
      setNodePrompts(p => ({ ...p, [newId]: defaultPrompt }));
    }
  };

  const updateNodeTitle = (nodeId, title) => {
    setNodes(ns => ns.map(n =>
      n.id === nodeId
        ? { ...n, title: title.slice(0, 40) }
        : n
    ));
    setIsDirty(true);
  };

  return {
    // State
    workflows, activeWorkflowId, activeWorkflow,
    nodes, tableNames, nodePrompts, nodeSourceTables,
    editMode,
    showWorkflowMenu, setShowWorkflowMenu,
    workflowEditMode, setWorkflowEditMode,
    flowNotice, flowNoticeTone, setFlowNotice, setFlowNoticeTone,
    accessDenied,
    saveStatus, saveTime, isUsingLocalStorage, isDirty, isLoading,
    importInputRef, workflowMenuRef,

    // Setters
    setWorkflows, setActiveWorkflowId,
    setNodes, setTableNames, setNodePrompts, setNodeSourceTables,
    setEditMode, updateActiveWorkflow,
    triggerSave,

    // Workflow actions
    selectWorkflow, addWorkflow, renameWorkflow, finalizeWorkflowName,
    reorderWorkflow, deleteWorkflow, toggleWorkflowEditMode,
    normalizeWorkflowNames,

    // Import/export
    triggerFlowImport, handleFlowImport, handleFlowExport,

    // Save
    retrySave,

    // Node actions
    deleteNode, addNode, updateNodeTitle,

    // Undo/redo
    undo, redo, canUndo, canRedo, saveToHistory,
  };
}
