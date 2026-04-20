import { useState, useEffect, useRef, useCallback } from "react";
import { startRun, pollStatus, advanceRun, cancelRun } from "../services/orchestrator.js";
import { convertNodesToOrchestratorFormat } from "../utils/workflow-metadata.js";
import { NODE_REGISTRY } from "../utils/node-loader.js";

const DEBUG = import.meta.env.VITE_DEBUG;

/** Minimal Markdown → HTML for display-text nodes (no external lib needed). */
function markdownToHtml(md) {
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

  // Convert list items
  html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // Wrap remaining bare lines in <p>
  html = html.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed || /^<(h[1-6]|ul|li|\/ul)/.test(trimmed)) return line;
    return `<p>${trimmed}</p>`;
  }).join('\n');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{margin:0;padding:20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#374151;line-height:1.6}
    h1{font-size:24px;margin:16px 0 8px}h2{font-size:20px;margin:14px 0 6px}h3{font-size:16px;margin:12px 0 4px}
    ul{padding-left:24px}a{color:#2563eb}
  </style></head><body>${html}</body></html>`;
}

const sanitizeTableName = (name) => name?.trim() || "";

const validateNodeFields = (node, tableNames, nodePrompts, nodeSourceTables, allTables = []) => {
  const manifest = NODE_REGISTRY[node.node_type];
  if (!manifest) return [`Unknown node type: ${node.node_type}`];
  const errors = [];

  // Output table name + conflict mode (all nodes that produce a table)
  // table_output_mode: "required" = always need table name
  // table_output_mode: "optional" = only need if $table is actually used (Code node)
  // table_output_mode: "none" = no table output
  if (manifest.table_output_mode === "required") {
    const tableName = sanitizeTableName(tableNames[node.id]);
    if (!tableName) errors.push("Output table name required");
  } else if (manifest.table_output_mode === "optional") {
    const jsCode = node.settings?.processing?.jsCode || "";
    const usesTableOutput = /\$table\s*[,}]/m.test(jsCode);
    if (usesTableOutput) {
      const tableName = sanitizeTableName(tableNames[node.id]);
      if (!tableName) errors.push("Output table name required");
    }
  }

  // Required prompt (ai_transformation, ai_export)
  if (manifest.requires_prompt) {
    const prompt = nodePrompts[node.id]?.trim();
    if (!prompt) errors.push(`${manifest.ui?.prompt_label || "Prompt"} required`);
  }

  // Export file name (export_excel — is_export but no prompt)
  if (manifest.is_export && !manifest.requires_prompt) {
    const fileName = nodePrompts[node.id]?.trim();
    if (!fileName) errors.push("Export file name required");
  }

  // Source table(s) required
  if (manifest.requires_table_input) {
    const src = nodeSourceTables[node.id];
    const srcs = Array.isArray(src) ? src : [src];
    if (!srcs.some(t => t?.trim())) errors.push("Input table required");
  }

  // Code node: custom $table() reference validation (complex JS analysis — intentional exception)
  if (node.node_type === "code") {
    const jsCode = node.settings?.processing?.jsCode?.trim();
    if (!jsCode) {
      errors.push("JavaScript code is required");
    } else {
      const tableRefs = [...jsCode.matchAll(/\$table\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(m => m[1]);
      const tableRefSet = new Set(tableRefs);
      if (tableRefSet.size > 0) {
        const stored = nodeSourceTables[node.id];
        let configuredTables = [];
        if (Array.isArray(stored)) {
          configuredTables = stored.map(t => t?.trim()).filter(Boolean);
        } else if (typeof stored === "string" && stored.trim()) {
          configuredTables = [stored.trim()];
        }
        const configuredSet = new Set(configuredTables.map(t => t.toLowerCase()));
        for (const ref of tableRefSet) {
          if (!configuredSet.has(ref.toLowerCase())) {
            errors.push(`$table('${ref}') requires "${ref}" to be added in Table Source above`);
          }
        }
      }
    }
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
  resetPauseReviewState,
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
  const [textDisplayUrl, setTextDisplayUrl] = useState(null);
  const textDisplayUrlRef = useRef(null);

  // Polling refs (stale-closure-safe)
  const isPollingRef = useRef(false);
  const pollingTimeoutRef = useRef(null);
  const runGuidRef = useRef(null);
  const runConfigRef = useRef(null);
  const pollCountRef = useRef(0);
  const pollingStartTimeRef = useRef(null);
  const lastPollTimeRef = useRef(null);
  const autoTriggeredRef = useRef(new Set());
  const pauseReviewTableDataRef = useRef(null);
  const prevNodeIndexRef = useRef(null);
  const prevStatusRef = useRef(null);
  const runStartTimeRef = useRef(null);
  const activeRunGuidRef = useRef(null); // Track current run to filter stale responses

  // Keep refs in sync
  runGuidRef.current = runGuid;
  runConfigRef.current = runConfig;

  // Pause Review table name — set when node_done arrives, consumed by usePauseReviewTable
  const [pauseReviewTableName, setPauseReviewTableName] = useState(null);
  // Incremented each time a table result arrives, even if the name is unchanged
  const [tableRefreshKey, setTableRefreshKey] = useState(0);
  // Node response from backend — rendered in RunTab PAUSE_REVIEW state
  const [pauseReviewMessage, setPauseReviewMessage] = useState(null);

  // Sync pauseReviewTableData ref when it changes
  const updatePauseReviewTableDataRef = useCallback((data) => {
    pauseReviewTableDataRef.current = data;
  }, []);

  const startPolling = useCallback(() => {
    DEBUG && console.log('[WF-DEBUG] polling STARTED', {
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
    DEBUG && console.log(`[WF-DEBUG] polling STOPPED reason=${reason}, after ${pollCountRef.current} polls`);
    isPollingRef.current = false;
    setIsPolling(false);
  }, []);

  // Stable poll callback - reduced logging
  const pollRunStatus = useCallback(async (signal) => {
    DEBUG && console.log('[WF-POLL-DEBUG] pollRunStatus called');
    if (!runGuidRef.current) {
      DEBUG && console.log('[WF-POLL] Skipping - no runGuid');
      return;
    }

    DEBUG && console.log('[WF-POLL] ========== POLL START ==========');
    
    const status = await pollStatus(runGuidRef.current, signal);
    pollCountRef.current += 1;
    const elapsed = pollingStartTimeRef.current ? Date.now() - pollingStartTimeRef.current : 0;
    
    DEBUG && console.log('[WF-POLL] Poll #:', pollCountRef.current, 'Status:', status.status, 'Elapsed:', elapsed, 'ms');
    
    const prevNodeIndex = prevNodeIndexRef.current;
    const prevStatus = prevStatusRef.current;
    
    DEBUG && console.log('[WF-POLL] State change:', prevStatus, '→', status.status, '| Node:', prevNodeIndex, '→', status.current_node_index);

    setOrchestratorStatus(status.status);
    setCurrentNodeIndex(status.current_node_index);
    
    prevNodeIndexRef.current = status.current_node_index;
    prevStatusRef.current = status.status;

    if (status.status === 'node_done') {
      DEBUG && console.log('[WF-POLL] ========== NODE DONE ==========');
      stopPolling('node_done');
      const currentNode = runConfigRef.current?.nodes?.[status.current_node_index];
      DEBUG && console.log('[WF-POLL] Current node:', currentNode?.node_type, 'table:', currentNode?.table_name);

      const newResponse = status.node_response;
      const currentResponse = pauseReviewMessage;
      const hasContentChanged = JSON.stringify(newResponse) !== JSON.stringify(currentResponse);
      
      if (newResponse && hasContentChanged) {
        DEBUG && console.log('[WF-POLL] Setting pauseReviewMessage');
        setPauseReviewMessage(newResponse);
      }

      DEBUG && console.log('[WF-POLL] pauseForReview value:', currentNode?.pauseForReview, '| shouldPauseForReview:', currentNode?.pauseForReview !== false);
      const shouldPauseForReview = currentNode?.pauseForReview !== false;

      const currentManifest = NODE_REGISTRY[currentNode?.node_type];
      if (currentManifest?.is_export) {
        DEBUG && console.log('[WF-POLL] Export node - skipping Pause Review');
        setPauseReviewTableName(null);
      } else if (currentNode?.table_name && status.output_table) {
        DEBUG && console.log('[WF-POLL] Setting pauseReviewTableName:', currentNode.table_name);
        setPauseReviewTableName(currentNode.table_name);
        setTableRefreshKey(k => k + 1);

        if (!shouldPauseForReview) {
          DEBUG && console.log('[WF-POLL] Auto-advancing (pauseForReview=false)');
          advanceRun(runGuidRef.current).then(response => {
            DEBUG && console.log('[WF-POLL] Auto-advance response:', response.status);
            setOrchestratorStatus(response.status);
            setCurrentNodeIndex(response.current_node_index);
          }).catch(err => {
            console.error('[WF-POLL] Auto-advance failed:', err);
          });
        } else {
          const totalNodes = runConfigRef.current?.nodes?.length ?? 0;
          const isSingleNodeRun = totalNodes === 1;

          if (isSingleNodeRun) {
            DEBUG && console.log('[WF-POLL] Single node run - auto-advancing');
            advanceRun(runGuidRef.current).then(response => {
              DEBUG && console.log('[WF-POLL] Auto-advance response:', response.status);
              setOrchestratorStatus(response.status);
              setCurrentNodeIndex(response.current_node_index);
            }).catch(err => {
              console.error('[WF-POLL] Auto-advance failed:', err);
            });
          }
        }
      } else if (currentNode?.table_name && !status.output_table) {
        DEBUG && console.log('[WF-POLL] No table output -', shouldPauseForReview ? 'pausing for review' : 'auto-advancing');
        if (!shouldPauseForReview) {
          advanceRun(runGuidRef.current).then(response => {
            DEBUG && console.log('[WF-POLL] Auto-advance response:', response.status);
            setOrchestratorStatus(response.status);
            setCurrentNodeIndex(response.current_node_index);
          }).catch(err => {
            console.error('[WF-POLL] Auto-advance (no table) failed:', err);
          });
        }
      } else {
        console.warn('[WF-POLL] WARNING: node_done but no table_name!');
      }
    } else if (status.status === 'export_downloaded') {
      DEBUG && console.log('[WF-POLL] ========== EXPORT DOWNLOADED ==========');
      stopPolling('export_downloaded');
      setShowExportConfirmation(true);
    } else if (status.status === 'done') {
      DEBUG && console.log('[WF-POLL] ========== WORKFLOW DONE ==========');
      stopPolling('done');
    } else if (status.status === 'error') {
      DEBUG && console.log('[WF-POLL] ========== ERROR ==========');
      console.log('  Error message:', status.error_message);
      stopPolling('error');
      setOrchestratorError(status.error_message || 'An error occurred');
    } else {
      setPollCount(pollCountRef.current);
      if (pollCountRef.current >= 30) {
        console.warn(`[WF-POLL] STALE WARNING: ${pollCountRef.current} consecutive 'running' polls (${elapsed}ms)`);
      }
    }
    
    DEBUG && console.log('[WF-POLL] ========== POLL END ==========');
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
      DEBUG && console.log(`[WF-POLL-TIMER] Interval since last poll: ${interval ? interval + 'ms' : 'first poll'}`);
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
        const manifest = NODE_REGISTRY[currentNode.node_type];

        // text_display nodes render client-side — no webhook needed
        if (manifest?.behavior === 'text_display') {
          DEBUG && console.log('[Webhook] Rendering text_display locally:', currentNode.node_type);
          const content = currentNode.text_settings?.content || '';
          const html = markdownToHtml(content);
          if (textDisplayUrlRef.current) URL.revokeObjectURL(textDisplayUrlRef.current);
          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          textDisplayUrlRef.current = url;
          setTextDisplayUrl(url);
          stopPolling('text_display_local');
          setOrchestratorStatus('node_done');
          return;
        }

        DEBUG && console.log('[Webhook] Sending webhook request:', currentNode.node_type);

        const response = await fetch(currentNode.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(currentNode.webhook_body),
        });

        DEBUG && console.log('[Webhook] response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Webhook] Webhook error response:', errorText);
          throw new Error(`Webhook returned ${response.status}: ${errorText}`);
        }

        if (manifest?.is_export) {
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
          const responseText = await response.text();
          if (!responseText.trim()) {
            throw new Error('Node returned empty response — check JavaScript code for errors');
          }
          const responseData = JSON.parse(responseText);
          if (responseData.ok === false) {
            throw new Error(responseData.error || 'Node execution failed');
          }
          DEBUG && console.log('[Webhook] response data:', responseData);
        }
      } catch (err) {
        console.error('[Webhook] Webhook error:', err.message);
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
    if (resetPauseReviewState) resetPauseReviewState();
    setPauseReviewTableName(null);
    setPauseReviewMessage(null);

    // Optimistic UI: switch to Run tab immediately, show loading
    setMidTab('run');
    setIsStarting(true);
    runStartTimeRef.current = performance.now();
    DEBUG && console.log('[TIMING] Run Workflow clicked at', runStartTimeRef.current.toFixed(1), 'ms');

    try {
      const orchestratorNodes = convertNodesToOrchestratorFormat(nodes, tableNames, nodePrompts, nodeSourceTables);
      DEBUG && console.log('[WF-DEBUG] Sending to orchestrator /start');
      const response = await startRun('run_workflow', orchestratorNodes, workflowId);
      
      const orchDone = performance.now();
      DEBUG && console.log('[TIMING] Orch /start response latency:', (orchDone - runStartTimeRef.current).toFixed(0), 'ms');

      DEBUG && console.log('[WF-DEBUG] Orchestrator response nodes:', response.nodes?.length);

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
        DEBUG && console.log('[WF-START] About to start polling');
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
      DEBUG && console.log('[WF-DEBUG] Sending to orchestrator /start (single_node)');
      const response = await startRun('single_node', orchestratorNodes, workflowId);

      DEBUG && console.log('[WF-DEBUG] Orchestrator response (single_node), nodes:', response.nodes?.length);

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
    DEBUG && console.log('[WF-DEBUG] resetRun called');
    
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
    setPauseReviewMessage(null);
    if (textDisplayUrlRef.current) {
      URL.revokeObjectURL(textDisplayUrlRef.current);
      textDisplayUrlRef.current = null;
    }
    setTextDisplayUrl(null);
    setMidTab('settings');

    if (currentRunGuid && isMultiNode) {
      cancelRun(currentRunGuid).catch(err => {
        console.warn('[WF-DEBUG] Cancel API failed:', err.message);
      });
    }
  };

  const stopRun = () => {
    DEBUG && console.log('[WF-DEBUG] stopRun called');
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

    if (saveTableFn) await saveTableFn();

    // ACCUMULATE: Add current table to persisted collection before advancing
    if (currentTableData && pauseReviewTableName && setAccumulatedTables) {
      setAccumulatedTables(prev => ({
        ...prev,
        [pauseReviewTableName]: currentTableData
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
      setPauseReviewTableName(null);
      setPauseReviewMessage(null);
      if (resetPauseReviewState) resetPauseReviewState();
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
      setPauseReviewTableName(null);
      setPauseReviewMessage(null);
      if (resetPauseReviewState) resetPauseReviewState();
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
    DEBUG && console.log(`[WF-DEBUG] forceNodeComplete → run_guid=${runGuid}, node_index=${currentNodeIndex}`);
    try {
      const { nodeComplete } = await import('../services/orchestrator.js');
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
    if (!DEBUG) return null;
    
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
      console.log(`    [${idx}] ${node.id}: ${node.label} (type: ${node.node_type})`);
    });
    
    console.log('%c[WF-DEBUG-DUMP] PAUSE REVIEW STATE', 'background: #3b82f6; color: white; font-weight: bold; padding: 2px 6px;');
    console.log('  pauseReviewTableName:', pauseReviewTableName);
    console.log('  pauseReviewTableDataRef exists:', !!pauseReviewTableDataRef.current);
    
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
      pauseReviewState: {
        pauseReviewTableName,
        hasTableData: !!pauseReviewTableDataRef.current
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
  }, [runGuid, currentNodeIndex, orchestratorStatus, isPolling, pollCount, isAdvancing, orchestratorError, runConfig, nodes, pauseReviewTableName, completedDownloads, showExportConfirmation, exportFileName]);

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
    pauseReviewTableName, setPauseReviewTableName, tableRefreshKey,
    pauseReviewMessage,
    textDisplayUrl,
    pollingStartTimeRef,
    runStartTimeRef,
    updatePauseReviewTableDataRef,

    startRunWorkflow, startSingleNode, runSingle,
    resetRun, stopRun, handleAdvance, handleExportAdvance,
    forceNodeComplete, forceDebugDump, startPolling, stopPolling,
  };
}
