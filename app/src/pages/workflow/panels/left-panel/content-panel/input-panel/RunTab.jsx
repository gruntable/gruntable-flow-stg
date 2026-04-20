import React, { useRef, useEffect } from "react";
import { C, S } from "../../../../../../styles.jsx";
import { NODE_REGISTRY } from "../../../../utils/node-loader.js";
import { N8N_BASE } from "../../../../../../config.js";

function mdToHtml(md) {
  if (!md || !md.trim()) return '<p style="color:#888;font-style:italic;">No content set for this step.</p>';
  
  const lines = md.split('\n');
  const out = [];
  let inList = false;

  for (let line of lines) {
    if (line.startsWith('### ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${processInline(line.slice(2))}</li>`);
    } else if (line.trim() === '') {
      if (inList) { out.push('</ul>'); inList = false; }
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(`<p>${processInline(line)}</p>`);
    }
  }
  if (inList) out.push('</ul>');
  return out.join('\n');
}

function processInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:#f3f4f6;padding:1px 4px;border-radius:3px;">$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#3b82f6;">$1</a>');
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getCleanTableName(technicalName) {
  const match = technicalName?.match(/^[\w-]+_[a-z0-9]+_(.+)$/);
  return match ? match[1].replace(/_/g, ' ') : technicalName;
}

const MessageCard = React.memo(function MessageCard({ message }) {
  const entries = Object.entries(message || {});

  if (entries.length === 0) {
    return (
      <div style={{ fontSize: 13, color: C.muted, textAlign: "center" }}>
        Review the output on the right before continuing.
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 400, border: "1px solid #e5e7eb", borderRadius: 8, background: "#f9fafb", padding: 16 }}>
      {entries.map(([key, value]) => (
        <div key={key}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.black, marginBottom: 2 }}>{key}</div>
          <div style={{ fontSize: 14, color: C.black }}>{value}</div>
        </div>
      ))}
    </div>
  );
});

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
  showPauseReview, pauseReviewTableData, pauseReviewTableName,
  pauseReviewTableDirty, pauseReviewTableSaving,
  pauseReviewTableLoading, pauseReviewTableError,
  completedDownloads, showExportConfirmation, exportFileName,
  procDots, iframeKey, reloadIframe,
  setMidTab,
  resetRun, handleAdvance, handleExportAdvance,
  handleSaveTable, retryLoadPauseReviewTable,
  forceNodeComplete,
  forceDebugDump,
  setOrchestratorError,
  pauseReviewMessage,
}) {
  const iframeLoggedRef = useRef(false);
  const totalNodes = runConfig?.nodes?.length ?? 0;
  const isMultiNode = totalNodes > 1;
  const isLastBeforeEnd = currentNodeIndex >= totalNodes - 1;

  useEffect(() => {
    if (isStarting) iframeLoggedRef.current = false;
  }, [isStarting]);

  const currentOrchestratorNode = runConfig?.nodes?.[currentNodeIndex];
  const isRunning = orchestratorStatus === 'running' || orchestratorStatus === 'node_done' || orchestratorStatus === 'export_downloaded';
  const workflowNode = currentOrchestratorNode
    ? nodes.find(node => node.id === currentOrchestratorNode.node_id)
    : null;
  const n = isRunning && workflowNode ? workflowNode : selNode;

  const manifest = NODE_REGISTRY[n?.node_type];

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
          <div style={{ fontSize: 12 }}>Click ▶ on the left or "Run All Steps" to execute.</div>
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
  if (orchestratorStatus === 'node_done' && pauseReviewTableLoading && !pauseReviewTableData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center" }}>
          <Spinner label="Loading Pause Review table..." />
          <div style={{ fontSize: 11, color: C.muted }}>{getCleanTableName(pauseReviewTableName)}</div>
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
  if (orchestratorStatus === 'node_done' && pauseReviewTableError && !pauseReviewTableData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 32 }}>⚠️</div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Failed to load Pause Review table</div>
          <div style={{ color: C.muted, fontSize: 12, maxWidth: 280, lineHeight: 1.6 }}>{pauseReviewTableError}</div>
          <div style={{ fontSize: 11, color: C.muted }}>{getCleanTableName(pauseReviewTableName)}</div>
          <button onClick={retryLoadPauseReviewTable} style={{ ...S.btnP, marginTop: 8 }}>Retry</button>
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

  // TEXT_DISPLAY State — Text node: show markdown rendered content + Continue button
  if ((orchestratorStatus === 'running' || orchestratorStatus === 'node_done') && manifest?.behavior === 'text_display') {
    const markdown = selNode?.settings?.text?.content || '';
    const htmlContent = mdToHtml(markdown);

    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
          <div
            style={{ maxWidth: 680, margin: '0 auto', lineHeight: 1.6 }}
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button
              onClick={() => handleAdvance()}
              disabled={isAdvancing}
              style={{ ...S.btnP, fontSize: 14, padding: '10px 28px' }}
            >
              {isAdvancing ? 'Processing...' : 'Next'}
            </button>
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

  // PAUSE_REVIEW State - Full page with message card (table is in TablePanel)
  // Skip for single node runs - auto-advances
  if (orchestratorStatus === 'node_done' && showPauseReview && pauseReviewTableData && isMultiNode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 40 }}>
          <div style={{ fontSize: 48 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.black }}>Run Step Completed</div>
          <MessageCard message={pauseReviewMessage} />
          <button
            onClick={() => handleAdvance(pauseReviewTableDirty ? handleSaveTable : null)}
            disabled={isAdvancing}
            style={{ ...S.btnP, fontSize: 13, padding: "8px 20px" }}
          >
            {isAdvancing ? 'Processing...' : isLastBeforeEnd ? 'Finish' : 'Next Step'}
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

  // EXPORT_DOWNLOADED State - Full page with message card
  const downloadKey = runGuid && currentNodeIndex !== null ? `${runGuid}:${currentNodeIndex}` : null;
  const hasDownloaded = downloadKey && completedDownloads.has(downloadKey);
  
  if (hasDownloaded) {
    const fileName = runConfig?.nodes?.[currentNodeIndex]?.webhook_body?.fileName || exportFileName || 'export.xlsx';
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
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 40 }}>
          <div style={{ fontSize: 48 }}>✓</div>
          <MessageCard message={pauseReviewMessage || { "File": `${fileName} has been downloaded. Check your downloads folder.` }} />
          <div style={{ display: "flex", gap: 12 }}>
            <button
              onClick={handleRedownload}
              disabled={isAdvancing}
              style={{ ...S.btnS, fontSize: 13, padding: "8px 16px" }}
            >
              ↻ Download Again
            </button>
            {isConfirmed ? (
              <button
                onClick={!isMultiNode ? resetRun : handleExportAdvance}
                disabled={isAdvancing}
                style={{ ...S.btnP, fontSize: 13, padding: "8px 20px" }}
              >
                {isAdvancing ? 'Processing...' : !isMultiNode ? 'Close' : isLastBeforeEnd ? 'Finish' : 'Next Step'}
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
    const rawUrls = runConfig.nodes[currentNodeIndex]?.n8n_form_urls;
    const formUrls = Array.isArray(rawUrls) ? rawUrls : (typeof rawUrls === 'string' ? JSON.parse(rawUrls) : []);
    const formUrlEntry = formUrls.find(f => f.fileType === fileType);
    const src = formUrlEntry?.url ? (formUrlEntry.url.startsWith('http') ? formUrlEntry.url : N8N_BASE + formUrlEntry.url) : null;

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
            {manifest?.requires_prompt && nodePrompts[n.id]?.trim() && (
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
          {totalNodes > 1 && (
            <div style={{ fontSize: 12, color: C.muted }}>
              Node {currentNodeIndex !== null ? currentNodeIndex + 1 : '...'} of {totalNodes || '...'}
            </div>
          )}
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
            {totalNodes > 1
              ? `Stopped at node ${currentNodeIndex !== null ? currentNodeIndex + 1 : '—'} of ${totalNodes}.`
              : 'Run stopped.'}
          </div>
          <button onClick={resetRun} style={{ ...S.btnP, marginTop: 8 }}>I Understand</button>
        </div>
      </div>
    );
  }

  // COMPLETE State
  if (orchestratorStatus === 'done') {
    // For single node runs with node_response, show the message even in done state
    if (pauseReviewMessage && !isMultiNode) {
      return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 40 }}>
            <div style={{ fontSize: 48 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.black }}>Run Step Completed</div>
            <MessageCard message={pauseReviewMessage} />
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

  // PAUSE_REVIEW (no table) - node returned a message but no table output
  if (orchestratorStatus === 'node_done' && !pauseReviewTableName && pauseReviewMessage && currentOrchestratorNode?.pauseForReview !== false && isMultiNode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 40 }}>
          <div style={{ fontSize: 48 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.black }}>Run Step Completed</div>
          <MessageCard message={pauseReviewMessage} />
          <button
            onClick={() => handleAdvance(null)}
            disabled={isAdvancing}
            style={{ ...S.btnP, fontSize: 13, padding: "8px 20px" }}
          >
            {isAdvancing ? 'Processing...' : isLastBeforeEnd ? 'Finish' : 'Next Step'}
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
  const manifest = NODE_REGISTRY[node.node_type];
  if (!manifest) return null;
  if (manifest.requires_prompt && !nodePrompts[node.id]?.trim()) {
    if (manifest.is_export)
      return { icon: "📤✨", title: "Export prompt required", body: "Enter an export prompt in the Settings tab before running.", cta: "← Go to Settings" };
    return { icon: "✨", title: "Prompt required", body: "Enter a transformation prompt in the Settings tab before running.", cta: "← Go to Settings" };
  }
  return null;
}
