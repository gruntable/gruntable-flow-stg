import { useState, useRef, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
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
  onReorderNodes,
  editMode, setEditMode,
  isStarting,
  undo, redo, canUndo, canRedo,
}) {
  const [hover, setHover] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);
  const [dragPos, setDragPos] = useState(null);
  const [dropIndicator, setDropIndicator] = useState(null);
  const nodeDragRef = useRef(null);

  const workflowNodes = nodes;
  const isRunning = orchestratorStatus === 'running' || isPolling;
  const isViewOnly = editMode === false;
  const canDrag = !isViewOnly && !isRunning && onReorderNodes && workflowNodes.length > 1;

  const startNodeDrag = useCallback((e, nodeId) => {
    if (e.button !== 0) return;
    if (e.target.closest('[data-node-action]')) return;
    e.preventDefault();
    nodeDragRef.current = { id: nodeId, startX: e.clientX, startY: e.clientY, hasDragged: false };

    const onMove = (ev) => {
      if (!nodeDragRef.current) return;
      if (!nodeDragRef.current.hasDragged) {
        if (Math.abs(ev.clientY - nodeDragRef.current.startY) < 5) return;
        nodeDragRef.current.hasDragged = true;
        setDraggedNode(nodeDragRef.current.id);
      }
      setDragPos({ x: ev.clientX, y: ev.clientY });
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const cardEl = el?.closest('[data-node-id]');
      if (cardEl && cardEl.dataset.nodeId !== nodeDragRef.current.id) {
        const rect = cardEl.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const onTop = ev.clientY < midY;
        nodeDragRef.current.dropTarget = cardEl.dataset.nodeId;
        nodeDragRef.current.dropSide = onTop ? 'before' : 'after';
        setDropIndicator({
          left: rect.left,
          top: onTop ? rect.top : rect.bottom,
          width: rect.width,
        });
      } else {
        nodeDragRef.current.dropTarget = null;
        nodeDragRef.current.dropSide = null;
        setDropIndicator(null);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (nodeDragRef.current?.hasDragged) {
        const { dropTarget, dropSide, id: dragged } = nodeDragRef.current;
        if (dropTarget && dropTarget !== dragged) {
          onReorderNodes(dragged, dropTarget, dropSide);
        }
      } else {
        selectNode(nodeId);
      }
      nodeDragRef.current = null;
      setDraggedNode(null);
      setDragPos(null);
      setDropIndicator(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [onReorderNodes, selectNode]);

  const allNodesReady = workflowNodes.length > 0 && workflowNodes.every(n => nodeCanRun(n));
  const firstInvalidNode = workflowNodes.find(n => !nodeCanRun(n));
  const invalidErrors = firstInvalidNode ? getNodeValidationErrors(firstInvalidNode) : [];

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isRunning) return; // Disable when running
      if (!editMode) return; // Disable in view mode
      
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      if (!isCtrlOrCmd) return;
      
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        if (canRedo) redo();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo, isRunning, editMode]);

  return (
    <div style={{ ...S.panel, width, minWidth: width }}>
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflow: "auto", padding: 12, paddingBottom: 0 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              {(orchestratorStatus === 'running' || orchestratorStatus === 'node_done') ? (
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
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={undo}
                    disabled={!canUndo || !editMode}
                    title="Undo (Ctrl+Z)"
                    style={{
                      ...S.btnGhost,
                      padding: "4px 8px",
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: canUndo && editMode ? C.black : C.muted,
                      fontSize: 11,
                      opacity: canUndo && editMode ? 1 : 0.5,
                      cursor: canUndo && editMode ? 'pointer' : 'not-allowed',
                    }}
                  >
                    ↩
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo || !editMode}
                    title="Redo (Ctrl+Y)"
                    style={{
                      ...S.btnGhost,
                      padding: "4px 8px",
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: canRedo && editMode ? C.black : C.muted,
                      fontSize: 11,
                      opacity: canRedo && editMode ? 1 : 0.5,
                      cursor: canRedo && editMode ? 'pointer' : 'not-allowed',
                    }}
                  >
                    ↪
                  </button>
                </div>
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
            const isDragged = draggedNode === node.id;

            return (
              <div key={node.id} data-node-id={node.id}>
                <div
                  onMouseEnter={() => !isViewOnly && setHover(node.id)}
                  onMouseLeave={() => setHover(null)}
                  onMouseDown={(e) => canDrag && startNodeDrag(e, node.id)}
                  style={{ ...S.nodeCard(sel === node.id, executing, completed, false), cursor: isRunning || isViewOnly ? 'not-allowed' : canDrag ? 'grab' : 'pointer', opacity: isViewOnly ? 0.7 : isDragged ? 0.3 : 1 }}
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

      {/* Ghost card and drop indicator during drag */}
      {draggedNode && dragPos && createPortal(
        <>
          {/* Ghost card following cursor */}
          <div style={{
            position: "fixed",
            left: dragPos.x + 8,
            top: dragPos.y - 10,
            padding: "8px 12px",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            fontSize: 12,
            fontWeight: 500,
            color: C.black,
            background: C.white,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            opacity: 0.9,
            pointerEvents: "none",
            zIndex: 99999,
            whiteSpace: "nowrap",
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {workflowNodes.find(n => n.id === draggedNode)?.title || workflowNodes.find(n => n.id === draggedNode)?.label || 'Node'}
          </div>
          {/* Horizontal line drop indicator */}
          {dropIndicator && (
            <div style={{
              position: "fixed",
              left: dropIndicator.left,
              top: dropIndicator.top - 1,
              width: dropIndicator.width,
              height: 2,
              background: C.black,
              borderRadius: 1,
              pointerEvents: "none",
              zIndex: 99999,
            }} />
          )}
        </>,
        document.body
      )}
    </div>
  );
}
