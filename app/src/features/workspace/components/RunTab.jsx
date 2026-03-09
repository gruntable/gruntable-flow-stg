import { C, S } from "../../../platform/styles.jsx";
function Spinner({ label }) {
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
      <div style={{ width: 40, height: 40, border: `3px solid ${C.border}`, borderTop: `3px solid ${C.black}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
    </div>
  );
}

export default function RunTab({
  selNode, nodes, tableNames, nodePrompts,
  runConfig, runGuid, currentNodeIndex,
  orchestratorStatus, orchestratorError,
  isPolling, pollCount, pollingStartTimeRef,
  isAdvancing,
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
  // Determine which node to display:
  // - When workflow is running: show the current orchestrator node
  // - When idle: show the user's selected node
  const currentOrchestratorNode = runConfig?.nodes?.[currentNodeIndex];
  const isRunning = orchestratorStatus === 'running' || orchestratorStatus === 'node_done' || orchestratorStatus === 'export_downloaded';
  const workflowNode = currentOrchestratorNode
    ? nodes.find(node => node.id === currentOrchestratorNode.node_id)
    : null;
  const n = isRunning && workflowNode ? workflowNode : selNode;

  if (!n) return null;

  // Error
  if (orchestratorError) {
    return (
      <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, textAlign: "center" }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Error</div>
        <div style={{ color: C.muted, fontSize: 12, maxWidth: 280, lineHeight: 1.6 }}>{orchestratorError}</div>
        <button onClick={resetRun} style={{ ...S.btnS, marginTop: 8 }}>↻ Reset</button>
      </div>
    );
  }

  // QC loading
  if (orchestratorStatus === 'node_done' && qcTableLoading && !qcTableData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, textAlign: "center" }}>
          <Spinner label="Loading QC table..." />
          <div style={{ fontSize: 11, color: C.muted }}>{qcTableName}</div>
        </div>
      </div>
    );
  }

  // QC error
  if (orchestratorStatus === 'node_done' && qcTableError && !qcTableData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ padding: 32, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Failed to load QC table</div>
          <div style={{ color: C.muted, fontSize: 12, maxWidth: 280, lineHeight: 1.6 }}>{qcTableError}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{qcTableName}</div>
          <button onClick={retryLoadQcTable} style={{ ...S.btnP, marginTop: 8 }}>Retry</button>
          <button onClick={resetRun} style={{ ...S.btnS, marginTop: 4 }}>↻ Reset</button>
        </div>
      </div>
    );
  }

  // QC panel
  if (showQC && qcTableData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{
          ...S.flex(0), justifyContent: "space-between",
          padding: "10px 12px", borderBottom: `1px solid ${C.border}`,
          background: "#f0fdf4", flexShrink: 0, flexWrap: "wrap", gap: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>✓</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Node Complete - Quality Check</div>
              <div style={{ fontSize: 11, color: C.muted }}>{qcTableName}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {qcTableSaving && (
              <span style={{ fontSize: 11, color: C.muted }}>Saving…</span>
            )}
            {qcTableDirty && !qcTableSaving && (
              <>
                <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>
                  Table has changed — save so you don't lose data on refresh
                </span>
                <button
                  onClick={handleSaveTable}
                  style={{ ...S.btnP, fontSize: 11, padding: "4px 12px", background: '#dc2626', borderColor: '#dc2626' }}
                >
                  Save
                </button>
              </>
            )}
            {!qcTableDirty && !qcTableSaving && (
              <span style={{ fontSize: 11, color: '#16a34a' }}>Synced</span>
            )}
            <button
              onClick={() => handleAdvance(qcTableDirty ? handleSaveTable : null)}
              disabled={isAdvancing}
              style={{ ...S.btnP, fontSize: 12, padding: "6px 16px" }}
            >
              {isAdvancing ? 'Advancing...' : 'Lanjutkan →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // AI Form (has iframe for user input)
  if ((n.behavior === "ai_form" || n.behavior === "interactive") && (runConfig?.nodes?.[currentNodeIndex]?.n8n_form_urls?.length > 0 || runConfig?.nodes?.[currentNodeIndex]?.form_url)) {
    const blockReason = runBlockReason(n, nodePrompts);
    if (blockReason) return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", height: "100%", gap: 12, padding: 32, textAlign: "center",
      }}>
        <div style={{ fontSize: 32 }}>{blockReason.icon}</div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{blockReason.title}</div>
        <div style={{ color: C.muted, fontSize: 12, maxWidth: 260, lineHeight: 1.6 }}>{blockReason.body}</div>
        <button onClick={() => setMidTab("settings")} style={{ ...S.btnS, marginTop: 8 }}>
          {blockReason.cta}
        </button>
      </div>
    );

    const fileType = selNode?.settings?.file_type || 'pdf';
    const formUrls = runConfig.nodes[currentNodeIndex]?.n8n_form_urls || [];
    const formUrlEntry = formUrls.find(f => f.fileType === fileType);
    const src = formUrlEntry?.url;

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{
          ...S.flex(0), justifyContent: "space-between",
          padding: "6px 12px", borderBottom: `1px solid ${C.border}`,
          background: C.bg, flexShrink: 0,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: C.muted }}>
              {currentOrchestratorNode?.label || n.label}{tableNames[n.id] ? ` — ${tableNames[n.id]}` : ""}
            </span>
            {n.node_type === "ai_transformation" && nodePrompts[n.id]?.trim() && (
              <span style={{ fontSize: 10, color: "#f59e0b", fontWeight: 600, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ✨ {nodePrompts[n.id].trim()}
              </span>
            )}
          </div>
          <button onClick={reloadIframe} style={S.btnGhost} title="Reload form">↺ Reload</button>
        </div>
        {pollCount >= 30 && (
          <div style={{
            padding: "8px 12px", background: "#fef3c7", borderBottom: `1px solid #f59e0b`,
            fontSize: 11, color: "#92400e", lineHeight: 1.5,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Workflow seems stalled ({pollCount} polls)</div>
            <div>The node may have completed but failed to signal the orchestrator.</div>
            <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <button onClick={forceNodeComplete} style={{ ...S.btnS, fontSize: 10, padding: "3px 8px", background: "#f59e0b", color: "#fff", border: "none" }}>
                Force Mark Done
              </button>
              <button onClick={() => {
                console.log('%c[USER ACTION] Force Debug button clicked', 'background: #8b5cf6; color: white; font-weight: bold; padding: 4px 8px;');
                forceDebugDump();
              }} style={{ ...S.btnS, fontSize: 10, padding: "3px 8px", background: "#3b82f6", color: "#fff", border: "none" }}>
                🐛 Force Debug
              </button>
              <button onClick={resetRun} style={{ ...S.btnS, fontSize: 10, padding: "3px 8px" }}>↻ Reset</button>
            </div>
          </div>
        )}
        <iframe
          key={iframeKey}
          src={src}
          style={{ flex: 1, border: "none", width: "100%" }}
          allow="camera; microphone"
          title={currentOrchestratorNode?.label || n.label}
        />
      </div>
    );
  }

  // Export nodes (basic_export, ai_export)
  if (n.behavior === "basic_export" || n.behavior === "ai_export" || n.behavior === "export") {
    const downloadKey = runGuid && currentNodeIndex !== null ? `${runGuid}:${currentNodeIndex}` : null;
    const hasDownloaded = downloadKey && completedDownloads.has(downloadKey);

    if (hasDownloaded) {
      const fileName = runConfig?.nodes?.[currentNodeIndex]?.webhook_body?.fileName || exportFileName || 'export.xlsx';
      const isLastBeforeEnd = currentNodeIndex >= (runConfig?.nodes?.length ?? 0) - 1;
      const isConfirmed = showExportConfirmation || orchestratorStatus === 'export_downloaded';

      const handleRedownload = async () => {
        const currentNode = runConfig?.nodes?.[currentNodeIndex];
        if (!currentNode?.webhook_url) return;
        try {
          const response = await fetch(currentNode.webhook_url, {
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
        <div style={{ padding: 40, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
          <div style={{ fontSize: 48 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.black }}>File Downloaded Successfully</div>
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
                onClick={handleExportAdvance}
                disabled={isAdvancing}
                style={{ ...S.btnP, display: "flex", alignItems: "center", gap: 6 }}
              >
                {isAdvancing ? 'Processing...' : isLastBeforeEnd ? 'Done' : 'Next →'}
              </button>
            ) : (
              <span style={{ fontSize: 12, color: C.muted, alignSelf: "center" }}>Confirming…</span>
            )}
          </div>
          {isLastBeforeEnd && isConfirmed && (
            <div style={{ fontSize: 12, color: C.muted }}>Click Done to complete the workflow</div>
          )}
        </div>
      );
    }

    // Export is auto-triggered — fall through to the Processing spinner below
  }

  // Processing
  if (orchestratorStatus === 'running') {
    return (
      <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
        <Spinner label={`Processing${".".repeat(procDots)}`} />
        <div style={{ fontSize: 12, color: C.muted }}>
          Node {currentNodeIndex !== null ? currentNodeIndex + 1 : '...'} of {runConfig?.nodes?.length || '...'}
        </div>
      </div>
    );
  }

  // Default — ready to run
  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: C.muted }}>
      <div style={{ fontSize: 32 }}>▶</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.black }}>{n.label}</div>
      <div style={{ fontSize: 12 }}>Click ▶ on the left or "Run Workflow" to execute.</div>
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
