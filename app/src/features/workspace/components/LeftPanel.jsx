import { useState } from "react";
import { C, S, BICON } from "../../../platform/styles.jsx";

export default function LeftPanel({
  width,
  nodes, tableNames, sel, setSel,
  orchestratorStatus, isPolling, currentNodeIndex, runningNodeId, runConfig,
  nodeCanRun,
  getNodeValidationErrors,
  validateNode,
  selectNode, runSingle, deleteNode,
  startRunWorkflow, stopRun,
  onAddNodeClick,
  editMode, setEditMode,
  isStarting,
}) {
  const [hover, setHover] = useState(null);

  const workflowNodes = nodes;
  const isRunning = orchestratorStatus === 'running' || isPolling;
  const isViewOnly = editMode === false;

  const allNodesReady = workflowNodes.length > 0 && workflowNodes.every(n => nodeCanRun(n));
  const firstInvalidNode = workflowNodes.find(n => !nodeCanRun(n));
  const invalidErrors = firstInvalidNode ? getNodeValidationErrors(firstInvalidNode) : [];

  return (
    <div style={{ ...S.panel, width, minWidth: width }}>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflow: "auto", padding: 12, paddingBottom: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              {(orchestratorStatus === 'running' || orchestratorStatus === 'node_done') && (
                <button
                  onClick={stopRun}
                  style={{
                    ...S.btnGhost,
                    padding: "4px 8px",
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.mid,
                    fontSize: 11,
                  }}
                >
                  🛑 Stop
                </button>
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: C.muted }}>Edit Mode</span>
                <button
                  onClick={() => setEditMode(v => !v)}
                  style={{
                    width: 36, height: 20, borderRadius: 10, border: "none",
                    background: isViewOnly ? "#e5e7eb" : "#f59e0b",
                    cursor: "pointer", position: "relative", transition: "background 0.15s",
                  }}
                >
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%", background: C.white,
                    position: "absolute", top: 2,
                    left: isViewOnly ? 2 : 18,
                    transition: "left 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                  }} />
                </button>
              </div>
            </div>
            <button
              onClick={() => {
                if (!allNodesReady && firstInvalidNode) {
                  selectNode(firstInvalidNode.id);
                  return;
                }
                startRunWorkflow();
              }}
              disabled={isRunning || isStarting}
              style={{ ...S.btnP, width: "100%", opacity: isRunning || isStarting ? 0.5 : 1, fontSize: 12 }}
              title={!allNodesReady && firstInvalidNode ? invalidErrors.join(", ") : ""}
            >
              {!allNodesReady ? '⚠️ Check Required Fields' : isRunning ? '⏳ Running...' : isStarting ? '⏳ Starting...' : '▶ Run All Steps'}
            </button>
            {!allNodesReady && firstInvalidNode && (
              <div style={{ fontSize: 10, color: "#dc2626", marginTop: 4, padding: "4px 8px", background: "#fef2f2", borderRadius: 4 }}>
                <div style={{ fontWeight: 600 }}>{firstInvalidNode.title || firstInvalidNode.label}:</div>
                {invalidErrors.map((err, i) => (
                  <div key={i} style={{ marginLeft: 8 }}>• {err}</div>
                ))}
              </div>
            )}
          </div>

          {workflowNodes.map((node, i) => {
            const executing = orchestratorStatus === 'running' && node.id === runningNodeId;
            const completed = orchestratorStatus === 'node_done' && node.id === runningNodeId;
            const showConnector = i < workflowNodes.length - 1;
            const insertIdx = nodes.indexOf(node);
            const ready = nodeCanRun(node);
            const nodeErrors = getNodeValidationErrors(node);

            return (
              <div key={node.id}>
                <div
                  onMouseEnter={() => !isViewOnly && setHover(node.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => !isRunning && !isViewOnly && selectNode(node.id)}
                  style={{ ...S.nodeCard(sel === node.id, executing, completed, false), cursor: isRunning || isViewOnly ? 'not-allowed' : 'pointer', opacity: isViewOnly ? 0.7 : 1 }}
                >
                  <div style={{ ...S.flex(0), justifyContent: "space-between", alignItems: "center" }}>
                    <div style={S.flex(6)}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background:
                        executing ? "#3b82f6" :
                        completed ? "#22c55e" :
                        !ready ? "#f59e0b" : "#d1d5db"
                      }} />
                      <span style={{ fontWeight: sel === node.id ? 700 : 400, fontSize: 12 }}>
                        {node.title || node.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, minWidth: 44, display: 'inline-block', textAlign: 'center', whiteSpace: 'nowrap' }}>{BICON[node.behavior]}</span>
                  </div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 4, paddingLeft: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {node.label}
                  </div>
                  {!ready && !completed && (
                    <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2, paddingLeft: 14 }}>
                      {nodeErrors.length > 0 
                        ? `⚠ ${nodeErrors.length} field${nodeErrors.length > 1 ? 's' : ''} missing` 
                        : "⚠ Missing required fields"}
                    </div>
                  )}
                  {hover === node.id && !isRunning && !isViewOnly && (
                    <button
                      onClick={e => { 
                        e.stopPropagation(); 
                        if (!ready) {
                          selectNode(node.id);
                          return;
                        }
                        runSingle(node.id); 
                      }}
                      style={{ 
                        position: "absolute", top: -10, right: 36, width: 22, height: 22, borderRadius: "50%", 
                        border: `1px solid ${ready ? C.black : "#dc2626"}`, 
                        background: ready ? C.white : "#fef2f2", 
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10,
                        color: ready ? C.black : "#dc2626"
                      }}
                      title={!ready ? nodeErrors.join(", ") : "Run this node"}
                    >▶</button>
                  )}
                  {hover === node.id && !isRunning && !isViewOnly && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteNode(node.id); }}
                      style={{ position: "absolute", top: -10, right: 8, width: 22, height: 22, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: C.muted }}
                    >✕</button>
                  )}
                </div>

                {showConnector && (
                  <div
                    style={{ position: "relative", textAlign: "center", height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
                    onMouseEnter={() => !isViewOnly && setHover(`conn_${i}`)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <div style={{ width: 1, height: "100%", background: "#e0e0e0", position: "absolute" }} />
                    {hover === `conn_${i}` && !isRunning && !isViewOnly ? (
                      <button
                        onClick={e => { e.stopPropagation(); onAddNodeClick(insertIdx); }}
                        style={{ position: "relative", zIndex: 1, width: 20, height: 20, borderRadius: "50%", border: `1.5px solid ${C.black}`, background: C.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: C.black, lineHeight: 1 }}
                      >+</button>
                    ) : (
                      <div style={{ position: "relative", zIndex: 1, width: 6, height: 6, borderRadius: "50%", background: "#d1d5db" }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {!isRunning && !isViewOnly && (
            <div style={{ textAlign: "center", padding: "8px 0 12px" }}>
              {workflowNodes.length > 0 && (
                <div style={{ width: 1, height: 16, background: "#e0e0e0", margin: "0 auto 0" }} />
              )}
              <button
                onClick={() => onAddNodeClick(workflowNodes.length - 1)}
                style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: C.black, background: "transparent", border: `1.5px dashed ${C.black}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", width: "100%", letterSpacing: "0.3px" }}
              >+ Add Step</button>
            </div>
          )}
        </div>

        {orchestratorStatus === 'done' && (
          <div style={{ borderTop: `1px solid ${C.border}`, padding: "8px 12px", background: C.white }}>
            <div style={{ width: 1, height: 12, background: "#e0e0e0", margin: "0 auto 0 50%" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", background: "#f0fdf4", borderRadius: 6, border: "1px solid #bbf7d0" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 500 }}>Workflow complete</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
