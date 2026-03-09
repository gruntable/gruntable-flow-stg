import { useState, useEffect, useRef, useCallback } from "react";
import { readTable, editTable, rowOperation } from "../../../services/table.js";

export default function useQCTable({ orchestratorStatus, qcTableName }) {
  const [showQC, setShowQC] = useState(false);
  const [qcTableData, setQcTableData] = useState(null);
  const [qcTableDirty, setQcTableDirty] = useState(false);
  const [qcTableSaving, setQcTableSaving] = useState(false);
  const [qcTableLoading, setQcTableLoading] = useState(false);
  const [qcTableError, setQcTableError] = useState(null);
  const [qcRetryCount, setQcRetryCount] = useState(0);
  const savedQcTableRef = useRef(null);

  // Table fetch — triggered when node_done + qcTableName is set
  useEffect(() => {
    if (orchestratorStatus !== 'node_done' || !qcTableName) return;

    console.log(`[WF-DEBUG] table fetch effect → orchestratorStatus=${orchestratorStatus}, qcTableName=${qcTableName}, retryCount=${qcRetryCount}`);

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
        console.log(`[WF-DEBUG] readTable SUCCESS → rows=${data?.rows?.length}, headers=${data?.headers?.length}`);
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
  }, [orchestratorStatus, qcTableName, qcRetryCount]);

  const retryLoadQcTable = useCallback(() => {
    console.log('[WF-DEBUG] manual retry triggered');
    setQcTableError(null);
    setQcTableData(null);
    setQcRetryCount(c => c + 1);
  }, []);

  const handleQcTableChange = useCallback((name, newTableData) => {
    if (!qcTableData || !qcTableName) return;
    setQcTableData(newTableData);
    setQcTableDirty(true);
  }, [qcTableData, qcTableName]);

  const handleSaveTable = useCallback(async () => {
    if (!qcTableDirty || !qcTableName || qcTableSaving) return;
    const prev = savedQcTableRef.current;
    const next = qcTableData;
    if (!prev || !next) return;

    setQcTableSaving(true);
    try {
      const prevRows = prev.rows;
      const nextRows = next.rows;
      const headers = next.headers;

      if (nextRows.length === prevRows.length) {
        const edits = [];
        for (let ri = 0; ri < nextRows.length; ri++) {
          for (let ci = 0; ci < headers.length; ci++) {
            if ((nextRows[ri][ci] ?? '') !== (prevRows[ri]?.[ci] ?? '')) {
              edits.push({ row_index: ri, column: headers[ci], new_value: nextRows[ri][ci] ?? '' });
            }
          }
        }
        if (edits.length > 0) {
          await editTable(qcTableName, edits);
        }
      } else if (nextRows.length === prevRows.length + 1) {
        const newRow = nextRows[nextRows.length - 1];
        const values = {};
        headers.forEach((col, ci) => { values[col] = newRow[ci] ?? ''; });
        await rowOperation(qcTableName, 'add', null, values);
      } else if (nextRows.length === prevRows.length - 1) {
        let deletedIndex = prevRows.length - 1;
        for (let ri = 0; ri < nextRows.length; ri++) {
          if (nextRows[ri].join('\x00') !== prevRows[ri].join('\x00')) {
            deletedIndex = ri;
            break;
          }
        }
        await rowOperation(qcTableName, 'delete', deletedIndex);
      } else {
        console.error(`[QC save] Cannot save: row count changed by ${Math.abs(nextRows.length - prevRows.length)} rows at once (max 1)`);
        setQcTableSaving(false);
        return;
      }

      savedQcTableRef.current = next;
      setQcTableDirty(false);
    } catch (err) {
      console.error('[QC save] Failed to sync table:', err);
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
