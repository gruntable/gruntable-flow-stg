// ─────────────────────────────────────────────
// ORCHESTRATOR SERVICE
// Handles all orchestrator API calls for MVP-1
// PRD: prd/platform/orchestrator.md
// ─────────────────────────────────────────────
import { ORCHESTRATOR_ENDPOINTS } from '../config.js';
import { getUserId } from './user.js';

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Orchestrator error: ${response.status} - ${error}`);
  }
  return response.json();
};

/**
 * Start a new run (run_workflow or single_node mode)
 * @param {string} trigger_mode - 'run_workflow' or 'single_node'
 * @param {Array} nodes - Array of node objects with node_id, node_type, label, output_name, prompt, input_name, file_name
 * @param {string} workflow_id - The project/workflow ID
 * @returns {Promise<Object>} Run configuration with run_guid and nodes array.
 */
export const startRun = async (trigger_mode, nodes, workflow_id) => {
  const user_id = getUserId();
  const body = { trigger_mode, nodes, workflow_id, user_id };

  const response = await fetch(ORCHESTRATOR_ENDPOINTS.START, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handleResponse(response);
};

/**
 * Poll run status
 * @param {string} run_guid - The run UUID
 * @param {AbortSignal} [signal] - Optional AbortSignal to cancel the request on unmount
 * @returns {Promise<Object>} Status response with status, current_node_index, etc.
 */
export const pollStatus = async (run_guid, signal) => {
  const response = await fetch(
    `${ORCHESTRATOR_ENDPOINTS.STATUS}?run_guid=${encodeURIComponent(run_guid)}`,
    { signal }
  );
  return handleResponse(response);
};

/**
 * Advance to next node after QC
 * @param {string} run_guid - The run UUID
 * @returns {Promise<Object>} New state with status, current_node_index
 */
export const advanceRun = async (run_guid) => {
  const response = await fetch(ORCHESTRATOR_ENDPOINTS.ADVANCE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_guid }),
  });
  return handleResponse(response);
};

/**
 * Cancel a running workflow
 * @param {string} run_guid - The run UUID
 * @returns {Promise<Object>} { run_guid, status: 'cancelled' }
 */
export const cancelRun = async (run_guid) => {
  const response = await fetch(ORCHESTRATOR_ENDPOINTS.CANCEL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ run_guid }),
  });
  return handleResponse(response);
};

/**
 * Mark node as complete (called internally by node forms)
 * Not typically called from React directly
 * @param {string} run_guid - The run UUID
 * @param {number} node_index - Current node index
 * @param {string} output_table - Output table name
 * @param {number} rows_processed - Number of rows processed
 * @param {string|null} error - Error message if any
 * @returns {Promise<Object>} { ok: true }
 */
export const nodeComplete = async (run_guid, node_index, output_table, rows_processed = 0, error = null) => {
  const response = await fetch(ORCHESTRATOR_ENDPOINTS.NODE_COMPLETE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      run_guid,
      node_index,
      output_table,
      rows_processed,
      error,
    }),
  });
  return handleResponse(response);
};
