import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "gruntable_panel_widths";
const DEFAULT_WIDTHS = { left: 228, middle: 360, right: 500 };
const MIN_WIDTHS = { left: 180, middle: 280, right: 500 };

function loadWidths() {
  if (typeof window === "undefined") return { ...DEFAULT_WIDTHS };
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        left: Math.max(MIN_WIDTHS.left, parsed.left ?? DEFAULT_WIDTHS.left),
        middle: Math.max(MIN_WIDTHS.middle, parsed.middle ?? DEFAULT_WIDTHS.middle),
        right: Math.max(MIN_WIDTHS.right, parsed.right ?? DEFAULT_WIDTHS.right),
      };
    }
  } catch {}
  return { ...DEFAULT_WIDTHS };
}

function saveWidths(widths) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  } catch {}
}

export default function usePanelWidths() {
  const [widths, setWidths] = useState(() => loadWidths());
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const draggingRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const setLeftWidth = useCallback((newLeft) => {
    setWidths((prev) => {
      const left = Math.max(MIN_WIDTHS.left, Math.min(newLeft, windowWidth - MIN_WIDTHS.middle - MIN_WIDTHS.right));
      const widths = { ...prev, left };
      saveWidths(widths);
      return widths;
    });
  }, [windowWidth]);

  const setMiddleWidth = useCallback((newMiddle) => {
    setWidths((prev) => {
      const middle = Math.max(MIN_WIDTHS.middle, Math.min(newMiddle, windowWidth - MIN_WIDTHS.left - MIN_WIDTHS.right));
      const widths = { ...prev, middle };
      saveWidths(widths);
      return widths;
    });
  }, [windowWidth]);

  const startDrag = useCallback((handle) => {
    draggingRef.current = handle;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const endDrag = useCallback(() => {
    draggingRef.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const handleDrag = useCallback((deltaX) => {
    if (!draggingRef.current) return;
    setWidths((prev) => {
      let newWidths = { ...prev };
      if (draggingRef.current === "left-middle") {
        newWidths.left = Math.max(MIN_WIDTHS.left, Math.min(prev.left + deltaX, windowWidth - prev.middle - MIN_WIDTHS.right));
      } else if (draggingRef.current === "middle-right") {
        newWidths.middle = Math.max(MIN_WIDTHS.middle, Math.min(prev.middle - deltaX, windowWidth - prev.left - MIN_WIDTHS.right));
      }
      saveWidths(newWidths);
      return newWidths;
    });
  }, [windowWidth]);

  return {
    widths,
    windowWidth,
    setLeftWidth,
    setMiddleWidth,
    startDrag,
    endDrag,
    handleDrag,
    draggingRef,
  };
}
