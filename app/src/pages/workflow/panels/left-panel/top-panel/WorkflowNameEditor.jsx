import { useState, useRef, useEffect } from "react";
import { C } from "../../../../../styles.jsx";
import { normalizeName } from "../../../utils/workflow-metadata.js";

const sharedFont = {
  fontWeight: 700,
  fontSize: 14,
  fontFamily: "inherit",
};

export default function WorkflowNameEditor({
  activeWorkflow,
  renameWorkflow,
  finalizeWorkflowName,
  isLoading,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef(null);

  const workflowName = normalizeName(activeWorkflow?.name, "Workflow");

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    setDraftName(workflowName);
    setIsEditing(true);
  };

  const handleBlur = () => {
    if (!isEditing) return;
    setIsEditing(false);
    if (activeWorkflow?.id) {
      finalizeWorkflowName(activeWorkflow.id);
    }
  };

  const handleInput = (e) => {
    const value = e.target.value;
    setDraftName(value);
    if (activeWorkflow?.id) {
      renameWorkflow(activeWorkflow.id, value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    } else if (e.key === "Escape") {
      e.target.value = workflowName;
      setDraftName(workflowName);
      setIsEditing(false);
    }
  };

  if (isLoading && !activeWorkflow) {
    return (
      <div style={{ position: "relative" }}>
        <div style={{
          width: 80,
          height: 22,
          borderRadius: 4,
          background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }} />
        <style>{`@keyframes shimmer{0%{background-position:200%0}100%{background-position:-200%0}}`}</style>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <span
        onClick={handleClick}
        style={{
          ...sharedFont,
          borderBottom: "2px solid transparent",
          padding: "4px 0",
          cursor: "pointer",
          transition: "border-color 0.15s",
          whiteSpace: "nowrap",
          color: C.black,
        }}
        onMouseEnter={(e) => (e.target.style.borderBottomColor = "#111")}
        onMouseLeave={(e) => (e.target.style.borderBottomColor = "transparent")}
      >
        {workflowName}
      </span>
    );
  }

  return (
    <div style={{ display: "inline-grid" }}>
      {/* Hidden sizer — sits in the same grid cell, drives the width */}
      <span
        style={{
          ...sharedFont,
          gridArea: "1 / 1",
          visibility: "hidden",
          whiteSpace: "pre",
          padding: "4px 2px",
          borderBottom: "2px solid transparent",
        }}
      >
        {draftName || " "}
      </span>
      {/* Actual input — stretches to match the sizer */}
      <input
        ref={inputRef}
        type="text"
        value={draftName}
        onChange={handleInput}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        maxLength={100}
        size={1}
        style={{
          ...sharedFont,
          gridArea: "1 / 1",
          outline: "none",
          border: "none",
          borderBottom: "2px solid #111",
          padding: "4px 2px",
          cursor: "text",
          background: "transparent",
          color: C.black,
          width: "100%",
          minWidth: 0,
        }}
      />
    </div>
  );
}
