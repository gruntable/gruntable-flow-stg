import { useState, useEffect, useRef, useCallback } from "react";
import { readTable, replaceTable } from "../../../services/table.js";

export default function useQCTable({ qcTableName, tableRefreshKey }) {
  const [showQC, setShowQC] = useState(false);
  const [qcTableData, setQcTableData] = useState(null);
  const [qcTableDirty, setQcTableDirty] = useState(false);
  const [qcTableSaving, setQcTableSaving] = useState(false);
  const [qcTableLoading, setQcTableLoading] = useState(false);
  const [qcTableError, setQcTableError] = useState(null);
  const [qcRetryCount, setQcRetryCount] = useState(0);
  const savedQcTableRef = useRef(null);

  // Table fetch — triggered when tableRefreshKey increments (set by orchestrator on node_done)
  // tableRefreshKey only increments when a real node result arrives, so no status check needed.
  // This avoids the race where status transitions node_done → done cancel the in-flight fetch.
  useEffect(() => {
    if (!qcTableName || tableRefreshKey === 0) return;

    console.log(`[WF-DEBUG] table fetch effect FIRED → qcTableName=${qcTableName}, tableRefreshKey=${tableRefreshKey}, retryCount=${qcRetryCount}`);

    let cancelled = false;
    let retryAttempt = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000;

    setQcTableLoading(true);
    setQcTableError(null);

    const attemptFetch = async () => {
      try {
        const data = await readTable(qcTableName);
        if (cancelled) return;
        console.log(`[WF-DEBUG] readTable SUCCESS → rows=${data?.rows?.length}, headers=${data?.headers?.length}, firstRow=${JSON.stringify(data?.rows?.[0])}`);
        setQcTableData(data);
        savedQcTableRef.current = data;
        setQcTableDirty(false);
        setShowQC(true);
        setQcTableLoading(false);
      } catch (err) {
        if (cancelled) return;
        retryAttempt++;
        console.warn(`[WF-DEBUG] readTable FAILED (attempt ${retryAttempt}/${MAX_RETRIES}) → ${err.message}`);
        if (retryAttempt < MAX_RETRIES) {
          setTimeout(() => { if (!cancelled) attemptFetch(); }, RETRY_DELAY);
        } else {
          console.error(`[WF-DEBUG] readTable GAVE UP after ${MAX_RETRIES} attempts → ${err.message}`);
          setQcTableError(err.message);
          setShowQC(true);
          setQcTableLoading(false);
        }
      }
    };

    attemptFetch();
    return () => { cancelled = true; };
  }, [qcTableName, qcRetryCount, tableRefreshKey]);

  const retryLoadQcTable = useCallback(() => {
    console.log('[WF-DEBUG] manual retry triggered');
    setQcTableError(null);
    setQcTableData(null);
    setQcRetryCount(c => c + 1);
  }, []);

  const handleQcTableChange = useCallback((name, newTableData) => {
    if (!qcTableData || !qcTableName) return;
    if (name !== qcTableName) return;
    setQcTableData(newTableData);
    setQcTableDirty(true);
  }, [qcTableData, qcTableName]);

  const handleSaveTable = useCallback(async () => {
    if (!qcTableDirty || !qcTableName || qcTableSaving) return;
    if (!qcTableData) return;

    setQcTableSaving(true);
    try {
      await replaceTable(qcTableName, qcTableData.headers, qcTableData.rows);
      savedQcTableRef.current = qcTableData;
      setQcTableDirty(false);
    } catch (err) {
      console.error('[QC save] Failed to save table:', err);
    } finally {
      setQcTableSaving(false);
    }
  }, [qcTableDirty, qcTableName, qcTableSaving, qcTableData]);

  const resetQCState = useCallback(() => {
    setShowQC(false);
    setQcTableData(null);
    setQcTableDirty(false);
    setQcTableError(null);
    setQcTableLoading(false);
    setQcRetryCount(0);
    savedQcTableRef.current = null;
  }, []);

  return {
    showQC, setShowQC,
    qcTableData, setQcTableData,
    qcTableDirty, qcTableSaving,
    qcTableLoading, qcTableError,
    retryLoadQcTable,
    handleQcTableChange,
    handleSaveTable,
    resetQCState,
  };
}
