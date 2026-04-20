import { useState, useEffect, useRef, useCallback } from "react";
import { readTable, replaceTable } from "../services/table.js";

const DEBUG = import.meta.env.VITE_DEBUG;

export default function usePauseReviewTable({ pauseReviewTableName, tableRefreshKey }) {
  const [showPauseReview, setShowPauseReview] = useState(false);
  const [pauseReviewTableData, setPauseReviewTableData] = useState(null);
  const [pauseReviewTableDirty, setPauseReviewTableDirty] = useState(false);
  const [pauseReviewTableSaving, setPauseReviewTableSaving] = useState(false);
  const [pauseReviewTableLoading, setPauseReviewTableLoading] = useState(false);
  const [pauseReviewTableError, setPauseReviewTableError] = useState(null);
  const [pauseReviewRetryCount, setPauseReviewRetryCount] = useState(0);
  const savedPauseReviewTableRef = useRef(null);

  // Table fetch — triggered when tableRefreshKey increments (set by orchestrator on node_done)
  // tableRefreshKey only increments when a real node result arrives, so no status check needed.
  // This avoids the race where status transitions node_done → done cancel the in-flight fetch.
  useEffect(() => {
    if (!pauseReviewTableName || tableRefreshKey === 0) return;

    DEBUG && console.log(`[WF-DEBUG] table fetch effect FIRED → pauseReviewTableName=${pauseReviewTableName}`);

    let cancelled = false;
    let retryAttempt = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    setPauseReviewTableLoading(true);
    setPauseReviewTableError(null);

    const attemptFetch = async () => {
      try {
        const data = await readTable(pauseReviewTableName);
        if (cancelled) return;
        DEBUG && console.log(`[WF-DEBUG] readTable SUCCESS → rows=${data?.rows?.length}`);
        setPauseReviewTableData(data);
        savedPauseReviewTableRef.current = data;
        setPauseReviewTableDirty(false);
        setShowPauseReview(true);
        setPauseReviewTableLoading(false);
      } catch (err) {
        if (cancelled) return;
        retryAttempt++;
        if (retryAttempt < MAX_RETRIES) {
          DEBUG && console.warn(`[WF-DEBUG] readTable FAILED (attempt ${retryAttempt}/${MAX_RETRIES})`);
          setTimeout(() => { if (!cancelled) attemptFetch(); }, RETRY_DELAY);
        } else {
          console.error(`[WF-DEBUG] readTable GAVE UP after ${MAX_RETRIES} attempts → ${err.message}`);
          setPauseReviewTableError(err.message);
          setShowPauseReview(true);
          setPauseReviewTableLoading(false);
        }
      }
    };

    attemptFetch();
    return () => { cancelled = true; };
  }, [pauseReviewTableName, pauseReviewRetryCount, tableRefreshKey]);

  const retryLoadPauseReviewTable = useCallback(() => {
    DEBUG && console.log('[WF-DEBUG] manual retry triggered');
    setPauseReviewTableError(null);
    setPauseReviewTableData(null);
    setPauseReviewRetryCount(c => c + 1);
  }, []);

  const handlePauseReviewTableChange = useCallback((name, newTableData) => {
    if (!pauseReviewTableData || !pauseReviewTableName) return;
    if (name !== pauseReviewTableName) return;
    setPauseReviewTableData(newTableData);
    setPauseReviewTableDirty(true);
  }, [pauseReviewTableData, pauseReviewTableName]);

  const handleSaveTable = useCallback(async () => {
    if (!pauseReviewTableDirty || !pauseReviewTableName || pauseReviewTableSaving) return;
    if (!pauseReviewTableData) return;

    setPauseReviewTableSaving(true);
    try {
      await replaceTable(pauseReviewTableName, pauseReviewTableData.headers, pauseReviewTableData.rows);
      savedPauseReviewTableRef.current = pauseReviewTableData;
      setPauseReviewTableDirty(false);
    } catch (err) {
      console.error('[Pause Review save] Failed to save table:', err);
    } finally {
      setPauseReviewTableSaving(false);
    }
  }, [pauseReviewTableDirty, pauseReviewTableName, pauseReviewTableSaving, pauseReviewTableData]);

  const resetPauseReviewState = useCallback(() => {
    setShowPauseReview(false);
    setPauseReviewTableData(null);
    setPauseReviewTableDirty(false);
    setPauseReviewTableError(null);
    setPauseReviewTableLoading(false);
    setPauseReviewRetryCount(0);
    savedPauseReviewTableRef.current = null;
  }, []);

  return {
    showPauseReview, setShowPauseReview,
    pauseReviewTableData, setPauseReviewTableData,
    pauseReviewTableDirty, pauseReviewTableSaving,
    pauseReviewTableLoading, pauseReviewTableError,
    retryLoadPauseReviewTable,
    handlePauseReviewTableChange,
    handleSaveTable,
    resetPauseReviewState,
  };
}
