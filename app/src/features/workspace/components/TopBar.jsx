import { C, S } from "../../../platform/styles.jsx";
import ProjectDropdown from "./ProjectDropdown.jsx";

export default function TopBar({
  projectProps,
  saveStatus, saveTime, retrySave,
  triggerFlowImport, handleFlowExport,
  flowNotice, flowNoticeTone,
  importInputRef, handleFlowImport,
}) {
  const renderSaveStatus = () => {
    if (saveStatus === "saving") return <span style={{ fontSize: 11, color: C.muted }}>Saving…</span>;
    if (saveStatus === "error") return <span style={{ fontSize: 11, color: C.red, cursor: "pointer" }} onClick={retrySave}>Save failed — click to retry</span>;
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
      <div style={{ ...S.flex(0), justifyContent: "space-between", padding: "8px 16px", borderBottom: `1px solid ${C.border}`, minHeight: 44 }}>
        <ProjectDropdown {...projectProps} />
        <div style={{ ...S.flex(12), alignItems: "center" }}>
          {renderSaveStatus()}
          <button onClick={triggerFlowImport} style={{ ...S.btnGhost, color: C.black, padding: "2px 4px" }}>Flow Import</button>
          <button onClick={handleFlowExport} style={{ ...S.btnGhost, color: C.black, padding: "2px 4px" }}>Flow Export</button>
          {flowNotice && (
            <span style={{ fontSize: 11, color: flowNoticeTone === "error" ? C.red : C.muted }}>
              {flowNotice}
            </span>
          )}
          <div style={{ fontSize: 11, color: C.muted }}>Gruntable Flow MVP-1</div>
        </div>
      </div>
    </>
  );
}
