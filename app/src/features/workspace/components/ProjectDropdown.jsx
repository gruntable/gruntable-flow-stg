import { C, S } from "../../../platform/styles.jsx";
import { normalizeName } from "../utils/workflow-metadata.js";

export default function ProjectDropdown({
  projects, activeProjectId, activeProject,
  showProjectMenu, setShowProjectMenu,
  projectEditMode, setProjectEditMode,
  projectMenuRef,
  selectProject, addProject, renameProject, finalizeProjectName,
  reorderProject, deleteProject, toggleProjectEditMode,
  normalizeProjectNames,
}) {
  return (
    <div ref={projectMenuRef} style={{ position: "relative" }}>
      <button
        onClick={() => {
          if (showProjectMenu && projectEditMode) normalizeProjectNames();
          setShowProjectMenu((prev) => !prev);
          if (showProjectMenu) setProjectEditMode(false);
        }}
        style={{
          border: `1px solid ${C.border}`,
          background: C.white,
          borderRadius: 8,
          padding: "6px 10px",
          minWidth: 210,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: 0.4 }}>Flow Project</div>
        <div style={{ ...S.flex(8), justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: C.black, marginTop: 1 }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
            {normalizeName(activeProject?.name, "Flow Project")}
          </span>
          <span style={{ fontSize: 10, color: C.muted }}>{showProjectMenu ? "▲" : "▼"}</span>
        </div>
      </button>

      {showProjectMenu && (
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
            <div style={{ fontSize: 12, fontWeight: 700 }}>Flow Project</div>
            <div style={S.flex(4)}>
              <button
                onClick={toggleProjectEditMode}
                style={{ ...S.btnGhost, color: C.black, fontSize: 12, padding: "2px 6px" }}
                title={projectEditMode ? "Done editing" : "Edit names and order"}
              >
                {projectEditMode ? "✓" : "✎"}
              </button>
              <button
                onClick={() => addProject()}
                style={{ ...S.btnGhost, color: C.black, fontSize: 14, padding: "2px 6px" }}
                title="Add project"
              >
                +
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 280, overflowY: "auto", padding: "6px 0" }}>
            {projects.map((project, index) => {
              const active = project.id === activeProjectId;
              if (!projectEditMode) {
                return (
                  <button
                    key={project.id}
                    onClick={() => selectProject(project.id)}
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
                      {normalizeName(project.name, `Flow Project ${index + 1}`)}
                    </span>
                  </button>
                );
              }

              return (
                <div key={project.id} style={{ ...S.flex(6), padding: "6px 12px" }}>
                  <span style={{ color: C.muted, fontSize: 11 }}>⋮⋮</span>
                  <input
                    style={{ ...S.input, fontSize: 12, padding: "6px 8px", flex: 1 }}
                    value={project.name}
                    onChange={(event) => renameProject(project.id, event.target.value)}
                    onBlur={() => finalizeProjectName(project.id)}
                  />
                  <button
                    onClick={() => reorderProject(project.id, -1)}
                    disabled={index === 0}
                    style={{ ...S.btnGhost, color: index === 0 ? C.border : C.black, padding: "2px 4px" }}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => reorderProject(project.id, 1)}
                    disabled={index === projects.length - 1}
                    style={{ ...S.btnGhost, color: index === projects.length - 1 ? C.border : C.black, padding: "2px 4px" }}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => deleteProject(project.id)}
                    disabled={projects.length === 1}
                    style={{ ...S.btnGhost, color: projects.length === 1 ? C.border : C.red, padding: "2px 4px" }}
                    title={projects.length === 1 ? "At least one project is required" : "Delete project"}
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
