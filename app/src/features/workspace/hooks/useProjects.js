import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  createProject,
  normalizeName,
  normalizeWorkflowMetadata,
  serializeWorkflowMetadata,
  loadWorkflowMetadata,
  makeId,
  METADATA_STORAGE_KEY,
} from "../utils/workflow-metadata.js";

export default function useProjects() {
  const initialMetadata = useMemo(() => loadWorkflowMetadata(), []);
  const [projects, setProjects] = useState(initialMetadata.projects);
  const [activeProjectId, setActiveProjectId] = useState(initialMetadata.activeProjectId);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];
  const nodes = activeProject?.nodes ?? [];
  const tableNames = activeProject?.tableNames ?? {};
  const nodePrompts = activeProject?.nodePrompts ?? {};
  const nodeSourceTables = activeProject?.nodeSourceTables ?? {};
  const editMode = activeProject?.editMode ?? true;

  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [projectEditMode, setProjectEditMode] = useState(false);
  const [flowNotice, setFlowNotice] = useState("");
  const [flowNoticeTone, setFlowNoticeTone] = useState("neutral");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [saveTime, setSaveTime] = useState(null);
  const importInputRef = useRef(null);
  const projectMenuRef = useRef(null);

  const triggerSave = () => setSaveStatus("saving");

  const updateActiveProject = useCallback((updater) => {
    setProjects((prev) => prev.map((project) => (
      project.id === activeProjectId ? updater(project) : project
    )));
  }, [activeProjectId]);

  const setNodes = useCallback((updater) => {
    updateActiveProject((project) => ({
      ...project,
      nodes: typeof updater === "function" ? updater(project.nodes) : updater,
    }));
  }, [updateActiveProject]);

  const setTableNames = useCallback((updater) => {
    updateActiveProject((project) => ({
      ...project,
      tableNames: typeof updater === "function" ? updater(project.tableNames) : updater,
    }));
  }, [updateActiveProject]);

  const setNodePrompts = useCallback((updater) => {
    updateActiveProject((project) => ({
      ...project,
      nodePrompts: typeof updater === "function" ? updater(project.nodePrompts) : updater,
    }));
  }, [updateActiveProject]);

  const setNodeSourceTables = useCallback((updater) => {
    updateActiveProject((project) => ({
      ...project,
      nodeSourceTables: typeof updater === "function" ? updater(project.nodeSourceTables) : updater,
    }));
  }, [updateActiveProject]);

  const setEditMode = useCallback((value) => {
    updateActiveProject((project) => ({
      ...project,
      editMode: typeof value === "function" ? value(project.editMode) : value,
    }));
    triggerSave();
  }, [updateActiveProject]);

  const persistMetadataNow = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      METADATA_STORAGE_KEY,
      JSON.stringify(serializeWorkflowMetadata(projects, activeProjectId))
    );
  }, [projects, activeProjectId]);

  // Keep activeProjectId valid
  useEffect(() => {
    if (!projects.length) return;
    if (!projects.some((p) => p.id === activeProjectId)) {
      setActiveProjectId(projects[0].id);
    }
  }, [projects, activeProjectId]);

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
  }, [projects, activeProjectId]);

  // Auto-clear notice
  useEffect(() => {
    if (!flowNotice) return;
    const t = setTimeout(() => setFlowNotice(""), 3000);
    return () => clearTimeout(t);
  }, [flowNotice]);

  // Close menu on outside click
  useEffect(() => {
    if (!showProjectMenu) return;
    const onPointerDown = (event) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target)) {
        setShowProjectMenu(false);
        setProjectEditMode(false);
      }
    };
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [showProjectMenu]);

  const nextProjectName = () => {
    const base = "New Workflow";
    const existing = new Set(projects.map((p) => p.name.trim().toLowerCase()));
    let idx = 1;
    let candidate = base;
    while (existing.has(candidate.toLowerCase())) {
      idx += 1;
      candidate = `${base} ${idx}`;
    }
    return candidate;
  };

  const normalizeProjectNames = () => {
    const normalized = projects.map((project, index) => {
      const name = normalizeName(project.name, `Flow Project ${index + 1}`);
      return name === project.name ? project : { ...project, name };
    });
    const changed = normalized.some((project, index) => project !== projects[index]);
    if (changed) {
      triggerSave();
      setProjects(normalized);
    }
  };

  const selectProject = (projectId) => {
    if (projectId === activeProjectId) {
      setShowProjectMenu(false);
      setProjectEditMode(false);
      return;
    }
    triggerSave();
    setActiveProjectId(projectId);
    setShowProjectMenu(false);
    setProjectEditMode(false);
  };

  const addProject = (onCreated) => {
    const project = createProject(nextProjectName(), []); // Empty array = no nodes (for "+" button)
    triggerSave();
    setProjects((prev) => [...prev, project]);
    setActiveProjectId(project.id);
    if (onCreated) onCreated(project);
    setFlowNoticeTone("neutral");
    setFlowNotice("New workflow project created.");
  };

  const renameProject = (projectId, name) => {
    triggerSave();
    setProjects((prev) => prev.map((p) => (
      p.id === projectId ? { ...p, name } : p
    )));
  };

  const finalizeProjectName = (projectId) => {
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx === -1) return;
    const project = projects[idx];
    const nextName = normalizeName(project.name, `Flow Project ${idx + 1}`);
    if (nextName === project.name) return;
    triggerSave();
    setProjects((prev) => prev.map((item) => (
      item.id === projectId ? { ...item, name: nextName } : item
    )));
  };

  const reorderProject = (projectId, direction) => {
    triggerSave();
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === projectId);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [project] = next.splice(idx, 1);
      next.splice(target, 0, project);
      return next;
    });
  };

  const deleteProject = (projectId) => {
    const idx = projects.findIndex((p) => p.id === projectId);
    if (idx === -1) return;
    if (projects.length === 1) {
      setFlowNoticeTone("error");
      setFlowNotice("At least one workflow project is required.");
      return;
    }
    const project = projects[idx];
    const projectName = normalizeName(project.name, `Flow Project ${idx + 1}`);
    const confirmed = window.confirm(`Delete "${projectName}"? This cannot be undone.`);
    if (!confirmed) return;

    const nextProjects = projects.filter((item) => item.id !== projectId);
    const nextActiveProjectId = projectId === activeProjectId
      ? (nextProjects[Math.min(idx, nextProjects.length - 1)]?.id ?? nextProjects[0].id)
      : activeProjectId;

    triggerSave();
    setProjects(nextProjects);
    if (nextActiveProjectId !== activeProjectId) setActiveProjectId(nextActiveProjectId);
    setFlowNoticeTone("neutral");
    setFlowNotice(`Deleted project "${projectName}".`);
  };

  const toggleProjectEditMode = () => {
    if (projectEditMode) normalizeProjectNames();
    setProjectEditMode((prev) => !prev);
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
        setProjects(metadata.projects);
        setActiveProjectId(metadata.activeProjectId);
        setShowProjectMenu(false);
        setProjectEditMode(false);
        setFlowNoticeTone("neutral");
        setFlowNotice(`Flow Import complete (${metadata.projects.length} project${metadata.projects.length > 1 ? "s" : ""}).`);
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
      const payload = serializeWorkflowMetadata(projects, activeProjectId);
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `flow-projects-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setFlowNoticeTone("neutral");
      setFlowNotice("Flow Export complete.");
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
    projects, activeProjectId, activeProject,
    nodes, tableNames, nodePrompts, nodeSourceTables,
    editMode,
    showProjectMenu, setShowProjectMenu,
    projectEditMode, setProjectEditMode,
    flowNotice, flowNoticeTone, setFlowNotice, setFlowNoticeTone,
    saveStatus, saveTime,
    importInputRef, projectMenuRef,
    initialMetadata,

    // Setters
    setProjects, setActiveProjectId,
    setNodes, setTableNames, setNodePrompts, setNodeSourceTables,
    setEditMode,
    triggerSave,

    // Project actions
    selectProject, addProject, renameProject, finalizeProjectName,
    reorderProject, deleteProject, toggleProjectEditMode,
    normalizeProjectNames,

    // Import/export
    triggerFlowImport, handleFlowImport, handleFlowExport,

    // Save
    retrySave,

    // Node actions
    deleteNode, addNode, updateNodeTitle,
  };
}
