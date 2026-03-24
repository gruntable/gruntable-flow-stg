import { useRef, useEffect } from "react";
import { C, S } from "../../../platform/styles.jsx";
import { fetchWithAuth } from "../../../services/api.js";

function getCleanTableName(technicalName) {
  const match = technicalName?.match(/^[\w-]+_[a-z0-9]+_(.+)$/);
  return match ? match[1].replace(/_/g, ' ') : technicalName;
}

function Spinner({ label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.black}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
    </div>
  );
}

function StatusBar({ orchestratorStatus, pollCount, isStalled, onForceDone, onDebug, onReset, isMultiNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "5px 12px", borderTop: `1px solid ${C.border}`,
      fontSize: 10, color: C.muted, background: C.bg, flexShrink: 0,
    }}>
      <span>
        status: {orchestratorStatus}
        {orchestratorStatus === 'running' && (
          <>
            {' · '}polling: on{pollCount > 0 && ` (#${pollCount})`}
            {isStalled && ' · ⚠️ May be stalled'}
          </>
        )}
      </span>
      {isStalled && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button 
            onClick={onForceDone}
            style={{ 
              fontSize: 10, padding: "2px 8px", 
              background: "#f59e0b", color: "#fff", border: "none", borderRadius: 3,
              cursor: "pointer"
            }}
          >
            Force Done
          </button>
          <button 
            onClick={onDebug}
            style={{ 
              fontSize: 10, padding: "2px 8px", 
              background: "#3b82f6", color: "#fff", border: "none", borderRadius: 3,
              cursor: "pointer"
            }}
          >
            🐛
          </button>
          {isMultiNode && (
            <button 
              onClick={onReset}
              style={{ 
                fontSize: 10, padding: "2px 8px", 
                background: C.border, border: `1px solid ${C.muted}`, borderRadius: 3,
                cursor: "pointer"
              }}
            >
              ↻
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunTab({
  selNode, nodes, tableNames, nodePrompts,
  runConfig, runGuid, currentNodeIndex,
  orchestratorStatus, orchestratorError,
  isPolling, pollCount, pollingStartTimeRef, runStartTimeRef,
  isAdvancing, isStarting,
  showQC, qcTableData, qcTableName,
  qcTableDirty, qcTableSaving,
  qcTableLoading, qcTableError,
  completedDownloads, showExportConfirmation, exportFileName,
  procDots, iframeKey, reloadIframe,
  setMidTab,
  resetRun, handleAdvance, handleExportAdvance,
  handleSaveTable, retryLoadQcTable,
  forceNodeComplete,
  forceDebugDump,
  setOrchestratorError,
}) {
  const iframeLoggedRef = useRef(false);
  const totalNodes = runConfig?.nodes?.length ?? 0;
  const isMultiNode = totalNodes > 1;

  // Reset log guard when a new run starts
  useEffect(() => {
    if (isStarting) iframeLoggedRef.current = false;
  }, [isStarting]);

  // Determine which node to display
  const currentOrchestratorNode = runConfig?.nodes?.[currentNodeIndex];
  const isRunning = orchestratorStatus === 'running' || orchestratorStatus === 'node_done' || orchestratorStatus === 'export_downloaded';
  const workflowNode = currentOrchestratorNode
    ? nodes.find(node => node.id === currentOrchestratorNode.node_id)
    : null;
  const n = isRunning && workflowNode ? workflowNode : selNode;

  if (!n) return null;

  // State resolution
  const isStalled = orchestratorStatus === 'running' && pollCount >= 30;

  // IDLE State
  if (!runGuid && !isStarting && !orchestratorError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: C.muted }}>
          <div style={{ fontSize: 32 }}>▶</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{n.label}</div>
          <div style={{ fontSize: 12 }}>Click ▶ on the left or "Run Workflow" to execute.</div>
        </div>
      </div>
    );
  }

  // STARTING State
  if (isStarting) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Spinner label="Starting workflow..." />
        </div>
      </div>
    );
  }

  // ERROR State
  if (orchestratorError) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Error</div>
          <div style={{ color: C.muted, fontSize: 12, maxWidth: 280, lineHeight: 1.6 }}>{orchestratorError}</div>
          {isMultiNode && <button onClick={resetRun} style={{ ...S.btnS, marginTop: 8 }}>↻ Reset</button>}
        </div>
      </div>
    );
  }

  // QC_LOADING State
  if (orchestratorStatus === 'node_done' && qcTableLoading && !qcTableData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
          <Spinner label="Loading QC table..." />
          <div style={{ fontSize: 11, color: C.muted }}>{getCleanTableName(qcTableName)}</div>
        </div>
        <StatusBar 
          orchestratorStatus={orchestratorStatus} 
          pollCount={pollCount} 
          isStalled={isStalled}
          onForceDone={forceNodeComplete}
          onDebug={forceDebugDump}
          onReset={resetRun}
          isMultiNode={isMultiNode}
        />
      </div>
    );
  }

  // QC_ERROR State
  if (orchestratorStatus === 'node_done' && qcTableError && !qcTableData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Failed to load QC table</div>
          <div style={{ color: C.muted, fontSize: 12, maxWidth: 280, lineHeight: 1.6 }}>{qcTableError}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{getCleanTableName(qcTableName)}</div>
          <button onClick={retryLoadQcTable} style={{ ...S.btnP, marginTop: 8 }}>Retry</button>
          {isMultiNode && <button onClick={resetRun} style={{ ...S.btnS, marginTop: 4 }}>↻ Reset</button>}
        </div>
        <StatusBar 
          orchestratorStatus={orchestratorStatus} 
          pollCount={pollCount} 
          isStalled={isStalled}
          onForceDone={forceNodeComplete}
          onDebug={forceDebugDump}
          onReset={resetRun}
          isMultiNode={isMultiNode}
        />
      </div>
    );
  }

  // QC_REVIEW State - Shows only control header (table is in TablePanel)
  // Skip for single node runs - go straight to Workflow Complete
  if (orchestratorStatus === 'node_done' && showQC && qcTableData && isMultiNode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* QC Control Header Only */}
        <div style={{
          ...S.flex(0), justifyContent: "space-between",
          padding: "10px 12px", borderBottom: `1px solid ${C.border}`,
          background: "#f0fdf4", flexShrink: 0, flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>✓</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Node Complete - Quality Check</div>
              <div style={{ fontSize: 11, color: C.muted }}>{getCleanTableName(qcTableName)}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {qcTableSaving && (
              <span style={{ fontSize: 11, color: C.muted }}>Saving…</span>
            )}
            {!qcTableDirty && !qcTableSaving && (
              <span style={{ fontSize: 11, color: '#16a34a' }}>Synced</span>
            )}
            {isMultiNode && (
              <button
                onClick={() => handleAdvance(qcTableDirty ? handleSaveTable : null)}
                disabled={isAdvancing}
                style={{ ...S.btnP, fontSize: 12, padding: "6px 16px" }}
              >
                {isAdvancing ? 'Processing...' : currentNodeIndex === totalNodes - 1 ? 'Complete Review & Finish' : 'Complete Review & Continue'}
              </button>
            )}
          </div>
        </div>
        
        {/* Empty content area - table is in TablePanel */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13 }}>Table is displayed in the right panel</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>Review and edit the data there</div>
          </div>
        </div>

        <StatusBar 
          orchestratorStatus={orchestratorStatus} 
          pollCount={pollCount} 
          isStalled={isStalled}
          onForceDone={forceNodeComplete}
          onDebug={forceDebugDump}
          onReset={resetRun}
          isMultiNode={isMultiNode}
        />
      </div>
    );
  }

  // EXPORT_DOWNLOADED State
  const downloadKey = runGuid && currentNodeIndex !== null ? `${runGuid}:${currentNodeIndex}` : null;
  const hasDownloaded = downloadKey && completedDownloads.has(downloadKey);
  
  if (hasDownloaded) {
    const fileName = runConfig?.nodes?.[currentNodeIndex]?.webhook_body?.fileName || exportFileName || 'export.xlsx';
    const isLastBeforeEnd = currentNodeIndex >= totalNodes - 1;
    const isConfirmed = showExportConfirmation || orchestratorStatus === 'export_downloaded';

    const handleRedownload = async () => {
      const currentNode = runConfig?.nodes?.[currentNodeIndex];
      if (!currentNode?.webhook_url) return;
      try {
        const response = await fetchWithAuth(currentNode.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentNode.webhook_body),
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('[WF-DEBUG] redownload FAILED:', err);
        setOrchestratorError('Redownload failed: ' + err.message);
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
          <div style={{ fontSize: 48 }}>✓</div>
          {!isMultiNode ? (
            <div style={{ fontSize: 16, fontWeight: 600, color: C.black }}>Run Step Completed</div>
          ) : null}
          <div style={{ fontSize: 14, fontWeight: 600, color: C.black, marginTop: !isMultiNode ? 4 : 0 }}>
            File Downloaded Successfully
          </div>
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center", maxWidth: 320 }}>
            <strong>{fileName}</strong> has been automatically downloaded.<br />
            Check your downloads folder or browser's download bar.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <button
              onClick={handleRedownload}
              disabled={isAdvancing}
              style={{ ...S.btnS, display: "flex", alignItems: "center", gap: 6 }}
            >
              <span>↻</span> Download Again
            </button>
            {isConfirmed ? (
              <button
                onClick={!isMultiNode ? resetRun : handleExportAdvance}
                disabled={isAdvancing}
                style={{ ...S.btnP, display: "flex", alignItems: "center", gap: 6 }}
              >
                {isAdvancing ? 'Processing...' : !isMultiNode ? 'Close' : isLastBeforeEnd ? 'Finish Workflow' : 'Next →'}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: C.muted, alignSelf: "center" }}>Confirming…</span>
            )}
          </div>
        </div>
        <StatusBar
          orchestratorStatus={orchestratorStatus}
          pollCount={pollCount}
          isStalled={isStalled}
          onForceDone={forceNodeComplete}
          onDebug={forceDebugDump}
          onReset={resetRun}
          isMultiNode={isMultiNode}
        />
      </div>
    );
  }

  // AI_FORM / EXTRACTION_INPUT State
  if ((n.behavior === "ai_form" || n.behavior === "interactive") && 
      (runConfig?.nodes?.[currentNodeIndex]?.n8n_form_urls?.length > 0 || runConfig?.nodes?.[currentNodeIndex]?.form_url)) {
    const blockReason = runBlockReason(n, nodePrompts);
    if (blockReason) {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32 }}>{blockReason.icon}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{blockReason.title}</div>
            <div style={{ color: C.muted, fontSize: 12, maxWidth: 260, lineHeight: 1.6 }}>{blockReason.body}</div>
            <button onClick={() => setMidTab("settings")} style={{ ...S.btnS, marginTop: 8 }}>
              {blockReason.cta}
            </button>
          </div>
          <StatusBar 
            orchestratorStatus={orchestratorStatus} 
            pollCount={pollCount} 
            isStalled={isStalled}
            onForceDone={forceNodeComplete}
            onDebug={forceDebugDump}
            onReset={resetRun}
            isMultiNode={isMultiNode}
          />
        </div>
      );
    }

    const fileType = selNode?.settings?.file_type || 'pdf';
    const formUrls = runConfig.nodes[currentNodeIndex]?.n8n_form_urls || [];
    const formUrlEntry = formUrls.find(f => f.fileType === fileType);
    const src = formUrlEntry?.url;

    if (!iframeLoggedRef.current && runStartTimeRef?.current != null) {
      iframeLoggedRef.current = true;
      const now = performance.now();
      console.log('[TIMING] Iframe rendered at', now.toFixed(1), 'ms | total from click:', (now - runStartTimeRef.current).toFixed(0), 'ms');
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{
          ...S.flex(0), justifyContent: "space-between",
          padding: "6px 12px", borderBottom: `1px solid ${C.border}`,
          background: C.bg, flexShrink: 0,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: C.muted }}>
              {currentOrchestratorNode?.label || n.label}{tableNames[n.id] ? ` — ${getCleanTableName(tableNames[n.id])}` : ""}
            </span>
            {n.node_type === "ai_transformation" && nodePrompts[n.id]?.trim() && (
              <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ✨ {nodePrompts[n.id].trim()}
              </span>
            )}
          </div>
          <button onClick={reloadIframe} style={S.btnGhost} title="Reload form">↺ Reload</button>
        </div>
        <iframe
          key={iframeKey}
          src={src}
          style={{ flex: 1, border: "none", width: "100%" }}
          allow="camera; microphone"
          title={currentOrchestratorNode?.label || n.label}
        />
        <StatusBar 
          orchestratorStatus={orchestratorStatus} 
          pollCount={pollCount} 
          isStalled={isStalled}
          onForceDone={forceNodeComplete}
          onDebug={forceDebugDump}
          onReset={resetRun}
          isMultiNode={isMultiNode}
        />
      </div>
    );
  }

  // RUNNING State (with optional STALLED overlay in status bar)
  if (orchestratorStatus === 'running') {
    const node = runConfig?.nodes?.[currentNodeIndex];
    let label = `Processing${".".repeat(procDots)}`;
    
    // Customize label based on node type
    if (node?.behavior === 'ai_form') {
      label = `Extracting data from file${".".repeat(procDots)}`;
    } else if (node?.behavior === 'ai_go') {
      label = `Applying AI transformation${".".repeat(procDots)}`;
    } else if (node?.behavior === 'basic_export' || node?.behavior === 'ai_export') {
      label = `Generating export file${".".repeat(procDots)}`;
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Spinner label={label} />
          <div style={{ fontSize: 12, color: C.muted }}>
            Node {currentNodeIndex !== null ? currentNodeIndex + 1 : '...'} of {totalNodes || '...'}
          </div>
        </div>
        <StatusBar 
          orchestratorStatus={orchestratorStatus} 
          pollCount={pollCount} 
          isStalled={isStalled}
          onForceDone={forceNodeComplete}
          onDebug={forceDebugDump}
          onReset={resetRun}
          isMultiNode={isMultiNode}
        />
      </div>
    );
  }

  // CANCELLED State
  if (orchestratorStatus === 'cancelled') {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
          <div style={{ fontSize: 48 }}>🛑</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.black }}>Run Stopped</div>
          <div style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
            Stopped at node {currentNodeIndex !== null ? currentNodeIndex + 1 : '—'} of {totalNodes}.
          </div>
          <button onClick={resetRun} style={{ ...S.btnP, marginTop: 8 }}>Run Again</button>
        </div>
      </div>
    );
  }

  // COMPLETE State
  if (orchestratorStatus === 'done') {
    const completionTitle = isMultiNode ? 'Run Workflow Completed' : 'Run Step Completed';
    const completionSubtext = isMultiNode
      ? `All ${totalNodes} steps completed`
      : null;
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
          <div style={{ fontSize: 48 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.black }}>{completionTitle}</div>
          {completionSubtext && (
            <div style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
              {completionSubtext}
            </div>
          )}
          <button onClick={resetRun} style={{ ...S.btnP, marginTop: 8 }}>Close</button>
        </div>
        <StatusBar
          orchestratorStatus={orchestratorStatus}
          pollCount={pollCount}
          isStalled={false}
          onForceDone={forceNodeComplete}
          onDebug={forceDebugDump}
          onReset={resetRun}
          isMultiNode={isMultiNode}
        />
      </div>
    );
  }

  // NODE_DONE catch-all - show loading while UI state catches up
  if (orchestratorStatus === 'node_done') {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Spinner label="Loading results..." />
        </div>
        <StatusBar
          orchestratorStatus={orchestratorStatus}
          pollCount={pollCount}
          isStalled={isStalled}
          onForceDone={forceNodeComplete}
          onDebug={forceDebugDump}
          onReset={resetRun}
          isMultiNode={isMultiNode}
        />
      </div>
    );
  }

  // Default fallback
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: C.muted }}>
        <div style={{ fontSize: 32 }}>▶</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{n.label}</div>
        <div style={{ fontSize: 12 }}>Ready to run</div>
      </div>
    </div>
  );
}

function runBlockReason(node, nodePrompts) {
  if (node.node_type === "ai_transformation" && !nodePrompts[node.id]?.trim())
    return { icon: "✨", title: "Prompt required", body: "Enter a transformation prompt in the Settings tab before running.", cta: "← Go to Settings" };
  if (node.behavior === "ai_export" && !nodePrompts[node.id]?.trim())
    return { icon: "📤✨", title: "Export prompt required", body: "Enter an export prompt in the Settings tab before running.", cta: "← Go to Settings" };
  return null;
}
