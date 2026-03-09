import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { C } from "../../platform/styles.jsx";
import useProjects from "./hooks/useProjects.js";
import useOrchestrator from "./hooks/useOrchestrator.js";
import useQCTable from "./hooks/useQCTable.js";
import usePanelWidths from "./hooks/usePanelWidths.js";
import TopBar from "./components/TopBar.jsx";
import LeftPanel from "./components/LeftPanel.jsx";
import MiddlePanel from "./components/MiddlePanel.jsx";
import TablePanel from "./components/TablePanel.jsx";
import NodePicker from "./components/NodePicker.jsx";

// ─────────────────────────────────────────────
// WORKSPACE — MVP-1 with Orchestrator Integration
// Three-panel layout: left (node list) + middle (settings / run) + right (table).
// ─────────────────────────────────────────────

export default function Workspace() {
  const proj = useProjects();
  const {
    nodes, tableNames, nodePrompts, nodeSourceTables,
    activeProjectId, initialMetadata,
    editMode, setEditMode,
  } = proj;

  // ── UI-only state ──
  const [sel, setSel] = useState(() => {
    const p = initialMetadata.projects.find((p) => p.id === initialMetadata.activeProjectId) ?? initialMetadata.projects[0];
    return p?.nodes?.[0]?.id ?? null;
  });
  const [midTab, setMidTab] = useState("settings");
  const [showPicker, setShowPicker] = useState(false);
  const [pickerInsertIdx, setPickerInsertIdx] = useState(null);
  const [procDots, setProcDots] = useState(0);
  const [iframeKey, setIframeKey] = useState(0);

  const [accumulatedTables, setAccumulatedTables] = useState({});
  const [accumulatedActiveTable, setAccumulatedActiveTable] = useState(null);

  const resetQCStateRef = useRef(() => {});

  const orch = useOrchestrator({
    nodes, tableNames, nodePrompts, nodeSourceTables,
    workflowId: activeProjectId,
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
    orchestratorStatus: orch.orchestratorStatus,
    qcTableName: orch.qcTableName,
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
    console.log('[Workspace] qcTables:', Object.keys(result), '| accumulated:', Object.keys(accumulatedTables), '| current:', orch.qcTableName);
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
      // Only add if not already accumulated (avoid duplicates)
      if (!accumulatedTables[orch.qcTableName]) {
        console.log('[Workspace] Accumulating table from useQCTable:', orch.qcTableName);
        setAccumulatedTables(prev => ({
          ...prev,
          [orch.qcTableName]: qc.qcTableData
        }));
      }
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

  // Reset orchestrator + QC when project changes
  const prevProjectIdRef = useRef(activeProjectId);
  useEffect(() => {
    if (prevProjectIdRef.current === activeProjectId) return;
    prevProjectIdRef.current = activeProjectId;
    orch.resetRun();
    qc.resetQCState();
    orch.setQcTableName(null);
    setSel(nodes[0]?.id ?? null);
    setMidTab("settings");
  }, [activeProjectId, nodes]);

  const selNode = nodes.find(n => n.id === sel) ?? nodes[0];

  const selectNode = (id) => {
    setSel(id);
    const n = nodes.find(x => x.id === id);
    if (!n) return;
    setMidTab("settings");
  };

  const nodeCanRun = (node) => {
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
      const active = metadata.projects.find((p) => p.id === metadata.activeProjectId) ?? metadata.projects[0];
      setSel(active?.nodes?.[0]?.id ?? null);
      orch.resetRun();
      qc.resetQCState();
    });
  };

  const reloadIframe = () => setIframeKey(k => k + 1);

  // Wrap resetRun to also reset QC
  const resetRun = useCallback(() => {
    orch.resetRun();
    qc.resetQCState();
    orch.setQcTableName(null);
    setAccumulatedTables({});
    setAccumulatedActiveTable(null);
  }, [orch, qc]);

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
  }, [qc, accumulatedTables]);

  // Handle active table change (user clicks a tab)
  // Only updates accumulatedActiveTable, NOT qcTableName.
  // qcTableName should only be set by the orchestrator when a node completes.
  const handleActiveTableChange = useCallback((name) => {
    setAccumulatedActiveTable(name);
  }, []);

  // ── Assemble props ──
  const projectProps = {
    projects: proj.projects,
    activeProjectId: proj.activeProjectId,
    activeProject: proj.activeProject,
    showProjectMenu: proj.showProjectMenu,
    setShowProjectMenu: proj.setShowProjectMenu,
    projectEditMode: proj.projectEditMode,
    setProjectEditMode: proj.setProjectEditMode,
    projectMenuRef: proj.projectMenuRef,
    selectProject: proj.selectProject,
    addProject: (onCreated) => proj.addProject((p) => {
      setSel(p.nodes[0]?.id ?? null);
      if (onCreated) onCreated(p);
    }),
    renameProject: proj.renameProject,
    finalizeProjectName: proj.finalizeProjectName,
    reorderProject: proj.reorderProject,
    deleteProject: proj.deleteProject,
    toggleProjectEditMode: proj.toggleProjectEditMode,
    normalizeProjectNames: proj.normalizeProjectNames,
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
    isAdvancing: orch.isAdvancing,
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
      display: "flex", flexDirection: "column", height: "100vh",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      fontSize: 13, color: C.black, background: C.white,
    }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <TopBar
        projectProps={projectProps}
        saveStatus={proj.saveStatus}
        saveTime={proj.saveTime}
        retrySave={proj.retrySave}
        triggerFlowImport={proj.triggerFlowImport}
        handleFlowExport={proj.handleFlowExport}
        flowNotice={proj.flowNotice}
        flowNoticeTone={proj.flowNoticeTone}
        importInputRef={proj.importInputRef}
        handleFlowImport={handleImport}
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
          showQC={qc.showQC}
          nodeCanRun={nodeCanRun}
          selectNode={selectNode}
          runSingle={orch.runSingle}
          deleteNode={handleDeleteNode}
          startRunWorkflow={orch.startRunWorkflow}
          resetRun={resetRun}
          onAddNodeClick={onAddNodeClick}
          editMode={editMode}
          setEditMode={setEditMode}
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
        />

        <div
          style={{
            width: 4, cursor: "col-resize", background: "#e5e5e5",
            transition: "background 0.15s",
          }}
          onMouseDown={(e) => handleMouseDown(e, "middle-right")}
          onMouseEnter={(e) => e.target.style.background = "#999"}
          onMouseLeave={(e) => e.target.style.background = "#e5e5e5"}
        />

        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minWidth: 0 }}>
          {Object.keys(qcTables).length === 0 && orch.orchestratorStatus === 'idle' ? (
            <TablePanel
              tables={EMPTY_TABLES}
              activeTable={null}
              onChangeActive={() => {}}
              onChangeTable={() => {}}
            />
          ) : Object.keys(qcTables).length > 0 ? (
            <TablePanel
              tables={qcTables}
              activeTable={activeTable}
              onChangeActive={handleActiveTableChange}
              onChangeTable={handleTableChange}
              readOnly={false}
            />
          ) : qc.showQC && qc.qcTableError ? (
            <div style={{ padding: 40, color: C.muted, fontSize: 12, textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#dc2626', marginBottom: 8 }}>Failed to load table</div>
              <div style={{ maxWidth: 300, margin: "0 auto", lineHeight: 1.6 }}>{qc.qcTableError}</div>
              <div style={{ marginTop: 4, fontSize: 10 }}>{orch.qcTableName}</div>
              <button onClick={qc.retryLoadQcTable} style={{ marginTop: 12, fontSize: 11 }}>Retry</button>
            </div>
          ) : qc.qcTableLoading ? (
            <div style={{ padding: 40, color: C.muted, fontSize: 12, textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>📊</div>
              <div>Loading table data...</div>
              {orch.qcTableName && <div style={{ marginTop: 4, fontSize: 10 }}>{orch.qcTableName}</div>}
            </div>
          ) : (
            <div style={{ padding: 40, color: C.muted, fontSize: 12, textAlign: "center" }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>⏳</div>
              <div>Workflow running...</div>
              {orch.pollCount > 0 && <div style={{ marginTop: 8, fontSize: 10 }}>Poll #{orch.pollCount}</div>}
              {orch.pollCount >= 30 && (
                <div style={{ marginTop: 8, color: '#92400e', fontWeight: 600 }}>
                  Workflow may be stalled
                </div>
              )}
            </div>
          )}
        </div>
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
