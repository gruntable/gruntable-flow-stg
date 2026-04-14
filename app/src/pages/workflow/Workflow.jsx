import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { C, S } from "../../styles.jsx";
import { readTable, deleteTable, replaceTable, renameTable } from "./services/table.js";
import { createWorkflow } from "./utils/workflow-metadata.js";
import useWorkflows from "./hooks/useWorkflows.js";
import useOrchestrator from "./hooks/useOrchestrator.js";
import usePauseReviewTable from "./hooks/usePauseReviewTable.js";
import usePanelWidths from "./hooks/usePanelWidths.js";
import TopBar from "./panels/left-panel/top-panel/TopBar.jsx";
import FlowPanel from "./panels/left-panel/content-panel/flow-panel/FlowPanel.jsx";
import InputPanel from "./panels/left-panel/content-panel/input-panel/InputPanel.jsx";
import TablePanel from "./panels/right-panel/TablePanel.jsx";

import NodePicker from "./panels/left-panel/content-panel/flow-panel/NodePicker.jsx";

// ─────────────────────────────────────────────
// WORKFLOW — MVP-1 with Orchestrator Integration
// Three-panel layout: left (node list) + middle (settings / run) + right (table).
// ─────────────────────────────────────────────

export default function Workflow() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const urlWorkflowId = searchParams.get('id') ?? undefined;
  const isNewWorkflow = searchParams.get('new') === 'true';

  const newWorkflow = useMemo(() => {
    if (!isNewWorkflow) return null;

    const templateWorkflowJson = location.state?.templateWorkflowJson;
    const templateName = location.state?.templateName;

    console.log('[Workflow] isNewWorkflow=true');
    console.log('[Workflow] location.state:', location.state);
    console.log('[Workflow] templateWorkflowJson:', templateWorkflowJson);

    // workflow_json may be stored as a full metadata envelope { workflows: [...], activeWorkflowId }
    // or directly as a workflow object { nodes, tableNames, ... }
    let resolvedWorkflowJson = templateWorkflowJson;
    if (templateWorkflowJson?.workflows?.length) {
      const activeId = templateWorkflowJson.activeWorkflowId;
      resolvedWorkflowJson = templateWorkflowJson.workflows.find(w => w.id === activeId)
        ?? templateWorkflowJson.workflows[0];
      console.log('[Workflow] Unwrapped from envelope, resolvedWorkflowJson:', resolvedWorkflowJson);
    }

    if (resolvedWorkflowJson?.nodes?.length) {
      console.log('[Workflow] Using template nodes, count:', resolvedWorkflowJson.nodes.length);
      return {
        id: crypto.randomUUID(),
        name: templateName || 'New Workflow',
        editMode: resolvedWorkflowJson.editMode ?? true,
        platform: resolvedWorkflowJson.platform ?? null,
        platform_input_method: resolvedWorkflowJson.platform_input_method ?? null,
        nodes: resolvedWorkflowJson.nodes,
        tableNames: resolvedWorkflowJson.tableNames ?? {},
        nodePrompts: resolvedWorkflowJson.nodePrompts ?? {},
        nodeSourceTables: resolvedWorkflowJson.nodeSourceTables ?? {},
      };
    }

    console.log('[Workflow] No template nodes found — falling back to blank AI Extraction node');
    const nodeId = `node_${Date.now().toString(36)}`;
    const singleNode = {
      id: nodeId,
      node_type: "ai_extraction",
      behavior: "ai_form",
      label: "AI Extraction PDF, Spreadsheet, Image",
      title: "AI Extraction PDF, Spreadsheet, Image",
      icon: "🗂️",
      description: "Upload a file and let AI extract structured data from it. File upload is required.",
      n8n_form_urls: [
        { fileType: 'pdf', url: '/form/ai-extraction-pdf' },
        { fileType: 'image', url: '/form/ai-extraction-image' },
        { fileType: 'xlsx', url: '/form/ai-extraction-xlsx' },
        { fileType: 'csv', url: '/form/ai-extraction-csv' }
      ],
      requires_file: true,
      requires_prompt: false,
      requires_table_input: false,
      output_modes: ["create", "overwrite"],
      prompt_label: "Extraction Prompt",
      prompt_placeholder: "e.g. Extract all transactions from this bank statement",
      table_name_label: "Output Table Name",
      table_name_hint: "Name this table to reference it in downstream nodes.",
      tableOutput: { mode: "create", name: "Extracted Data" }
    };

    return {
      id: crypto.randomUUID(),
      name: 'New Workflow',
      editMode: true,
      platform: null,
      platform_input_method: null,
      nodes: [singleNode],
      tableNames: { [nodeId]: "Extracted Data" },
      nodePrompts: {},
      nodeSourceTables: {},
    };
  }, [isNewWorkflow]);

  const proj = useWorkflows({
    initialWorkflowId: isNewWorkflow ? undefined : urlWorkflowId,
    localWorkflow: newWorkflow
  });

  const renderCountRef = useRef(0);
  const prevRenderStateRef = useRef(null);
  if (import.meta.env.VITE_DEBUG) {
    renderCountRef.current++;
    const renderState = {
      isLoading: proj.isLoading,
      activeWorkflowId: proj.activeWorkflowId,
      isNewWorkflow,
      urlWorkflowId,
    };
    const renderStateStr = JSON.stringify(renderState);
    if (renderStateStr !== prevRenderStateRef.current) {
      prevRenderStateRef.current = renderStateStr;
      console.log(`[Workflow] render #${renderCountRef.current}:`, renderState);
    }
  }
  const {
    nodes, tableNames, nodePrompts, nodeSourceTables,
    activeWorkflowId, isLoading,
    editMode, setEditMode,
    undo, redo, canUndo, canRedo,
  } = proj;

  // Sync URL for new workflow creation — navigate to proper ID after local workflow created
  useEffect(() => {
    if (isLoading) return;
    if (!isNewWorkflow) return;
    if (!activeWorkflowId) return;
    navigate(`/workflow?id=${activeWorkflowId}`, { replace: true });
  }, [isLoading, isNewWorkflow, activeWorkflowId, navigate]);

  // Sync URL to active workflow — fires after API load, workflow switch, and workflow creation
  useEffect(() => {
    if (isLoading) return;
    if (activeWorkflowId && urlWorkflowId !== activeWorkflowId) {
      navigate(`/workflow?id=${activeWorkflowId}`, { replace: true });
    }
  }, [urlWorkflowId, activeWorkflowId, navigate, isLoading]);

  // ── UI-only state ──
  const [sel, setSel] = useState(null);
  // Set initial node selection when workflow loads from API
  useEffect(() => {
    if (nodes.length && !sel) setSel(nodes[0].id);
  }, [nodes]);
  const [midTab, setMidTab] = useState("settings");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerInsertIdx, setPickerInsertIdx] = useState(null);
  const [procDots, setProcDots] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);

  const [accumulatedTables, setAccumulatedTables] = useState({});
  const [accumulatedActiveTable, setAccumulatedActiveTable] = useState(null);
  const [loadingTableName, setLoadingTableName] = useState(null);
  const [dirtyTables, setDirtyTables] = useState(new Set());
  const [savingTables, setSavingTables] = useState(new Set());

  // NOTE: hasDirtyState and related hooks moved below useOrchestrator call (line ~200)
  // to avoid temporal dead zone - orch is not yet defined here

  // Persist open tables to localStorage — but only after restore has run once,
  // to avoid overwriting saved data with empty state on mount.
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!activeWorkflowId || !hasRestoredRef.current) return;
    const key = `gruntable-flow-mvp1-open-tables-${activeWorkflowId}`;
    const openTableNames = Object.keys(accumulatedTables);
    localStorage.setItem(key, JSON.stringify({ openTableNames, activeTable: accumulatedActiveTable }));
  }, [accumulatedTables, accumulatedActiveTable, activeWorkflowId]);

  // Restore open tables on mount or workflow switch
  const restoredWorkflowIdRef = useRef(null);
  useEffect(() => {
    if (!activeWorkflowId) return;
    if (restoredWorkflowIdRef.current === activeWorkflowId) return;
    restoredWorkflowIdRef.current = activeWorkflowId;

    const key = `gruntable-flow-mvp1-open-tables-${activeWorkflowId}`;
    let saved;
    try { saved = JSON.parse(localStorage.getItem(key)); } catch { hasRestoredRef.current = true; return; }
    if (!saved?.openTableNames?.length) { hasRestoredRef.current = true; return; }

    const { openTableNames, activeTable } = saved;
    const activeToLoad = activeTable ?? openTableNames[0];
    // Set placeholders immediately so tabs appear
    const placeholders = Object.fromEntries(openTableNames.map(n => [n, { headers: [], rows: [] }]));
    setAccumulatedTables(placeholders);
    setAccumulatedActiveTable(activeToLoad);
    setLoadingTableName(activeToLoad); // show spinner on active tab while fetching
    hasRestoredRef.current = true; // unblock persisting

    // Fetch each table's data in the background
    openTableNames.forEach(async (tableName) => {
      try {
        const tableData = await readTable(tableName);
        setAccumulatedTables(prev => ({ ...prev, [tableName]: { headers: tableData.headers, rows: tableData.rows } }));
      } catch (err) {
        console.warn(`Failed to restore table "${tableName}":`, err);
        setAccumulatedTables(prev => { const next = { ...prev }; delete next[tableName]; return next; });
      } finally {
        if (tableName === activeToLoad) setLoadingTableName(null);
      }
    });
  }, [activeWorkflowId]);

  const resetPauseReviewStateRef = useRef(() => {});

  const orch = useOrchestrator({
    nodes, tableNames, nodePrompts, nodeSourceTables,
    workflowId: activeWorkflowId,
    setFlowNotice: proj.setFlowNotice,
    setFlowNoticeTone: proj.setFlowNoticeTone,
    setSel, setMidTab,
    resetPauseReviewState: () => resetPauseReviewStateRef.current(),
    accumulatedTables,
    setAccumulatedTables,
    accumulatedActiveTable,
    setAccumulatedActiveTable,
  });

  const pauseReview = usePauseReviewTable({
    pauseReviewTableName: orch.pauseReviewTableName,
    tableRefreshKey: orch.tableRefreshKey,
  });
  resetPauseReviewStateRef.current = pauseReview.resetPauseReviewState;

  // ── Dirty state check for unsaved changes confirmation (moved here after orch is defined)
  const hasDirtyState = proj.isDirty || dirtyTables.size > 0 ||
    orch.orchestratorStatus === 'running' || orch.orchestratorStatus === 'paused';

  // Browser native beforeunload dialog for close tab, refresh, back button, etc.
  useEffect(() => {
    if (!hasDirtyState) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasDirtyState]);

  // Custom modal state for in-app navigation (Home button)
  const [showDirtyModal, setShowDirtyModal] = useState(false);
  const pendingNavCallbackRef = useRef(null);
  const [isWaitingForSaveToNavigate, setIsWaitingForSaveToNavigate] = useState(false);

  const handleNavigateAttempt = useCallback((navigationFn) => {
    if (!hasDirtyState) {
      navigationFn();
      return;
    }
    pendingNavCallbackRef.current = navigationFn;
    setShowDirtyModal(true);
  }, [hasDirtyState]);

  // Watch saveStatus to complete pending navigation after save
  useEffect(() => {
    if (isWaitingForSaveToNavigate && proj.saveStatus === "saved") {
      setIsWaitingForSaveToNavigate(false);
      const callback = pendingNavCallbackRef.current;
      pendingNavCallbackRef.current = null;
      setShowDirtyModal(false);
      if (callback) callback();
    }
  }, [proj.saveStatus, isWaitingForSaveToNavigate]);

  const panelWidths = usePanelWidths();
  const panelWidthsRef = useRef(panelWidths);
  panelWidthsRef.current = panelWidths;
  const dragStartXRef = useRef(null);
  const dragInitialWidthsRef = useRef(null);

  // Mutable handler refs — updated every render so closures are always fresh
  const mouseMoveHandlerRef = useRef(null);
  const mouseUpHandlerRef = useRef(null);

  mouseMoveHandlerRef.current = (e) => {
    const deltaX = e.clientX - dragStartXRef.current;
    const handle = panelWidthsRef.current.draggingRef.current;
    if (handle === "left-middle") {
      panelWidthsRef.current.setLeftWidth(dragInitialWidthsRef.current.left + deltaX);
    } else if (handle === "middle-right") {
      panelWidthsRef.current.setMiddleWidth(dragInitialWidthsRef.current.middle + deltaX);
    }
  };

  mouseUpHandlerRef.current = (e) => {
    if (dragElementRef.current && dragPointerIdRef.current != null) {
      dragElementRef.current.releasePointerCapture(dragPointerIdRef.current);
    }
    panelWidthsRef.current.endDrag();
    dragStartXRef.current = null;
    dragInitialWidthsRef.current = null;
    dragElementRef.current = null;
    dragPointerIdRef.current = null;
    window.removeEventListener("pointermove", stableMouseMove);
    window.removeEventListener("pointerup", stableMouseUp);
  };

  // Stable wrappers — same function reference across all renders, so removeEventListener works
  const stableMouseMove = useRef((e) => mouseMoveHandlerRef.current(e)).current;
  const stableMouseUp = useRef((e) => mouseUpHandlerRef.current(e)).current;

  const dragElementRef = useRef(null);
  const dragPointerIdRef = useRef(null);

  const handlePointerDown = useCallback((e, handle) => {
    if (dragStartXRef.current !== null) return;
    e.preventDefault();
    e.target.setPointerCapture(e.pointerId);
    dragElementRef.current = e.target;
    dragPointerIdRef.current = e.pointerId;
    dragStartXRef.current = e.clientX;
    dragInitialWidthsRef.current = {
      left: panelWidthsRef.current.widths.left,
      middle: panelWidthsRef.current.widths.middle,
    };
    panelWidthsRef.current.startDrag(handle);
    window.addEventListener("pointermove", stableMouseMove);
    window.addEventListener("pointerup", stableMouseUp);
  }, [stableMouseMove, stableMouseUp]);

  // Memoized table objects to prevent re-renders
  const EMPTY_TABLES = useMemo(() => ({}), []);
  const pauseReviewTables = useMemo(() => {
    const current = pauseReview.pauseReviewTableData && orch.pauseReviewTableName
      ? { [orch.pauseReviewTableName]: pauseReview.pauseReviewTableData }
      : {};
    const result = { ...accumulatedTables, ...current };
    return result;
  }, [accumulatedTables, orch.pauseReviewTableName, pauseReview.pauseReviewTableData]);

  const activeTable = accumulatedActiveTable || orch.pauseReviewTableName;
  const tablePanelDirty = dirtyTables.has(activeTable);
  const tablePanelSaving = savingTables.has(activeTable);

  // Auto-select new table when pauseReviewTableName changes (new node completes)
  useEffect(() => {
    if (orch.pauseReviewTableName) setAccumulatedActiveTable(orch.pauseReviewTableName);
  }, [orch.pauseReviewTableName]);

  // Accumulate tables when table data arrives (for both single-node and workflow runs)
  useEffect(() => {
    if (pauseReview.pauseReviewTableData && orch.pauseReviewTableName) {
      if (import.meta.env.VITE_DEBUG) {
        console.log('[Workflow] Accumulating table from usePauseReviewTable:', orch.pauseReviewTableName);
      }
      setAccumulatedTables(prev => ({
        ...prev,
        [orch.pauseReviewTableName]: pauseReview.pauseReviewTableData
      }));
    }
  }, [pauseReview.pauseReviewTableData, orch.pauseReviewTableName]);

  // Sync pauseReviewTableData to orchestrator ref for accumulation on advance
  useEffect(() => {
    if (orch.updatePauseReviewTableDataRef) {
      orch.updatePauseReviewTableDataRef(pauseReview.pauseReviewTableData);
    }
  }, [pauseReview.pauseReviewTableData, orch.updatePauseReviewTableDataRef]);

  // Processing dots animation
  useEffect(() => {
    const t = setInterval(() => setProcDots(d => (d + 1) % 4), 400);
    return () => clearInterval(t);
  }, []);

  // Keep sel valid when nodes change
  useEffect(() => {
    if (!nodes.length) { setSel(null); return; }
    if (!nodes.some((n) => n.id === sel)) setSel(nodes[0].id);
  }, [nodes, sel]);

  // Reset orchestrator + Pause Review when workflow changes
  const prevWorkflowIdRef = useRef(activeWorkflowId);
  useEffect(() => {
    if (prevWorkflowIdRef.current === activeWorkflowId) return;
    prevWorkflowIdRef.current = activeWorkflowId;
    hasRestoredRef.current = false; // re-arm guard for new workflow
    orch.resetRun();
    pauseReview.resetPauseReviewState();
    orch.setPauseReviewTableName(null);
    setAccumulatedTables({});
    setAccumulatedActiveTable(null);
    setSel(nodes[0]?.id ?? null);
    setMidTab("settings");
  }, [activeWorkflowId, nodes]);

  const selNode = nodes.find(n => n.id === sel) ?? nodes[0];

  const validateNode = (node) => {
    const errors = [];

    if (node.node_type === "ai_extraction") {
      const tableName = tableNames[node.id]?.trim();
      if (!tableName) errors.push("Output table name required");
    }

    if (node.node_type === "ai_transformation") {
      const prompt = nodePrompts[node.id]?.trim();
      if (!prompt) errors.push("Transformation prompt required");

      const sourceTable = nodeSourceTables[node.id];
      const sourceTables = Array.isArray(sourceTable) ? sourceTable : [sourceTable];
      const hasValidSource = sourceTables.some(t => t?.trim());
      if (!hasValidSource) errors.push("Input table required");

      const tableName = tableNames[node.id]?.trim();
      if (!tableName) errors.push("Output table name required");
    }

    if (node.node_type === "export_excel") {
      const sourceTable = nodeSourceTables[node.id];
      const hasSource = Array.isArray(sourceTable) ? sourceTable.some(t => t?.trim()) : sourceTable?.trim();
      if (!hasSource) errors.push("Input table required");

      const fileName = node.settings?.processing?.file_name?.trim() || nodePrompts[node.id]?.trim();
      if (!fileName) errors.push("Export file name required");
    }

    if (node.node_type === "ai_export") {
      const prompt = nodePrompts[node.id]?.trim();
      if (!prompt) errors.push("Export prompt required");

      const sourceTable = nodeSourceTables[node.id];
      const hasSource = Array.isArray(sourceTable) ? sourceTable.some(t => t?.trim()) : sourceTable?.trim();
      if (!hasSource) errors.push("Input table required");
    }

    return errors;
  };

  const selectNode = (id) => {
    setSel(id);
    const n = nodes.find(x => x.id === id);
    if (!n) return;
    setMidTab("settings");
  };

  const nodeCanRun = (node) => {
    if (node.node_type === "export_excel") {
      const src = nodeSourceTables[node.id];
      const hasSource = Array.isArray(src) ? src.some(t => t?.trim()) : src?.trim();
      const hasFileName = node.settings?.processing?.file_name?.trim() || nodePrompts[node.id]?.trim();
      return !!(hasSource && hasFileName);
    }
    if (node.behavior === "basic_export" || node.behavior === "export") return true;
    if (node.node_type === "ai_transformation" || node.behavior === "ai_export") return !!(nodePrompts[node.id]?.trim());
    return true;
  };

  const handleDeleteNode = (id) => {
    proj.deleteNode(id, sel, setSel, setMidTab);
  };

  const onAddNodeClick = (insertIdx) => {
    setPickerInsertIdx(insertIdx);
    setShowPicker(true);
  };

  const handleImport = (event) => {
    proj.handleFlowImport(event, (metadata) => {
      const active = metadata.workflows.find((w) => w.id === metadata.activeWorkflowId) ?? metadata.workflows[0];
      setSel(active?.nodes?.[0]?.id ?? null);
      orch.resetRun();
      pauseReview.resetPauseReviewState();
    });
  };

  const reloadIframe = () => setIframeKey(k => k + 1);

  // Wrap resetRun - orchestrator handles all reset logic
  const resetRun = useCallback(() => {
    orch.resetRun();
  }, [orch]);

  // Handle table change - updates both current Pause Review table and accumulated tables
  const handleTableChange = useCallback((name, data) => {
    // Update current Pause Review table
    pauseReview.handlePauseReviewTableChange(name, data);
    // Also update in accumulated tables if exists
    if (accumulatedTables[name]) {
      setAccumulatedTables(prev => ({
        ...prev,
        [name]: data
      }));
    }
    setDirtyTables(prev => new Set(prev).add(name));
  }, [pauseReview, accumulatedTables]);

  // Save the currently active table — works for both Pause Review and non-Pause Review tables
  const handleSaveActiveTable = useCallback(async () => {
    if (!tablePanelDirty || tablePanelSaving) return;
    const name = activeTable;
    const data = pauseReviewTables[name];
    if (!name || !data) return;
    setSavingTables(prev => new Set(prev).add(name));
    try {
      await replaceTable(name, data.headers, data.rows);
      setDirtyTables(prev => { const next = new Set(prev); next.delete(name); return next; });
    } catch (err) {
      console.error('[Table save] Failed:', err);
    } finally {
      setSavingTables(prev => { const next = new Set(prev); next.delete(name); return next; });
    }
  }, [dirtyTables, savingTables, activeTable, pauseReviewTables]);

  // Handle active table change (user clicks a tab)
  // Only updates accumulatedActiveTable, NOT pauseReviewTableName.
  // pauseReviewTableName should only be set by the orchestrator when a node completes.
  const handleActiveTableChange = useCallback((name) => {
    setAccumulatedActiveTable(name);
  }, []);

  // Handle closing a single table
  const handleCloseTable = useCallback((name) => {
    setAccumulatedTables(prev => {
      const newTables = { ...prev };
      delete newTables[name];
      return newTables;
    });
    if (accumulatedActiveTable === name) {
      setAccumulatedActiveTable(null);
    }
    if (orch.pauseReviewTableName === name) {
      orch.setPauseReviewTableName(null);
    }
    setDirtyTables(prev => { const next = new Set(prev); next.delete(name); return next; });
  }, [accumulatedActiveTable, orch.pauseReviewTableName, orch.setPauseReviewTableName]);

  // Handle permanently deleting a table from the database
  const handleDeleteTable = useCallback(async (name) => {
    handleCloseTable(name);
    try {
      await deleteTable(name);
    } catch (err) {
      console.error('Failed to delete table:', err);
    }
  }, [handleCloseTable]);

  // Handle renaming a table (copy to new name, delete old)
  const handleRenameTable = useCallback(async (oldName, newName) => {
    const data = pauseReviewTables[oldName] || accumulatedTables[oldName];
    if (!data) return;

    // Optimistic UI update
    setAccumulatedTables(prev => {
      const next = { ...prev, [newName]: data };
      delete next[oldName];
      return next;
    });
    if (accumulatedActiveTable === oldName) setAccumulatedActiveTable(newName);
    if (orch.pauseReviewTableName === oldName) orch.setPauseReviewTableName(newName);

    try {
      await renameTable(oldName, newName, data.headers, data.rows);
    } catch (err) {
      console.error('Failed to rename table:', err);
      proj.setFlowNoticeTone("error");
      proj.setFlowNotice("Failed to rename table");
      // Rollback
      setAccumulatedTables(prev => {
        const next = { ...prev, [oldName]: data };
        delete next[newName];
        return next;
      });
      if (accumulatedActiveTable === newName) setAccumulatedActiveTable(oldName);
      if (orch.pauseReviewTableName === newName) orch.setPauseReviewTableName(oldName);
    }
  }, [pauseReviewTables, accumulatedTables, accumulatedActiveTable, orch.pauseReviewTableName, orch.setPauseReviewTableName, proj]);

  // Handle closing all tables
  const handleCloseAllTables = useCallback(() => {
    setAccumulatedTables({});
    setAccumulatedActiveTable(null);
    setDirtyTables(new Set());
pauseReview.resetPauseReviewState();
  }, [pauseReview]);

  // Handle creating a new empty table
  const handleCreateTable = useCallback(async (tableName) => {
    // Open empty tab immediately with default 3 columns and 3 rows
    const defaultHeaders = ['Col 1', 'Col 2', 'Col 3'];
    const defaultRows = [['', '', ''], ['', '', ''], ['', '', '']];
    setAccumulatedTables(prev => ({ ...prev, [tableName]: { headers: defaultHeaders, rows: defaultRows } }));
    setAccumulatedActiveTable(tableName);
    try {
      await replaceTable(tableName, defaultHeaders, defaultRows);
    } catch (err) {
      console.error('Failed to create table:', err);
      proj.setFlowNoticeTone("error");
      proj.setFlowNotice("Failed to create table");
      setAccumulatedTables(prev => { const next = { ...prev }; delete next[tableName]; return next; });
    }
  }, [proj]);

  // Handle reordering workflow nodes via drag-and-drop
  const handleReorderNodes = useCallback((draggedId, targetId, side) => {
    proj.setNodes(prev => {
      const next = prev.filter(n => n.id !== draggedId);
      const dragged = prev.find(n => n.id === draggedId);
      let idx = next.findIndex(n => n.id === targetId);
      if (side === 'after') idx += 1;
      next.splice(idx, 0, dragged);
      return next;
    });
  }, [proj.setNodes]);

  // Handle opening a table from picker
  const handleOpenTable = useCallback(async (tableName) => {
    // Immediately add placeholder and switch to the new tab
    setAccumulatedTables(prev => ({
      ...prev,
      [tableName]: { headers: [], rows: [] }
    }));
    setAccumulatedActiveTable(tableName);
    setLoadingTableName(tableName);

    try {
      const tableData = await readTable(tableName);
      setAccumulatedTables(prev => ({
        ...prev,
        [tableName]: { headers: tableData.headers, rows: tableData.rows }
      }));
    } catch (err) {
      console.error('Failed to open table:', err);
      proj.setFlowNoticeTone("error");
      proj.setFlowNotice("Failed to load table");
    } finally {
      setLoadingTableName(null);
    }
  }, [proj]);

  // ── Assemble props ──
  const workflowProps = {
    workflows: proj.workflows,
    activeWorkflowId: proj.activeWorkflowId,
    activeWorkflow: proj.activeWorkflow,
    showWorkflowMenu: proj.showWorkflowMenu,
    setShowWorkflowMenu: proj.setShowWorkflowMenu,
    workflowEditMode: proj.workflowEditMode,
    setWorkflowEditMode: proj.setWorkflowEditMode,
    workflowMenuRef: proj.workflowMenuRef,
    selectWorkflow: proj.selectWorkflow,
    addWorkflow: (onCreated) => proj.addWorkflow((w) => {
      setSel(w.nodes[0]?.id ?? null);
      if (onCreated) onCreated(w);
    }),
    renameWorkflow: proj.renameWorkflow,
    finalizeWorkflowName: proj.finalizeWorkflowName,
  };

  const settingsProps = {
    selNode, nodes, tableNames, nodePrompts, nodeSourceTables,
    setNodes: proj.setNodes, setTableNames: proj.setTableNames,
    setNodePrompts: proj.setNodePrompts, setNodeSourceTables: proj.setNodeSourceTables,
    triggerSave: proj.triggerSave, updateNodeTitle: proj.updateNodeTitle,
    saveToHistory: proj.saveToHistory,
    isRunning: orch.orchestratorStatus === 'running' || orch.orchestratorStatus === 'node_done',
  };

  const runProps = {
    selNode, nodes, tableNames, nodePrompts,
    runConfig: orch.runConfig, runGuid: orch.runGuid,
    currentNodeIndex: orch.currentNodeIndex,
    orchestratorStatus: orch.orchestratorStatus,
    orchestratorError: orch.orchestratorError,
    isPolling: orch.isPolling, pollCount: orch.pollCount,
    pollingStartTimeRef: orch.pollingStartTimeRef,
    runStartTimeRef: orch.runStartTimeRef,
    isAdvancing: orch.isAdvancing,
    isStarting: orch.isStarting,
showPauseReview: pauseReview.showPauseReview, pauseReviewTableData: pauseReview.pauseReviewTableData,
    pauseReviewTableName: orch.pauseReviewTableName,
    pauseReviewTableDirty: pauseReview.pauseReviewTableDirty, pauseReviewTableSaving: pauseReview.pauseReviewTableSaving,
    pauseReviewTableLoading: pauseReview.pauseReviewTableLoading, pauseReviewTableError: pauseReview.pauseReviewTableError,
    completedDownloads: orch.completedDownloads,
    showExportConfirmation: orch.showExportConfirmation,
    exportFileName: orch.exportFileName,
    procDots, iframeKey, reloadIframe,
    setMidTab, resetRun,
    handleAdvance: (saveFn) => orch.handleAdvance(saveFn, pauseReview.pauseReviewTableData),
    handleExportAdvance: orch.handleExportAdvance,
    handleSaveTable: pauseReview.handleSaveTable,
    retryLoadPauseReviewTable: pauseReview.retryLoadPauseReviewTable,
    forceNodeComplete: orch.forceNodeComplete,
    forceDebugDump: orch.forceDebugDump,
    setOrchestratorError: orch.setOrchestratorError,
    pauseReviewMessage: orch.pauseReviewMessage,
    textDisplayUrl: orch.textDisplayUrl,
  };

  return (
    <div style={{
      display: "flex", height: "100vh",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize: 13, color: C.black, background: C.white,
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Left section: TopBar + panels, does not stretch over the table */}
      <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <TopBar
          workflowProps={workflowProps}
          saveStatus={proj.saveStatus}
          saveTime={proj.saveTime}
          retrySave={proj.retrySave}
          triggerFlowImport={proj.triggerFlowImport}
          handleFlowExport={proj.handleFlowExport}
          flowNotice={proj.flowNotice}
          flowNoticeTone={proj.flowNoticeTone}
          importInputRef={proj.importInputRef}
          handleFlowImport={handleImport}
          activeWorkflow={proj.activeWorkflow}
          updateActiveWorkflow={proj.updateActiveWorkflow}
          triggerSave={proj.triggerSave}
          isDirty={proj.isDirty}
          onNavigate={handleNavigateAttempt}
          isLoading={isLoading}
        />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <FlowPanel
            width={panelWidths.widths.left}
            nodes={nodes}
            tableNames={tableNames}
            sel={sel}
            setSel={setSel}
            orchestratorStatus={orch.orchestratorStatus}
            isPolling={orch.isPolling}
            currentNodeIndex={orch.currentNodeIndex}
            runningNodeId={orch.runConfig?.nodes?.[orch.currentNodeIndex]?.node_id ?? null}
            runConfig={orch.runConfig}
            showPauseReview={pauseReview.showPauseReview}
            nodeCanRun={nodeCanRun}
            getNodeValidationErrors={validateNode}
            validateNode={validateNode}
            selectNode={selectNode}
            runSingle={orch.runSingle}
            deleteNode={handleDeleteNode}
            startRunWorkflow={orch.startRunWorkflow}
            resetRun={resetRun}
            stopRun={orch.stopRun}
            onAddNodeClick={onAddNodeClick}
            onReorderNodes={handleReorderNodes}
            editMode={editMode}
            setEditMode={setEditMode}
            isStarting={orch.isStarting}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            isLoading={isLoading}
          />

          <div
            style={{
              width: 4, cursor: "col-resize", background: "#e5e5e5",
              transition: "background 0.15s", touchAction: "none",
            }}
            onPointerDown={(e) => handlePointerDown(e, "left-middle")}
            onMouseEnter={(e) => e.target.style.background = "#999"}
            onMouseLeave={(e) => e.target.style.background = "#e5e5e5"}
          />

          <InputPanel
            width={panelWidths.widths.middle}
            selNode={selNode}
            midTab={midTab}
            setMidTab={setMidTab}
            settingsProps={settingsProps}
            runProps={runProps}
            orchestratorStatus={orch.orchestratorStatus}
            isPolling={orch.isPolling}
            pollCount={orch.pollCount}
            pauseReviewTableName={orch.pauseReviewTableName}
            pauseReviewTableLoading={pauseReview.pauseReviewTableLoading}
            pauseReviewTableError={pauseReview.pauseReviewTableError}
            pauseReviewTableData={pauseReview.pauseReviewTableData}
            showPauseReview={pauseReview.showPauseReview}
            editMode={editMode}
            isStarting={orch.isStarting}
          />
        </div>
      </div>

      <div
        style={{
          width: 4, cursor: "col-resize", background: "#e5e5e5",
          transition: "background 0.15s", touchAction: "none",
        }}
        onPointerDown={(e) => handlePointerDown(e, "middle-right")}
        onMouseEnter={(e) => e.target.style.background = "#999"}
        onMouseLeave={(e) => e.target.style.background = "#e5e5e5"}
      />

      {/* Table panel: full height, starts at very top of screen */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
        <TablePanel
          tables={Object.keys(pauseReviewTables).length > 0 ? pauseReviewTables : EMPTY_TABLES}
          activeTable={Object.keys(pauseReviewTables).length > 0 ? activeTable : null}
          onChangeActive={Object.keys(pauseReviewTables).length > 0 ? handleActiveTableChange : () => {}}
          onChangeTable={Object.keys(pauseReviewTables).length > 0 ? handleTableChange : () => {}}
          onCloseTable={Object.keys(pauseReviewTables).length > 0 ? handleCloseTable : null}
          onCloseAllTables={Object.keys(pauseReviewTables).length > 0 ? handleCloseAllTables : null}
          onDeleteTable={Object.keys(pauseReviewTables).length > 0 ? handleDeleteTable : null}
          onRenameTable={Object.keys(pauseReviewTables).length > 0 ? handleRenameTable : null}
          onOpenTable={handleOpenTable}
          onCreateTable={handleCreateTable}
          workflowId={activeWorkflowId}
          readOnly={false}
          loadingTableName={loadingTableName}
          orchestratorStatus={orch.orchestratorStatus}
          isPolling={orch.isPolling}
          pollCount={orch.pollCount}
pauseReviewTableDirty={tablePanelDirty}
          pauseReviewTableSaving={tablePanelSaving}
          handleSaveTable={handleSaveActiveTable}
        />
      </div>

      {showPicker && (
        <NodePicker
          onAdd={n => proj.addNode(n, pickerInsertIdx)}
          onClose={() => { setShowPicker(false); setPickerInsertIdx(null); }}
        />
      )}

      {proj.accessDenied && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999,
        }}>
          <div style={{
            ...S.modal,
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              This workflow doesn't exist or you don't have permission to view it.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => navigate("/")}
                style={{ ...S.btnGhost, color: C.white, background: C.black, padding: "6px 14px", borderRadius: 6 }}
              >
                Go to HomePage
              </button>
            </div>
          </div>
        </div>
      )}

      {showDirtyModal && (
        <div
          onClick={() => {
            setIsWaitingForSaveToNavigate(false);
            setShowDirtyModal(false);
          }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...S.modal,
              display: "flex", flexDirection: "column", gap: 16,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>
              Save changes before leaving?
            </div>
            <div style={{ fontSize: 14, color: C.mid, lineHeight: 1.5 }}>
              ⚠️ If you don't save, you will lose your changes.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button
                onClick={() => {
                  const callback = pendingNavCallbackRef.current;
                  setShowDirtyModal(false);
                  pendingNavCallbackRef.current = null;
                  if (callback) callback();
                }}
                style={{
                  padding: "6px 14px", fontSize: 14, fontWeight: 600,
                  background: "transparent", color: C.black, border: `1px solid ${C.border}`, borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                Leave without saving
              </button>
              <button
                onClick={() => {
                  setIsWaitingForSaveToNavigate(true);
                  proj.retrySave();
                }}
                disabled={proj.saveStatus === "saving"}
                style={{
                  padding: "6px 14px", fontSize: 14, fontWeight: 600,
                  background: C.black, color: C.white, border: "none", borderRadius: 6,
                  cursor: proj.saveStatus === "saving" ? "wait" : "pointer",
                  opacity: proj.saveStatus === "saving" ? 0.6 : 1,
                }}
              >
                {proj.saveStatus === "saving" ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
