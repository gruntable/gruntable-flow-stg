import { C, S } from "../../../platform/styles.jsx";
import { normalizeName } from "../utils/workflow-metadata.js";

export default function WorkflowDropdown({
  workflows, activeWorkflowId, activeWorkflow,
  showWorkflowMenu, setShowWorkflowMenu,
  workflowEditMode, setWorkflowEditMode,
  workflowMenuRef,
  selectWorkflow, addWorkflow, renameWorkflow, finalizeWorkflowName,
  reorderWorkflow, deleteWorkflow, toggleWorkflowEditMode,
  normalizeWorkflowNames,
}) {
  return (
    <div ref={workflowMenuRef} style={{ position: "relative" }}>
      <button
        onClick={() => {
          if (showWorkflowMenu && workflowEditMode) normalizeWorkflowNames();
          setShowWorkflowMenu((prev) => !prev);
          if (showWorkflowMenu) setWorkflowEditMode(false);
        }}
        style={{
          border: `1px solid ${C.border}`,
          background: C.white,
          borderRadius: 8,
          padding: "6px 10px",
          minWidth: 300,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>Workflow</div>
        <div style={{ ...S.flex(8), justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.black, marginTop: 1 }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 260 }}>
            {normalizeName(activeWorkflow?.name, "Workflow")}
          </span>
          <span style={{ fontSize: 10, color: C.muted }}>{showWorkflowMenu ? "▲" : "▼"}</span>
        </div>
      </button>

      {showWorkflowMenu && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 8px)",
          left: 0,
          width: 320,
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
          zIndex: 50,
          overflow: "hidden",
        }}>
          <div style={{ ...S.flex(8), justifyContent: "space-between", padding: "10px 12px", borderBottom: `1px solid ${C.border}`, background: C.bg }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Workflow</div>
            <div style={S.flex(4)}>
              <button
                onClick={toggleWorkflowEditMode}
                style={{ ...S.btnGhost, color: C.black, fontSize: 12, padding: "2px 6px" }}
                title={workflowEditMode ? "Done editing" : "Edit names and order"}
              >
                {workflowEditMode ? "✓" : "✎"}
              </button>
              <button
                onClick={() => addWorkflow()}
                style={{ ...S.btnGhost, color: C.black, fontSize: 14, padding: "2px 6px" }}
                title="Add workflow"
              >
                +
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto", padding: "6px 0" }}>
            {workflows.map((workflow, index) => {
              const active = workflow.id === activeWorkflowId;
              if (!workflowEditMode) {
                return (
                  <button
                    key={workflow.id}
                    onClick={() => selectWorkflow(workflow.id)}
                    style={{
                      width: "100%",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      color: C.black,
                    }}
                  >
                    <span style={{ width: 14, color: active ? C.black : "transparent", fontWeight: 700 }}>✓</span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {normalizeName(workflow.name, `Workflow ${index + 1}`)}
                    </span>
                  </button>
                );
              }

              return (
                <div key={workflow.id} style={{ ...S.flex(6), padding: "6px 12px" }}>
                  <span style={{ color: C.muted, fontSize: 11 }}>⋮⋮</span>
                  <input
                    style={{ ...S.input, fontSize: 12, padding: "6px 8px", flex: 1 }}
                    value={workflow.name}
                    onChange={(event) => renameWorkflow(workflow.id, event.target.value)}
                    onBlur={() => finalizeWorkflowName(workflow.id)}
                  />
                  <button
                    onClick={() => reorderWorkflow(workflow.id, -1)}
                    disabled={index === 0}
                    style={{ ...S.btnGhost, color: index === 0 ? C.border : C.black, padding: "2px 4px" }}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => reorderWorkflow(workflow.id, 1)}
                    disabled={index === workflows.length - 1}
                    style={{ ...S.btnGhost, color: index === workflows.length - 1 ? C.border : C.black, padding: "2px 4px" }}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => deleteWorkflow(workflow.id)}
                    disabled={workflows.length === 1}
                    style={{ ...S.btnGhost, color: workflows.length === 1 ? C.border : C.red, padding: "2px 4px" }}
                    title={workflows.length === 1 ? "At least one workflow is required" : "Delete workflow"}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
