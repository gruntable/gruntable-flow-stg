import { useState, useEffect, useRef, useCallback } from "react";
import { startRun, pollStatus, advanceRun, cancelRun } from "../../../services/orchestrator.js";
import { convertNodesToOrchestratorFormat } from "../utils/workflow-metadata.js";

const sanitizeTableName = (name) => name?.trim() || "";

const validateNodeFields = (node, tableNames, nodePrompts, nodeSourceTables, allTables = []) => {
  const errors = [];
  
  if (node.node_type === "ai_extraction") {
    const tableName = sanitizeTableName(tableNames[node.id]);
    if (!tableName) errors.push("Output table name required");
    
    // Check if table exists (case-insensitive)
    const tableExists = allTables.some(t => t.toLowerCase() === tableName.toLowerCase());
    
    // Conflict mode is required if table name is entered
    if (tableName && !node.tableOutput?.conflictMode) {
      errors.push("Select 'Overwrite' or 'Append' for this table");
    }
    
    const fileType = node.settings?.file_type || node.file_type;
    if (fileType === "spreadsheet") {
      const sheetName = node.settings?.sheet_name?.trim();
      if (!sheetName) errors.push("Sheet name required for spreadsheet");
    }
  }
  
  if (node.node_type === "ai_transformation") {
    const prompt = nodePrompts[node.id]?.trim();
    if (!prompt) errors.push("Transformation prompt required");
    
    const sourceTable = nodeSourceTables[node.id];
    const sourceTables = Array.isArray(sourceTable) ? sourceTable : [sourceTable];
    const hasValidSource = sourceTables.some(t => t?.trim());
    if (!hasValidSource) errors.push("Input table required");
    
    const tableName = sanitizeTableName(tableNames[node.id]);
    if (!tableName) errors.push("Output table name required");
    
    // Check if table exists (case-insensitive)
    const tableExists = allTables.some(t => t.toLowerCase() === tableName.toLowerCase());
    
    // Conflict mode is required if table name is entered
    if (tableName && !node.tableOutput?.conflictMode) {
      errors.push("Select 'Overwrite' or 'Append' for this table");
    }
  }
  
  if (node.node_type === "export_excel") {
    const sourceTable = nodeSourceTables[node.id];
    if (!sourceTable?.trim()) errors.push("Input table required");
    
    const fileName = nodePrompts[node.id]?.trim();
    if (!fileName) errors.push("Export file name required");
  }
  
  if (node.node_type === "ai_export") {
    const prompt = nodePrompts[node.id]?.trim();
    if (!prompt) errors.push("Export prompt required");
    
    const sourceTable = nodeSourceTables[node.id];
    if (!sourceTable?.trim()) errors.push("Input table required");
  }
  
  return errors;
};

