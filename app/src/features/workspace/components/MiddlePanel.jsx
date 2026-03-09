import { C, S } from "../../../platform/styles.jsx";
import SettingsTab from "./SettingsTab.jsx";
import RunTab from "./RunTab.jsx";

export default function MiddlePanel({
  width,
  selNode, midTab, setMidTab,
  settingsProps, runProps,
  orchestratorStatus, isPolling, pollCount,
  qcTableName, qcTableLoading, qcTableError, qcTableData,
  showQC,
  editMode,
}) {
  const isViewOnly = editMode === false;

  if (!selNode) return <div style={{ ...S.panel, width, minWidth: width }} />;

  return (
    <div style={{ ...S.panel, width, minWidth: width }}>
      {!isViewOnly && (
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => setMidTab("settings")} style={S.tab(midTab === "settings")}>⚙ Settings</button>
          <button onClick={() => setMidTab("run")} style={{
            ...S.tab(midTab === "run"),
            background: showQC ? "#f0fdf4" : orchestratorStatus === 'running' ? "#eff6ff" : "transparent",
          }}>▶ Run</button>
        </div>
      )}
      {isViewOnly && (
        <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "8px 12px", background: "#f9fafb" }}>
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>▶ Run</span>
          <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 8 }}>(View only)</span>
        </div>
      )}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", position: "relative" }}>
        {isViewOnly ? (
          <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", background: C.white }}>
            <RunTab {...runProps} />
          </div>
        ) : (
          <>
            <div style={{
              position: "absolute",
              inset: 0,
              opacity: midTab === "settings" ? 1 : 0,
              pointerEvents: midTab === "settings" ? "auto" : "none",
              transition: "opacity 0.15s ease",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              zIndex: midTab === "settings" ? 2 : 1,
              background: C.white,
            }}>
              <SettingsTab {...settingsProps} />
            </div>
            <div style={{
              position: "absolute",
              inset: 0,
              opacity: midTab === "run" ? 1 : 0,
              pointerEvents: midTab === "run" ? "auto" : "none",
              transition: "opacity 0.15s ease",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
              zIndex: midTab === "run" ? 2 : 1,
              background: C.white,
            }}>
              <RunTab {...runProps} />
            </div>
          </>
        )}
      </div>
      {orchestratorStatus !== 'idle' && (
        <div style={{
          padding: "4px 12px", borderTop: `1px solid ${C.border}`,
          fontSize: 10, color: C.muted, fontFamily: "monospace",
          display: "flex", flexWrap: "wrap", gap: 8, background: "#fafafa",
        }}>
          <span>status: <b style={{ color: orchestratorStatus === 'node_done' ? '#16a34a' : orchestratorStatus === 'error' ? '#dc2626' : '#2563eb' }}>{orchestratorStatus}</b></span>
          <span>polling: <b>{isPolling ? `on (#${pollCount})` : 'off'}</b></span>
          {qcTableName && <span>table: <b>{qcTableLoading ? 'loading...' : qcTableError ? 'ERROR' : qcTableData ? 'loaded' : 'pending'}</b></span>}
          {qcTableName && <span title={qcTableName}>{qcTableName.length > 20 ? qcTableName.slice(0, 20) + '...' : qcTableName}</span>}
        </div>
      )}
    </div>
  );
}
