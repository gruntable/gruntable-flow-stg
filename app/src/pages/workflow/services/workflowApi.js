import { WORKFLOW_ENDPOINTS } from '../../../config.js';
import { getUserId } from './user.js';

export async function saveWorkflow(workflow) {
  const requestId = crypto.randomUUID();
  const userId = getUserId();
  const { id, name, ...workflowData } = workflow;
  const payload = {
    id,
    user_id: userId,
    name: name,
    workflow_json: workflowData,
    _debug_request_id: requestId,
  };

  console.log(`[saveWorkflow] START request_id=${requestId} workflow="${name}" id=${id}`, new Date().toISOString());
  console.trace('[saveWorkflow] call stack');

  const response = await fetch(WORKFLOW_ENDPOINTS.SAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  console.log(`[saveWorkflow] END request_id=${requestId} status=${response.status}`, new Date().toISOString());

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to save workflow: ${response.status} - ${text}`);
  }
  return response.json();
}

export async function listWorkflows(userIdParam) {
  const userId = userIdParam || getUserId();
  const url = `${WORKFLOW_ENDPOINTS.LIST}?user_id=${encodeURIComponent(userId)}`;
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to list workflows: ${response.status} - ${text}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : { workflows: [] };
}

export async function getWorkflow(id) {
  const url = `${WORKFLOW_ENDPOINTS.GET}?id=${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const text = await response.text();
    throw new Error(`Failed to get workflow: ${response.status} - ${text}`);
  }
  return response.json();
}

export async function renameWorkflow(id, name, userIdParam) {
  const userId = userIdParam || getUserId();
  const payload = {
    id,
    user_id: userId,
    name,
    workflow_json: {},
    _debug_request_id: crypto.randomUUID(),
  };
  const response = await fetch(WORKFLOW_ENDPOINTS.SAVE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to rename workflow: ${response.status} - ${text}`);
  }
  return response.json();
}

export async function deleteWorkflow(id, userIdParam) {
  const userId = userIdParam || getUserId();
  const url = `${WORKFLOW_ENDPOINTS.DELETE}?id=${encodeURIComponent(id)}&user_id=${encodeURIComponent(userId)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-http-method-override': 'DELETE' },
  });
  if (!response.ok) {
    if (response.status === 404) {
      return { error: 'Workflow not found or unauthorized' };
    }
    const text = await response.text();
    throw new Error(`Failed to delete workflow: ${response.status} - ${text}`);
  }
  return response.json();
}