export default function useOrchestrator({
  nodes,
  tableNames,
  nodePrompts,
  nodeSourceTables,
  workflowId,
  setFlowNotice,
  setFlowNoticeTone,
  setSel,
  setMidTab,
  resetQCState,
  accumulatedTables,
  setAccumulatedTables,
  accumulatedActiveTable,
  setAccumulatedActiveTable,
}) {
  const [runConfig, setRunConfig] = useState(null);
  const [runGuid, setRunGuid] = useState(null);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(null);
  const [orchestratorStatus, setOrchestratorStatus] = useState('idle');
  const [isPolling, setIsPolling] = useState(false);
  const [orchestratorError, setOrchestratorError] = useState(null);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [completedDownloads, setCompletedDownloads] = useState(new Set());
  const [showExportConfirmation, setShowExportConfirmation] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [exportFileName, setExportFileName] = useState('');

  // Polling refs (stale-closure-safe)
  const isPollingRef = useRef(false);
  const pollingTimeoutRef = useRef(null);
  const runGuidRef = useRef(null);
  const runConfigRef = useRef(null);
  const pollCountRef = useRef(0);
  const pollingStartTimeRef = useRef(null);
  const lastPollTimeRef = useRef(null);
  const autoTriggeredRef = useRef(new Set());
  const qcTableDataRef = useRef(null);
  const prevNodeIndexRef = useRef(null);
  const prevStatusRef = useRef(null);
  const runStartTimeRef = useRef(null);
  const activeRunGuidRef = useRef(null); // Track current run to filter stale responses

  // Keep refs in sync
  runGuidRef.current = runGuid;
  runConfigRef.current = runConfig;

  // QC table name — set when node_done arrives, consumed by useQCTable
  const [qcTableName, setQcTableName] = useState(null);
  // Incremented each time a table result arrives, even if the name is unchanged
  const [tableRefreshKey, setTableRefreshKey] = useState(0);

  // Sync qcTableData ref when it changes
  const updateQcTableDataRef = useCallback((data) => {
    qcTableDataRef.current = data;
  }, []);

  const startPolling = useCallback(() => {
    console.log('[WF-DEBUG] polling STARTED', {
      runGuidRefCurrent: runGuidRef.current,
      runGuidState: runGuid,
      activeRunGuidRef: activeRunGuidRef.current
    });
    isPollingRef.current = true;
    pollCountRef.current = 0;
    pollingStartTimeRef.current = Date.now();
    prevNodeIndexRef.current = null;
    prevStatusRef.current = null;
    setPollCount(0);
    setIsPolling(true);
  }, []);

  const stopPolling = useCallback((reason = 'unknown') => {
    console.log(`[WF-DEBUG] polling STOPPED reason=${reason}, after ${pollCountRef.current} polls`);
    isPollingRef.current = false;
    setIsPolling(false);
  }, []);

  // Stable poll callback - VERBOSE LOGGING
  const pollRunStatus = useCallback(async (signal) => {
    console.log('[WF-POLL-DEBUG] pollRunStatus called:', {
      runGuidRefCurrent: runGuidRef.current,
      runGuidState: runGuid,
      isPollingRef: isPollingRef.current,
      timestamp: new Date().toISOString()
    });
    if (!runGuidRef.current) {
      console.log('[WF-POLL] Skipping - no runGuid', {
        runGuidRefCurrent: runGuidRef.current,
        runGuidState: runGuid
      });
      return;
    }

    console.log('[WF-POLL] ========== POLL START ==========', new Date().toISOString());
    console.log('[WF-POLL] run_guid:', runGuidRef.current);
    
    const status = await pollStatus(runGuidRef.current, signal);
    pollCountRef.current += 1;
    const elapsed = pollingStartTimeRef.current ? Date.now() - pollingStartTimeRef.current : 0;
    
    console.log('[WF-POLL] Response received:');
    console.log('  Poll #:', pollCountRef.current);
    console.log('  Status:', status.status);
    console.log('  current_node_index:', status.current_node_index);
    console.log('  output_table:', status.output_table);
    console.log('  error_message:', status.error_message);
    console.log('  Elapsed time:', elapsed, 'ms');
    
    const prevNodeIndex = prevNodeIndexRef.current;
    const prevStatus = prevStatusRef.current;
    
    console.log('[WF-POLL] State change check:');
    console.log('  Previous status:', prevStatus, '→ New status:', status.status);
    console.log('  Previous node_index:', prevNodeIndex, '→ New node_index:', status.current_node_index);

    setOrchestratorStatus(status.status);
    setCurrentNodeIndex(status.current_node_index);
    
    prevNodeIndexRef.current = status.current_node_index;
    prevStatusRef.current = status.status;

    if (status.status === 'node_done') {
      console.log('[WF-POLL] ========== NODE DONE ==========');
      stopPolling('node_done');
      const currentNode = runConfigRef.current?.nodes?.[status.current_node_index];
      console.log('[WF-POLL] Current node from runConfig:');
      console.log('  node_id:', currentNode?.node_id);
      console.log('  node_type:', currentNode?.node_type);
      console.log('  table_name:', currentNode?.table_name);
      console.log('  output_table from status:', status.output_table);

      if (currentNode?.node_type === 'export_excel' || currentNode?.node_type === 'ai_export') {
        console.log('[WF-POLL] Export node - skipping QC, will wait for export_downloaded');
        setQcTableName(null);
      } else if (currentNode?.table_name) {
        console.log('[WF-POLL] Setting qcTableName:', currentNode.table_name);
        setQcTableName(currentNode.table_name);
        setTableRefreshKey(k => k + 1);

        const totalNodes = runConfigRef.current?.nodes?.length ?? 0;
        const isSingleNodeRun = totalNodes === 1;

        if (isSingleNodeRun) {
          console.log('[WF-POLL] Single node run - auto-advancing...');
          advanceRun(runGuidRef.current).then(response => {
            console.log('[WF-POLL] Auto-advance response:', response);
            setOrchestratorStatus(response.status);
            setCurrentNodeIndex(response.current_node_index);
          }).catch(err => {
            console.error('[WF-POLL] Auto-advance failed:', err);
          });
        }
        // Last node of multi-node run: QC review will show, user must click to advance
      } else {
        console.warn('[WF-POLL] WARNING: node_done but no table_name!');
        console.warn('  runConfig:', JSON.stringify(runConfigRef.current?.nodes?.[status.current_node_index], null, 2));
      }
    } else if (status.status === 'export_downloaded') {
      console.log('[WF-POLL] ========== EXPORT DOWNLOADED ==========');
      stopPolling('export_downloaded');
      setShowExportConfirmation(true);
    } else if (status.status === 'done') {
      console.log('[WF-POLL] ========== WORKFLOW DONE ==========');
      stopPolling('done');
    } else if (status.status === 'error') {
      console.log('[WF-POLL] ========== ERROR ==========');
      console.log('  Error message:', status.error_message);
      stopPolling('error');
      setOrchestratorError(status.error_message || 'An error occurred');
    } else {
      setPollCount(pollCountRef.current);
      if (pollCountRef.current >= 30) {
        console.warn(`[WF-POLL] STALE WARNING: ${pollCountRef.current} consecutive 'running' polls (${elapsed}ms)`);
        console.warn('[WF-POLL] Current runConfig node:', JSON.stringify(runConfigRef.current?.nodes?.[status.current_node_index], null, 2));
      }
    }
    
    console.log('[WF-POLL] ========== POLL END ==========');
  }, [stopPolling, runGuid]);

  // Polling loop
  useEffect(() => {
    if (!isPolling) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
      return;
    }

    const controller = new AbortController();

    const runPoll = async () => {
      if (!isPollingRef.current || controller.signal.aborted) return;
      
      const now = Date.now();
      const interval = lastPollTimeRef.current ? now - lastPollTimeRef.current : null;
      console.log(`[WF-POLL-TIMER] Interval since last poll: ${interval ? interval + 'ms' : 'first poll'}`);
      lastPollTimeRef.current = now;
      try {
        await pollRunStatus(controller.signal);
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error(`[WF-DEBUG] poll ERROR → ${err.message}`);
        stopPolling('poll_error');
        setOrchestratorError(err.message);
        return;
      }
      if (isPollingRef.current && !controller.signal.aborted) {
        pollingTimeoutRef.current = setTimeout(runPoll, 2000);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      } else if (isPollingRef.current) {
        pollingTimeoutRef.current = setTimeout(runPoll, 0);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    pollingTimeoutRef.current = setTimeout(runPoll, 2000);

    return () => {
      controller.abort();
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isPolling, pollRunStatus, stopPolling]);

  // Auto-trigger webhook-based nodes
  useEffect(() => {
    if (orchestratorStatus !== 'running') {
      return;
    }
    if (currentNodeIndex === null || !runGuid) {
      return;
    }
    
    const currentNode = runConfig?.nodes?.[currentNodeIndex];
    
    if (!currentNode) {
      return;
    }
    if (currentNode.trigger_type !== 'auto') {
      return;
    }

    const key = `${runGuid}:${currentNodeIndex}`;
    
    if (autoTriggeredRef.current.has(key)) {
      return;
    }
    
    autoTriggeredRef.current.add(key);

    const triggerAutoNode = async () => {
      try {
        const response = await fetch(currentNode.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentNode.webhook_body),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Webhook returned ${response.status}: ${errorText}`);
        }

        if (currentNode.node_type === 'export_excel' || currentNode.node_type === 'ai_export') {
          const blob = await response.blob();
          const fileName = currentNode.webhook_body?.fileName || 'export.xlsx';
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);

          setCompletedDownloads(prev => {
            const newSet = new Set(prev);
            newSet.add(key);
            return newSet;
          });
          setExportFileName(fileName);
          setShowExportConfirmation(true);
        } else {
          const responseData = await response.json();
        }
      } catch (err) {
        setOrchestratorError('Auto-trigger failed: ' + err.message);
      }
    };

    triggerAutoNode();
  }, [orchestratorStatus, currentNodeIndex, runGuid, runConfig]);

  const startRunWorkflow = async () => {
    // Guard against rapid double-clicks
    if (isStarting) return;
    
    if (nodes.length === 0) {
      setFlowNoticeTone('error');
      setFlowNotice('No nodes to run. Add nodes first.');
      return;
    }

    for (const node of nodes) {
      const errors = validateNodeFields(node, tableNames, nodePrompts, nodeSourceTables);
      if (errors.length > 0) {
        setFlowNoticeTone('error');
        setFlowNotice(`${node.title || node.label}: ${errors.join(', ')}`);
        return;
      }
    }

    // Clear accumulated tables on new workflow run
    if (setAccumulatedTables) setAccumulatedTables({});
    if (setAccumulatedActiveTable) setAccumulatedActiveTable(null);
    if (resetQCState) resetQCState();
    setQcTableName(null);

    // Optimistic UI: switch to Run tab immediately, show loading
    setMidTab('run');
    setIsStarting(true);
    runStartTimeRef.current = performance.now();
    console.log('[TIMING] Run Workflow clicked at', runStartTimeRef.current.toFixed(1), 'ms');

    try {
      const orchestratorNodes = convertNodesToOrchestratorFormat(nodes, tableNames, nodePrompts, nodeSourceTables);
      console.log('[WF-DEBUG] Sending to orchestrator /start:', JSON.stringify({ trigger_mode: 'run_workflow', nodes: orchestratorNodes, workflow_id: workflowId }, null, 2));
      const response = await startRun('run_workflow', orchestratorNodes, workflowId);
      
      const orchDone = performance.now();
      console.log('[TIMING] Orch /start response received at', orchDone.toFixed(1), 'ms | orch latency:', (orchDone - runStartTimeRef.current).toFixed(0), 'ms');

      console.log('[WF-DEBUG] Orchestrator response nodes:', JSON.stringify(response.nodes?.map(n => ({
        node_id: n.node_id,
        node_type: n.node_type,
        trigger_type: n.trigger_type,
        webhook_url: n.webhook_url,
        webhook_body: n.webhook_body,
      })), null, 2));

      if (!response.run_guid) {
        console.error('[WF-START] Orchestrator response missing run_guid!', response);
        setOrchestratorError('Orchestrator did not return a run_guid');
        setFlowNoticeTone('error');
        setFlowNotice('Failed to start run: orchestrator did not return run_guid');
        return;
      }

      setRunConfig(response);
      setRunGuid(response.run_guid);
      setCurrentNodeIndex(response.current_node_index);
      setOrchestratorStatus(response.status);
      setOrchestratorError(null);
      setCompletedDownloads(new Set());
      autoTriggeredRef.current.clear();

      if (response.status === 'running') {
        console.log('[WF-START] About to start polling', {
          responseRunGuid: response.run_guid,
          runGuidRefCurrent: runGuidRef.current
        });
        startPolling();
        const firstWorkflowNode = nodes[response.current_node_index];
        if (firstWorkflowNode) setSel(firstWorkflowNode.id);
        setFlowNoticeTone('neutral');
        setFlowNotice('Workflow started');
      }
    } catch (err) {
      setOrchestratorError(err.message);
      setFlowNoticeTone('error');
      setFlowNotice('Failed to start run: ' + err.message);
    } finally {
      setIsStarting(false);
    }
  };

  const startSingleNode = async (nodeId) => {
    // Guard against rapid double-clicks
    if (isStarting) return;
    
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    const errors = validateNodeFields(node, tableNames, nodePrompts, nodeSourceTables);
    if (errors.length > 0) {
      setFlowNoticeTone('error');
      setFlowNotice(`${node.title || node.label}: ${errors.join(', ')}`);
      return;
    }



    // Optimistic UI: switch to Run tab immediately, show loading
    setMidTab('run');
    setIsStarting(true);

    try {
      const orchestratorNodes = convertNodesToOrchestratorFormat([node], tableNames, nodePrompts, nodeSourceTables);
      console.log('[WF-DEBUG] Sending to orchestrator /start (single_node):', JSON.stringify({ trigger_mode: 'single_node', nodes: orchestratorNodes, workflow_id: workflowId }, null, 2));
      const response = await startRun('single_node', orchestratorNodes, workflowId);

      console.log('[WF-DEBUG] Orchestrator response (single_node):', JSON.stringify(response.nodes?.map(n => ({
        node_id: n.node_id,
        node_type: n.node_type,
        trigger_type: n.trigger_type,
        webhook_url: n.webhook_url,
        webhook_body: n.webhook_body,
      })), null, 2));

      if (!response.run_guid) {
        console.error('[WF-START] Orchestrator response missing run_guid!', response);
        setOrchestratorError('Orchestrator did not return a run_guid');
        setFlowNoticeTone('error');
        setFlowNotice('Failed to start node: orchestrator did not return run_guid');
        return;
      }

      setRunConfig(response);
      setRunGuid(response.run_guid);
      setCurrentNodeIndex(response.current_node_index);
      setOrchestratorStatus(response.status);
      setOrchestratorError(null);
      setCompletedDownloads(new Set());
      autoTriggeredRef.current.clear();

      if (response.status === 'running') {
        startPolling();
        setSel(nodeId);
      }
    } catch (err) {
      setOrchestratorError(err.message);
      setFlowNoticeTone('error');
      setFlowNotice('Failed to start node: ' + err.message);
    } finally {
      setIsStarting(false);
    }
  };

  const resetRun = async () => {
    console.log('[WF-DEBUG] resetRun called');
    
    const currentRunGuid = runGuid;
    const totalNodes = runConfig?.nodes?.length ?? 0;
    const isMultiNode = totalNodes > 1;

    setRunConfig(null);
    setRunGuid(null);
    setCurrentNodeIndex(null);
    setOrchestratorStatus('idle');
    stopPolling('reset');
    activeRunGuidRef.current = null;
    setOrchestratorError(null);
    setPollCount(0);
    pollCountRef.current = 0;
    autoTriggeredRef.current.clear();
    setCompletedDownloads(new Set());
    setShowExportConfirmation(false);
    setExportFileName('');
    setMidTab('settings');

    if (currentRunGuid && isMultiNode) {
      cancelRun(currentRunGuid).catch(err => {
        console.warn('[WF-DEBUG] Cancel API failed:', err.message);
      });
    }
  };

  const stopRun = () => {
    console.log('[WF-DEBUG] stopRun called');
    const currentRunGuid = runGuid;
    stopPolling('stop');
    setOrchestratorStatus('cancelled');
    activeRunGuidRef.current = null;
    setOrchestratorError(null);
    setPollCount(0);
    pollCountRef.current = 0;
    if (currentRunGuid) {
      cancelRun(currentRunGuid).catch(err => {
        console.warn('[WF-DEBUG] Cancel API failed:', err.message);
      });
    }
  };

  const handleAdvance = async (saveTableFn, currentTableData) => {
    if (!runGuid || isAdvancing) return;

    const totalNodes = runConfig?.nodes?.length ?? 0;
    const isLastNode = totalNodes === 1 || currentNodeIndex === totalNodes - 1;

    if (isLastNode) {
      console.log('[WF-ADVANCE] Last/single node - UI clear only, status already done');
      if (saveTableFn) await saveTableFn();
      if (resetQCState) resetQCState();
      if (nodes[0]) setSel(nodes[0].id);
      return;
    }

    if (saveTableFn) await saveTableFn();

    // ACCUMULATE: Add current table to persisted collection before advancing
    if (currentTableData && qcTableName && setAccumulatedTables) {
      setAccumulatedTables(prev => ({
        ...prev,
        [qcTableName]: currentTableData
      }));
    }

    setIsAdvancing(true);
    try {
      const response = await advanceRun(runGuid);
      
      // Update selected node BEFORE updating orchestrator state to prevent UI flash
      if (response.status === 'running') {
        const nextNode = nodes[response.current_node_index];
        if (nextNode) setSel(nextNode.id);
      }

      setOrchestratorStatus(response.status);
      setCurrentNodeIndex(response.current_node_index);
      setQcTableName(null);
      if (resetQCState) resetQCState();
      setOrchestratorError(null);

      if (response.status === 'running') {
        startPolling();
        setMidTab('run');
      } else if (response.status === 'done') {
        setFlowNoticeTone('neutral');
        setFlowNotice('Workflow complete!');
      }
    } catch (err) {
      setOrchestratorError(err.message);
      setFlowNoticeTone('error');
      setFlowNotice('Failed to advance: ' + err.message);
    } finally {
      setIsAdvancing(false);
    }
  };

  const handleExportAdvance = async () => {
    if (!runGuid || isAdvancing) return;
    setIsAdvancing(true);
    try {
      const response = await advanceRun(runGuid);
      
      // Update selected node BEFORE updating orchestrator state to prevent UI flash
      if (response.status === 'running') {
        const nextNode = nodes[response.current_node_index];
        if (nextNode) setSel(nextNode.id);
      }

      setOrchestratorStatus(response.status);
      setCurrentNodeIndex(response.current_node_index);
      setShowExportConfirmation(false);
      setQcTableName(null);
      if (resetQCState) resetQCState();
      setOrchestratorError(null);
      if (response.status === 'running') {
        startPolling();
        setMidTab('run');
      } else if (response.status === 'done') {
        setFlowNoticeTone('neutral');
        setFlowNotice('Workflow complete!');
      }
    } catch (err) {
      setOrchestratorError(err.message);
      setFlowNoticeTone('error');
      setFlowNotice('Failed to advance: ' + err.message);
    } finally {
      setIsAdvancing(false);
    }
  };

  const forceNodeComplete = useCallback(async () => {
    if (!runGuid || currentNodeIndex === null) return;
    const currentNode = runConfig?.nodes?.[currentNodeIndex];
    console.log(`[WF-DEBUG] forceNodeComplete → run_guid=${runGuid}, node_index=${currentNodeIndex}, table=${currentNode?.table_name}`);
    try {
      const { nodeComplete } = await import('../../../services/orchestrator.js');
      await nodeComplete(runGuid, currentNodeIndex, currentNode?.table_name || '', 0, null);
      setPollCount(0);
      pollCountRef.current = 0;
      startPolling();
    } catch (err) {
      console.error('[WF-DEBUG] forceNodeComplete FAILED:', err);
      setOrchestratorError('Force node complete failed: ' + err.message);
    }
  }, [runGuid, currentNodeIndex, runConfig, startPolling]);

  const forceDebugDump = useCallback(() => {
    console.log('%c[WF-DEBUG-DUMP] ========== FULL STATE DUMP ==========', 'background: #f59e0b; color: white; font-size: 14px; padding: 4px 8px;');
    
    console.log('%c[WF-DEBUG-DUMP] RUN STATE', 'background: #3b82f6; color: white; font-weight: bold; padding: 2px 6px;');
    console.log('  runGuid:', runGuid);
    console.log('  currentNodeIndex:', currentNodeIndex);
    console.log('  orchestratorStatus:', orchestratorStatus);
    console.log('  isPolling:', isPolling);
    console.log('  pollCount:', pollCount);
    console.log('  isAdvancing:', isAdvancing);
    console.log('  orchestratorError:', orchestratorError);
    
    console.log('%c[WF-DEBUG-DUMP] RUN CONFIG', 'background: #3b82f6; color: white; font-weight: bold; padding: 2px 6px;');
    console.log('  runConfig exists:', !!runConfig);
    if (runConfig) {
      console.log('  run_guid:', runConfig.run_guid);
      console.log('  status:', runConfig.status);
      console.log('  current_node_index:', runConfig.current_node_index);
      console.log('  total_nodes:', runConfig.total_nodes);
      console.log('  Nodes array:');
      runConfig.nodes?.forEach((node, idx) => {
        const isCurrent = idx === currentNodeIndex;
        console.log(`    [${isCurrent ? 'CURRENT' : '     '}] Index ${idx}:`);
        console.log('      node_id:', node.node_id);
        console.log('      node_type:', node.node_type);
        console.log('      label:', node.label);
        console.log('      trigger_type:', node.trigger_type);
        console.log('      form_url:', node.form_url);
        console.log('      webhook_url:', node.webhook_url);
        console.log('      webhook_body:', JSON.stringify(node.webhook_body, null, 4));
        console.log('      table_name:', node.table_name);
      });
    }
    
    console.log('%c[WF-DEBUG-DUMP] CURRENT ORCHESTRATOR NODE', 'background: #3b82f6; color: white; font-weight: bold; padding: 2px 6px;');
    const currentOrchestratorNode = runConfig?.nodes?.[currentNodeIndex];
    console.log('  Node found:', !!currentOrchestratorNode);
    if (currentOrchestratorNode) {
      console.log('  Full node object:', JSON.stringify(currentOrchestratorNode, null, 2));
    }
    
    console.log('%c[WF-DEBUG-DUMP] AUTO-TRIGGER STATE', 'background: #3b82f6; color: white; font-weight: bold; padding: 2px 6px;');
    console.log('  autoTriggeredRef keys:', [...autoTriggeredRef.current]);
    const key = runGuid && currentNodeIndex !== null ? `${runGuid}:${currentNodeIndex}` : null;
    console.log('  Current key would be:', key);
    console.log('  Already triggered:', key ? autoTriggeredRef.current.has(key) : 'N/A');
    
    console.log('%c[WF-DEBUG-DUMP] NODES (Frontend)', 'background: #3b82f6; color: white; font-weight: bold; padding: 2px 6px;');
    console.log('  Total nodes:', nodes.length);
    nodes.forEach((node, idx) => {
      console.log(`    [${idx}] ${node.id}: ${node.label} (type: ${node.node_type}, behavior: ${node.behavior})`);
    });
    
    console.log('%c[WF-DEBUG-DUMP] QC STATE', 'background: #3b82f6; color: white; font-weight: bold; padding: 2px 6px;');
    console.log('  qcTableName:', qcTableName);
    console.log('  qcTableDataRef exists:', !!qcTableDataRef.current);
    
    console.log('%c[WF-DEBUG-DUMP] EXPORT STATE', 'background: #3b82f6; color: white; font-weight: bold; padding: 2px 6px;');
    console.log('  completedDownloads:', [...completedDownloads]);
    console.log('  showExportConfirmation:', showExportConfirmation);
    console.log('  exportFileName:', exportFileName);
    
    console.log('%c[WF-DEBUG-DUMP] ========== END DUMP ==========', 'background: #f59e0b; color: white; font-size: 14px; padding: 4px 8px;');
    
    // Also dump to a string that can be copied
    const dumpObj = {
      timestamp: new Date().toISOString(),
      runState: {
        runGuid,
        currentNodeIndex,
        orchestratorStatus,
        isPolling,
        pollCount,
        isAdvancing,
        orchestratorError
      },
      runConfig: runConfig || null,
      currentOrchestratorNode: currentOrchestratorNode || null,
      autoTriggerState: {
        triggeredKeys: [...autoTriggeredRef.current],
        currentKey: key,
        alreadyTriggered: key ? autoTriggeredRef.current.has(key) : null
      },
      frontendNodes: nodes.map(n => ({
        id: n.id,
        label: n.label,
        node_type: n.node_type,
        behavior: n.behavior
      })),
      qcState: {
        qcTableName,
        hasTableData: !!qcTableDataRef.current
      },
      exportState: {
        completedDownloads: [...completedDownloads],
        showExportConfirmation,
        exportFileName
      }
    };
    
    console.log('%c[WF-DEBUG-DUMP] Copyable JSON:', 'background: #10b981; color: white; font-weight: bold; padding: 2px 6px;');
    console.log(JSON.stringify(dumpObj, null, 2));
    
    return dumpObj;
  }, [runGuid, currentNodeIndex, orchestratorStatus, isPolling, pollCount, isAdvancing, orchestratorError, runConfig, nodes, qcTableName, completedDownloads, showExportConfirmation, exportFileName]);

  const runSingle = (id) => {
    if (orchestratorStatus === 'running') return;
    startSingleNode(id);
  };

  return {
    runConfig, runGuid, currentNodeIndex,
    orchestratorStatus, setOrchestratorStatus,
    isPolling, pollCount,
    orchestratorError, setOrchestratorError,
    isAdvancing,
    isStarting,
    completedDownloads, showExportConfirmation,
    exportFileName,
    qcTableName, setQcTableName, tableRefreshKey,
    pollingStartTimeRef,
    runStartTimeRef,
    updateQcTableDataRef,

    startRunWorkflow, startSingleNode, runSingle,
    resetRun, stopRun, handleAdvance, handleExportAdvance,
    forceNodeComplete, forceDebugDump, startPolling, stopPolling,
  };
}
