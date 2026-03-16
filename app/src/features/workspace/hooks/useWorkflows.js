import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  createWorkflow,
  normalizeName,
  normalizeWorkflowMetadata,
  serializeWorkflowMetadata,
  loadWorkflowMetadata,
  makeId,
  METADATA_STORAGE_KEY,
} from "../utils/workflow-metadata.js";

export default function useWorkflows({ initialWorkflowId } = {}) {
  const initialMetadata = useMemo(() => loadWorkflowMetadata(), []);
  const [workflows, setWorkflows] = useState(initialMetadata.workflows);
  const [activeWorkflowId, setActiveWorkflowId] = useState(() => {
    if (initialWorkflowId && initialMetadata.workflows.some(w => w.id === initialWorkflowId)) {
      return initialWorkflowId;
    }
    return initialMetadata.activeWorkflowId;
  });

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
  const [saveStatus, setSaveStatus] = useState("saved");
  const [saveTime, setSaveTime] = useState(null);
  const importInputRef = useRef(null);
  const workflowMenuRef = useRef(null);

  const triggerSave = () => setSaveStatus("saving");

  const updateActiveWorkflow = useCallback((updater) => {
    setWorkflows((prev) => prev.map((workflow) => (
      workflow.id === activeWorkflowId ? updater(workflow) : workflow
    )));
  }, [activeWorkflowId]);

  const setNodes = useCallback((updater) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      nodes: typeof updater === "function" ? updater(workflow.nodes) : updater,
    }));
  }, [updateActiveWorkflow]);

  const setTableNames = useCallback((updater) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      tableNames: typeof updater === "function" ? updater(workflow.tableNames) : updater,
    }));
  }, [updateActiveWorkflow]);

  const setNodePrompts = useCallback((updater) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      nodePrompts: typeof updater === "function" ? updater(workflow.nodePrompts) : updater,
    }));
  }, [updateActiveWorkflow]);

  const setNodeSourceTables = useCallback((updater) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      nodeSourceTables: typeof updater === "function" ? updater(workflow.nodeSourceTables) : updater,
    }));
  }, [updateActiveWorkflow]);

  const setEditMode = useCallback((value) => {
    updateActiveWorkflow((workflow) => ({
      ...workflow,
      editMode: typeof value === "function" ? value(workflow.editMode) : value,
    }));
    triggerSave();
  }, [updateActiveWorkflow]);

  const persistMetadataNow = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      METADATA_STORAGE_KEY,
      JSON.stringify(serializeWorkflowMetadata(workflows, activeWorkflowId))
    );
  }, [workflows, activeWorkflowId]);

  // Keep activeWorkflowId valid
  useEffect(() => {
    if (!workflows.length) return;
    if (!workflows.some((w) => w.id === activeWorkflowId)) {
      setActiveWorkflowId(workflows[0].id);
    }
  }, [workflows, activeWorkflowId]);

  // Persist on change
  useEffect(() => {
    try {
      persistMetadataNow();
      setSaveStatus("saved");
      setSaveTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setSaveStatus("error");
      setFlowNoticeTone("error");
      setFlowNotice("Could not save workflow metadata in this browser.");
    }
  }, [workflows, activeWorkflowId]);

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
      triggerSave();
      setWorkflows(normalized);
    }
  };

  const selectWorkflow = (workflowId) => {
    if (workflowId === activeWorkflowId) {
      setShowWorkflowMenu(false);
      setWorkflowEditMode(false);
      return;
    }
    triggerSave();
    setActiveWorkflowId(workflowId);
    setShowWorkflowMenu(false);
    setWorkflowEditMode(false);
  };

  const addWorkflow = (onCreated) => {
    const workflow = createWorkflow(nextWorkflowName(), []); // Empty array = no nodes (for "+" button)
    triggerSave();
    setWorkflows((prev) => [...prev, workflow]);
    setActiveWorkflowId(workflow.id);
    if (onCreated) onCreated(workflow);
    setFlowNoticeTone("neutral");
    setFlowNotice("New workflow created.");
  };

  const renameWorkflow = (workflowId, name) => {
    triggerSave();
    setWorkflows((prev) => prev.map((w) => (
      w.id === workflowId ? { ...w, name } : w
    )));
  };

  const finalizeWorkflowName = (workflowId) => {
    const idx = workflows.findIndex((w) => w.id === workflowId);
    if (idx === -1) return;
    const workflow = workflows[idx];
    const nextName = normalizeName(workflow.name, `Workflow ${idx + 1}`);
    if (nextName === workflow.name) return;
    triggerSave();
    setWorkflows((prev) => prev.map((item) => (
      item.id === workflowId ? { ...item, name: nextName } : item
    )));
  };

  const reorderWorkflow = (workflowId, direction) => {
    triggerSave();
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

  const deleteWorkflow = (workflowId) => {
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

    const nextWorkflows = workflows.filter((item) => item.id !== workflowId);
    const nextActiveWorkflowId = workflowId === activeWorkflowId
      ? (nextWorkflows[Math.min(idx, nextWorkflows.length - 1)]?.id ?? nextWorkflows[0].id)
      : activeWorkflowId;

    triggerSave();
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
        triggerSave();
        const withNewIds = metadata.workflows.map((w) => ({ ...w, _newId: crypto.randomUUID() }));
        const importedActiveId =
          withNewIds.find((w) => w.id === metadata.activeWorkflowId)?._newId ??
          withNewIds[0]?._newId ?? null;
        setWorkflows((prev) => {
          const existingNames = new Set(prev.map((w) => w.name.trim().toLowerCase()));
          const newWorkflows = withNewIds.map((w) => {
            let name = w.name;
            if (existingNames.has(name.trim().toLowerCase())) {
              let idx = 2;
              while (existingNames.has(`${name} ${idx}`.toLowerCase())) idx++;
              name = `${name} ${idx}`;
            }
            existingNames.add(name.trim().toLowerCase());
            const { _newId, ...rest } = w;
            return { ...rest, id: _newId, name };
          });
          return [...prev, ...newWorkflows];
        });
        setActiveWorkflowId(importedActiveId);
        setShowWorkflowMenu(false);
        setWorkflowEditMode(false);
        setFlowNoticeTone("neutral");
        setFlowNotice(`Imported ${metadata.workflows.length} workflow${metadata.workflows.length > 1 ? "s" : ""}.`);
        if (onImported) onImported(metadata);
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

  const retrySave = () => {
    try {
      setSaveStatus("saving");
      persistMetadataNow();
      setSaveStatus("saved");
      setSaveTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setSaveStatus("error");
    }
  };

  const deleteNode = (id, sel, setSel, setMidTab) => {
    const remaining = nodes.filter(n => n.id !== id);
    setNodes(remaining);
    if (sel === id) {
      setSel(remaining[0]?.id);
      setMidTab("settings");
    }
    setTableNames(t => { const q = { ...t }; delete q[id]; return q; });
    setNodePrompts(p => { const q = { ...p }; delete q[id]; return q; });
    setNodeSourceTables(s => { const q = { ...s }; delete q[id]; return q; });
    triggerSave();
  };

  const addNode = (catalogNode, insertAfterIdx = null) => {
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
      settings: catalogNode.default_output_format
        ? { processing: { outputFormat: catalogNode.default_output_format } }
        : null,
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
    triggerSave();
  };

  const updateNodeTitle = (nodeId, title) => {
    setNodes(ns => ns.map(n =>
      n.id === nodeId
        ? { ...n, title: title.slice(0, 40) }
        : n
    ));
    triggerSave();
  };

  return {
    // State
    workflows, activeWorkflowId, activeWorkflow,
    nodes, tableNames, nodePrompts, nodeSourceTables,
    editMode,
    showWorkflowMenu, setShowWorkflowMenu,
    workflowEditMode, setWorkflowEditMode,
    flowNotice, flowNoticeTone, setFlowNotice, setFlowNoticeTone,
    saveStatus, saveTime,
    importInputRef, workflowMenuRef,
    initialMetadata,

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
  };
}
