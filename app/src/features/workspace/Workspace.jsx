import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { C } from "../../platform/styles.jsx";
import { readTable, deleteTable, replaceTable, renameTable } from "../../services/table.js";
import useWorkflows from "./hooks/useWorkflows.js";
import useOrchestrator from "./hooks/useOrchestrator.js";
import useQCTable from "./hooks/useQCTable.js";
import usePanelWidths from "./hooks/usePanelWidths.js";
import TopBar from "./components/TopBar.jsx";
import LeftPanel from "./components/LeftPanel.jsx";
import MiddlePanel from "./components/MiddlePanel.jsx";
import TablePanel from "./components/TablePanel.jsx";

function getCleanTableName(technicalName) {
  const match = technicalName?.match(/^[\w-]+_[a-z0-9]+_(.+)$/);
  return match ? match[1].replace(/_/g, ' ') : technicalName;
}
import NodePicker from "./components/NodePicker.jsx";

// ─────────────────────────────────────────────
// WORKSPACE — MVP-1 with Orchestrator Integration
// Three-panel layout: left (node list) + middle (settings / run) + right (table).
// ─────────────────────────────────────────────

export default function Workspace() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlWorkflowId = searchParams.get('id') ?? undefined;
  const proj = useWorkflows({ initialWorkflowId: urlWorkflowId });
  const {
    nodes, tableNames, nodePrompts, nodeSourceTables,
    activeWorkflowId, initialMetadata,
    editMode, setEditMode,
  } = proj;

  // Sync URL to active workflow — fires on initial load, workflow switch, and workflow creation
  useEffect(() => {
    if (activeWorkflowId && urlWorkflowId !== activeWorkflowId) {
      navigate(`/workflow?id=${activeWorkflowId}`, { replace: true });
    }
  }, [urlWorkflowId, activeWorkflowId, navigate]);

  // ── UI-only state ──
  const [sel, setSel] = useState(() => {
    const w = initialMetadata.workflows.find((w) => w.id === initialMetadata.activeWorkflowId) ?? initialMetadata.workflows[0];
    return w?.nodes?.[0]?.id ?? null;
  });
  const [midTab, setMidTab] = useState("settings");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerInsertIdx, setPickerInsertIdx] = useState(null);
  const [procDots, setProcDots] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);

  const [accumulatedTables, setAccumulatedTables] = useState({});
  const [accumulatedActiveTable, setAccumulatedActiveTable] = useState(null);
  const [loadingTableName, setLoadingTableName] = useState(null);
  const [tablePanelDirty, setTablePanelDirty] = useState(false);
  const [tablePanelSaving, setTablePanelSaving] = useState(false);

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

  const resetQCStateRef = useRef(() => {});

  const orch = useOrchestrator({
    nodes, tableNames, nodePrompts, nodeSourceTables,
    workflowId: activeWorkflowId,
    setFlowNotice: proj.setFlowNotice,
    setFlowNoticeTone: proj.setFlowNoticeTone,
    setSel, setMidTab,
    resetQCState: () => resetQCStateRef.current(),
    accumulatedTables,
    setAccumulatedTables,
    accumulatedActiveTable,
    setAccumulatedActiveTable,
  });

  const qc = useQCTable({
    qcTableName: orch.qcTableName,
    tableRefreshKey: orch.tableRefreshKey,
  });
  resetQCStateRef.current = qc.resetQCState;

  const panelWidths = usePanelWidths();
  const dragStartXRef = useRef(null);
  const dragInitialWidthsRef = useRef(null);

  const handleMouseDown = useCallback((e, handle) => {
    e.preventDefault();
    dragStartXRef.current = e.clientX;
    dragInitialWidthsRef.current = { left: panelWidths.widths.left, middle: panelWidths.widths.middle };
    panelWidths.startDrag(handle);
  }, [panelWidths]);

  useEffect(() => {
    if (!panelWidths.draggingRef.current) return;
    const handleMouseMove = (e) => {
      const deltaX = e.clientX - dragStartXRef.current;
      if (panelWidths.draggingRef.current === "left-middle") {
        const newLeft = dragInitialWidthsRef.current.left + deltaX;
        panelWidths.setLeftWidth(newLeft);
      } else if (panelWidths.draggingRef.current === "middle-right") {
        const newMiddle = dragInitialWidthsRef.current.middle + deltaX;
        panelWidths.setMiddleWidth(newMiddle);
      }
    };
    const handleMouseUp = () => {
      panelWidths.endDrag();
      dragStartXRef.current = null;
      dragInitialWidthsRef.current = null;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [panelWidths]);

  // Memoized table objects to prevent re-renders
  const EMPTY_TABLES = useMemo(() => ({}), []);
  const qcTables = useMemo(() => {
    const current = qc.qcTableData && orch.qcTableName
      ? { [orch.qcTableName]: qc.qcTableData }
      : {};
    const result = { ...accumulatedTables, ...current };
    console.log('[Workspace] qcTables:', Object.keys(result), '| accumulated:', Object.keys(accumulatedTables), '| current:', orch.qcTableName, '| qcTableData rows:', qc.qcTableData?.rows?.length);
    return result;
  }, [accumulatedTables, orch.qcTableName, qc.qcTableData]);

  const activeTable = accumulatedActiveTable || orch.qcTableName;

  // Auto-select new table when qcTableName changes (new node completes)
  useEffect(() => {
    if (orch.qcTableName) setAccumulatedActiveTable(orch.qcTableName);
  }, [orch.qcTableName]);

  // Accumulate tables when table data arrives (for both single-node and workflow runs)
  useEffect(() => {
    if (qc.qcTableData && orch.qcTableName) {
      console.log('[Workspace] Accumulating table from useQCTable:', orch.qcTableName);
      setAccumulatedTables(prev => ({
        ...prev,
        [orch.qcTableName]: qc.qcTableData
      }));
    }
  }, [qc.qcTableData, orch.qcTableName]);

  // Sync qcTableData to orchestrator ref for accumulation on advance
  useEffect(() => {
    if (orch.updateQcTableDataRef) {
      orch.updateQcTableDataRef(qc.qcTableData);
    }
  }, [qc.qcTableData, orch.updateQcTableDataRef]);

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

  // Reset orchestrator + QC when workflow changes
  const prevWorkflowIdRef = useRef(activeWorkflowId);
  useEffect(() => {
    if (prevWorkflowIdRef.current === activeWorkflowId) return;
    prevWorkflowIdRef.current = activeWorkflowId;
    hasRestoredRef.current = false; // re-arm guard for new workflow
    orch.resetRun();
    qc.resetQCState();
    orch.setQcTableName(null);
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

      const fileType = node.settings?.file_type || node.file_type;
      if (fileType === "spreadsheet") {
        const sheetName = node.settings?.sheet_name?.trim();
        if (!sheetName) errors.push("Sheet name required for spreadsheet");
      }
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
      if (!sourceTable?.trim()) errors.push("Input table required");

      const fileName = nodePrompts[node.id]?.trim();
      if (!fileName) errors.push("Export file name required");
    }

    if (node.node_type === "ai_export") {
      const prompt = nodePrompts[node.id]?.trim();
      if (!prompt) errors.push("Export prompt required");

      const sourceTable = nodeSourceTables[node.id];
      if (!sourceTable?.trim()) errors.push("Input table required");
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
      return !!(nodeSourceTables[node.id]?.trim() && nodePrompts[node.id]?.trim());
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
      qc.resetQCState();
    });
  };

  const reloadIframe = () => setIframeKey(k => k + 1);

  // Wrap resetRun - orchestrator handles all reset logic
  const resetRun = useCallback(() => {
    orch.resetRun();
  }, [orch]);

  // Handle table change - updates both current QC table and accumulated tables
  const handleTableChange = useCallback((name, data) => {
    // Update current QC table
    qc.handleQcTableChange(name, data);
    // Also update in accumulated tables if exists
    if (accumulatedTables[name]) {
      setAccumulatedTables(prev => ({
        ...prev,
        [name]: data
      }));
    }
    setTablePanelDirty(true);
  }, [qc, accumulatedTables]);

  // Save the currently active table — works for both QC and non-QC tables
  const handleSaveActiveTable = useCallback(async () => {
    if (!tablePanelDirty || tablePanelSaving) return;
    const name = activeTable;
    const data = qcTables[name];
    if (!name || !data) return;
    setTablePanelSaving(true);
    try {
      await replaceTable(name, data.headers, data.rows);
      setTablePanelDirty(false);
    } catch (err) {
      console.error('[Table save] Failed:', err);
    } finally {
      setTablePanelSaving(false);
    }
  }, [tablePanelDirty, tablePanelSaving, activeTable, qcTables]);

  // Handle active table change (user clicks a tab)
  // Only updates accumulatedActiveTable, NOT qcTableName.
  // qcTableName should only be set by the orchestrator when a node completes.
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
    if (orch.qcTableName === name) {
      orch.setQcTableName(null);
    }
    setTablePanelDirty(false);
  }, [accumulatedActiveTable, orch.qcTableName, orch.setQcTableName]);

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
    const data = qcTables[oldName] || accumulatedTables[oldName];
    if (!data) return;

    // Optimistic UI update
    setAccumulatedTables(prev => {
      const next = { ...prev, [newName]: data };
      delete next[oldName];
      return next;
    });
    if (accumulatedActiveTable === oldName) setAccumulatedActiveTable(newName);
    if (orch.qcTableName === oldName) orch.setQcTableName(newName);

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
      if (orch.qcTableName === newName) orch.setQcTableName(oldName);
    }
  }, [qcTables, accumulatedTables, accumulatedActiveTable, orch.qcTableName, orch.setQcTableName, proj]);

  // Handle closing all tables
  const handleCloseAllTables = useCallback(() => {
    setAccumulatedTables({});
    setAccumulatedActiveTable(null);
    setTablePanelDirty(false);
    qc.resetQCState();
  }, [qc]);

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
    reorderWorkflow: proj.reorderWorkflow,
    deleteWorkflow: proj.deleteWorkflow,
    toggleWorkflowEditMode: proj.toggleWorkflowEditMode,
    normalizeWorkflowNames: proj.normalizeWorkflowNames,
  };

  const settingsProps = {
    selNode, nodes, tableNames, nodePrompts, nodeSourceTables,
    setNodes: proj.setNodes, setTableNames: proj.setTableNames,
    setNodePrompts: proj.setNodePrompts, setNodeSourceTables: proj.setNodeSourceTables,
    triggerSave: proj.triggerSave, updateNodeTitle: proj.updateNodeTitle,
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
    showQC: qc.showQC, qcTableData: qc.qcTableData,
    qcTableName: orch.qcTableName,
    qcTableDirty: qc.qcTableDirty, qcTableSaving: qc.qcTableSaving,
    qcTableLoading: qc.qcTableLoading, qcTableError: qc.qcTableError,
    completedDownloads: orch.completedDownloads,
    showExportConfirmation: orch.showExportConfirmation,
    exportFileName: orch.exportFileName,
    procDots, iframeKey, reloadIframe,
    setMidTab, resetRun,
    handleAdvance: (saveFn) => orch.handleAdvance(saveFn, qc.qcTableData),
    handleExportAdvance: orch.handleExportAdvance,
    handleSaveTable: qc.handleSaveTable,
    retryLoadQcTable: qc.retryLoadQcTable,
    forceNodeComplete: orch.forceNodeComplete,
    forceDebugDump: orch.forceDebugDump,
    setOrchestratorError: orch.setOrchestratorError,
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
        />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <LeftPanel
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
            showQC={qc.showQC}
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
            editMode={editMode}
            setEditMode={setEditMode}
            isStarting={orch.isStarting}
          />

          <div
            style={{
              width: 4, cursor: "col-resize", background: "#e5e5e5",
              transition: "background 0.15s",
            }}
            onMouseDown={(e) => handleMouseDown(e, "left-middle")}
            onMouseEnter={(e) => e.target.style.background = "#999"}
            onMouseLeave={(e) => e.target.style.background = "#e5e5e5"}
          />

          <MiddlePanel
            width={panelWidths.widths.middle}
            selNode={selNode}
            midTab={midTab}
            setMidTab={setMidTab}
            settingsProps={settingsProps}
            runProps={runProps}
            orchestratorStatus={orch.orchestratorStatus}
            isPolling={orch.isPolling}
            pollCount={orch.pollCount}
            qcTableName={orch.qcTableName}
            qcTableLoading={qc.qcTableLoading}
            qcTableError={qc.qcTableError}
            qcTableData={qc.qcTableData}
            showQC={qc.showQC}
            editMode={editMode}
            isStarting={orch.isStarting}
          />
        </div>
      </div>

      <div
        style={{
          width: 4, cursor: "col-resize", background: "#e5e5e5",
          transition: "background 0.15s",
        }}
        onMouseDown={(e) => handleMouseDown(e, "middle-right")}
        onMouseEnter={(e) => e.target.style.background = "#999"}
        onMouseLeave={(e) => e.target.style.background = "#e5e5e5"}
      />

      {/* Table panel: full height, starts at very top of screen */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
        <TablePanel
          tables={Object.keys(qcTables).length > 0 ? qcTables : EMPTY_TABLES}
          activeTable={Object.keys(qcTables).length > 0 ? activeTable : null}
          onChangeActive={Object.keys(qcTables).length > 0 ? handleActiveTableChange : () => {}}
          onChangeTable={Object.keys(qcTables).length > 0 ? handleTableChange : () => {}}
          onCloseTable={Object.keys(qcTables).length > 0 ? handleCloseTable : null}
          onCloseAllTables={Object.keys(qcTables).length > 0 ? handleCloseAllTables : null}
          onDeleteTable={Object.keys(qcTables).length > 0 ? handleDeleteTable : null}
          onRenameTable={Object.keys(qcTables).length > 0 ? handleRenameTable : null}
          onOpenTable={handleOpenTable}
          onCreateTable={handleCreateTable}
          workflowId={activeWorkflowId}
          readOnly={false}
          loadingTableName={loadingTableName}
          orchestratorStatus={orch.orchestratorStatus}
          isPolling={orch.isPolling}
          pollCount={orch.pollCount}
          qcTableDirty={tablePanelDirty}
          qcTableSaving={tablePanelSaving}
          handleSaveTable={handleSaveActiveTable}
        />
      </div>

      {showPicker && (
        <NodePicker
          onAdd={n => proj.addNode(n, pickerInsertIdx)}
          onClose={() => { setShowPicker(false); setPickerInsertIdx(null); }}
          isFirstPosition={nodes.length === 0}
        />
      )}
    </div>
  );
}
