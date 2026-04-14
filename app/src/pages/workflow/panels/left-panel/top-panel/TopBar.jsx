import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { C, S } from "../../../../../styles.jsx";
import WorkflowNameEditor from "./WorkflowNameEditor.jsx";
import { WORKFLOW_PLATFORMS, INPUT_METHODS } from "../../../utils/workflow-metadata.js";
import { getUserId } from "../../../services/user.js";
import { deleteWorkflow } from "../../../services/workflowApi.js";

export default function TopBar({
  workflowProps,
  saveStatus, saveTime, retrySave, isDirty,
  triggerFlowImport, handleFlowExport,
  flowNotice, flowNoticeTone,
  importInputRef, handleFlowImport,
  activeWorkflow, updateActiveWorkflow, triggerSave,
  onNavigate,
  isLoading,
}) {
  const [showModal, setShowModal] = useState(false);
  const [draftPlatform, setDraftPlatform] = useState(null);
  const [draftMethod, setDraftMethod] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showUserIdModal, setShowUserIdModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  const openModal = () => {
    setDraftPlatform(activeWorkflow?.platform ?? null);
    setDraftMethod(activeWorkflow?.platform_input_method ?? null);
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSave = () => {
    console.log("Save clicked");
    updateActiveWorkflow((w) => ({ ...w, platform: draftPlatform, platform_input_method: draftMethod }));
    triggerSave();
    closeModal();
  };

  const handleDeleteWorkflow = () => {
    setDeleteLoading(true);
    setDeleteError(null);
    deleteWorkflow(activeWorkflow.id)
      .then(() => {
        setDeleteLoading(false);
        setShowDeleteModal(false);
        setShowMenu(false);
        navigate("/home");
      })
      .catch(err => {
        console.error("Delete workflow error:", err);
        setDeleteError(err.message);
        setDeleteLoading(false);
      });
  };

  const renderSaveStatus = () => {
    if (saveStatus === "saving") return <span style={{ fontSize: 11, color: C.muted }}>Saving…</span>;
    if (saveStatus === "error") return <span style={{ fontSize: 11, color: C.red, cursor: "pointer" }} onClick={retrySave}>Save failed — click to retry</span>;
    if (isDirty) return <span style={{ fontSize: 11, color: C.red }}>You have unsaved changes</span>;
    return <span style={{ fontSize: 11, color: C.muted }}>Saved {saveTime ?? ""}</span>;
  };

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={handleFlowImport}
      />
      <div style={{ ...S.flex(12), justifyContent: "space-between", padding: "8px 16px", borderBottom: `1px solid ${C.border}`, minHeight: 44 }}>
        <div style={{ ...S.flex(12), alignItems: "center" }}>
          <button
            onClick={() => onNavigate?.(() => navigate("/home"))}
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: 14, padding: "4px 6px", borderRadius: 4 }}
            title="Home"
          >
            🏠
          </button>
          <WorkflowNameEditor
            activeWorkflow={activeWorkflow}
            renameWorkflow={workflowProps.renameWorkflow}
            finalizeWorkflowName={workflowProps.finalizeWorkflowName}
            isLoading={isLoading}
          />
        </div>
        <div style={{ ...S.flex(12), alignItems: "center" }}>
          {renderSaveStatus()}
          {flowNotice && (
            <span style={{ fontSize: 11, color: flowNoticeTone === "error" ? C.red : C.muted }}>
              {flowNotice}
            </span>
          )}
          <button
            onClick={() => { console.log("Save clicked"); retrySave(); }}
            disabled={saveStatus === "saving"}
            style={{
              ...S.btnGhost,
              padding: "4px 12px", fontSize: 12, borderRadius: 6,
              ...(isDirty
                ? { color: C.white, background: C.black, opacity: saveStatus === "saving" ? 0.6 : 1 }
                : { color: C.black, background: "transparent", border: `1px solid ${C.border}`, opacity: 0.6 }
              ),
            }}
          >
            {saveStatus === "saving" ? "Saving…" : "Save"}
          </button>
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowMenu(v => !v)}
              style={{ ...S.btnGhost, color: C.black, padding: "2px 8px", fontSize: 16, letterSpacing: 1 }}
            >⋯</button>
            {showMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 4px)", right: 0,
                background: C.white, border: `1px solid ${C.border}`,
                borderRadius: 6, boxShadow: "0 12px 30px rgba(0,0,0,0.12)",
                zIndex: 100, minWidth: 140, overflow: "hidden",
              }}>
                {[
                  { label: "Import", action: () => { triggerFlowImport(); setShowMenu(false); } },
                  { label: "Export", action: () => { handleFlowExport(); setShowMenu(false); } },
                  { label: "Properties", action: () => { openModal(); setShowMenu(false); } },
                  { label: "Show User ID", action: () => { setShowUserIdModal(true); setShowMenu(false); } },
                  { label: "Delete", action: () => { setShowDeleteModal(true); setShowMenu(false); }, color: C.red },
                ].map(({ label, action, color }) => (
                  <button
                    key={label}
                    onClick={action}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "8px 14px", fontSize: 13,
                      background: "none", border: "none", cursor: "pointer",
                      color: color || C.black,
                    }}
                  >{label}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 8, padding: 24,
              width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              display: "flex", flexDirection: "column", gap: 16,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>Workflow Properties</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Target Platform</label>
              <select
                value={draftPlatform ?? ""}
                onChange={(e) => setDraftPlatform(e.target.value || null)}
                style={{
                  fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`,
                  borderRadius: 6, background: C.white, color: C.black, width: "100%",
                }}
              >
                <option value="">-- Select platform --</option>
                {WORKFLOW_PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>Input Method</label>
              <select
                value={draftMethod ?? ""}
                onChange={(e) => setDraftMethod(e.target.value || null)}
                style={{
                  fontSize: 13, padding: "6px 8px", border: `1px solid ${C.border}`,
                  borderRadius: 6, background: C.white, color: C.black, width: "100%",
                }}
              >
                <option value="">-- Select method --</option>
                {INPUT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.icon} {m.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button onClick={closeModal} style={{ ...S.btnGhost, color: C.black, padding: "6px 14px" }}>Cancel</button>
              <button
                onClick={handleSave}
                style={{ ...S.btnGhost, color: C.white, background: C.black, padding: "6px 14px", borderRadius: 6 }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showUserIdModal && (
        <div
          onClick={() => setShowUserIdModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 8, padding: 24,
              width: 360, boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              display: "flex", flexDirection: "column", gap: 16,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 15 }}>User ID</div>
            <div style={{ fontSize: 13, color: C.muted, wordBreak: "break-all", fontFamily: "monospace" }}>
              {getUserId()}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button onClick={() => setShowUserIdModal(false)} style={{ ...S.btnGhost, color: C.white, background: C.black, padding: "6px 14px", borderRadius: 6 }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div
          onClick={() => !deleteLoading && setShowDeleteModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: C.white, borderRadius: 10,
              padding: "32px 36px", width: 380,
              display: "flex", flexDirection: "column", gap: 12,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700, color: C.black }}>Delete this workflow?</div>
            <div style={{ fontSize: 13, color: C.mid }}>"{activeWorkflow?.name}"</div>
            <div style={{ fontSize: 13, color: C.muted }}>This action cannot be undone.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
              <button
                style={{
                  ...S.btnS,
                  opacity: deleteLoading ? 0.6 : 1,
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                }}
                disabled={deleteLoading}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                style={{
                  ...S.btnP,
                  background: C.red,
                  border: `1px solid ${C.red}`,
                  opacity: deleteLoading ? 0.7 : 1,
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                }}
                disabled={deleteLoading}
                onClick={handleDeleteWorkflow}
              >
                {deleteLoading ? "Deleting..." : "Delete"}
              </button>
            </div>
            {deleteError && (
              <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>{deleteError}</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
