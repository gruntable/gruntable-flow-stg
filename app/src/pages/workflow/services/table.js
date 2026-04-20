// ─────────────────────────────────────────────
// TABLE SERVICE
// Handles table read/replace operations for Pause Review panel
// PRD: prd/platform/n8n-workflows/utilities.md
// ─────────────────────────────────────────────
import { TABLE_ENDPOINTS } from '../../../config.js';
import { getUserId } from './user.js';

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Table service error: ${response.status} - ${error}`);
  }
  return response.json();
};

/**
 * Read table data
 * Converts from API format { columns, rows } to component format { headers, rows }
 * @param {string} table_name - Name of the table to read
 * @returns {Promise<Object>} { headers: [], rows: [] }
 */
export const readTable = async (table_name) => {
  const user_id = getUserId();
  const url = new URL(TABLE_ENDPOINTS.READ);
  url.searchParams.append('user_id', user_id);
  url.searchParams.append('table_name', table_name);

  console.log("[table.js] readTable called:", { table_name, user_id });

  const response = await fetch(url.toString());
  const data = await handleResponse(response);

  console.log("[table.js] API response:", {
    isArray: Array.isArray(data),
    dataLength: Array.isArray(data) ? data.length : 1,
    firstRecordKeys: Array.isArray(data) ? Object.keys(data[0] || {}) : Object.keys(data || {})
  });

  // API returns an array; take the first element
  const record = Array.isArray(data) ? data[0] : data;
  const columns = record?.columns || [];

  // Rows are objects — convert to ordered arrays matching column order
  const rawRows = record?.rows || [];
  const rows = rawRows.map(row =>
    Array.isArray(row) ? row : columns.map(col => row[col] ?? '')
  );

  console.log("[table.js] Returning:", {
    headers: columns,
    rowCount: rows.length,
    firstRow: rows[0]
  });

  return { headers: columns, rows, row_count: record?.row_count };
};

/**
 * Replace entire table contents
 * @param {string} table_name - Name of the table
 * @param {string[]} headers - Column names
 * @param {string[][]} rows - Row data as arrays matching header order
 * @returns {Promise<Object>} { table_name, rows_saved, status }
 */
export const replaceTable = async (table_name, headers, rows) => {
  const user_id = getUserId();
  const response = await fetch(TABLE_ENDPOINTS.REPLACE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, table_name, columns: headers, rows }),
  });
  return handleResponse(response);
};

/**
 * Delete a table permanently
 * @param {string} table_name - Name of the table to delete
 * @returns {Promise<Object>} { table_name, status }
 */
export const deleteTable = async (table_name) => {
  const user_id = getUserId();
  const response = await fetch(TABLE_ENDPOINTS.DELETE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, table_name }),
  });
  return handleResponse(response);
};

/**
 * Rename a table (no native RENAME API — creates new, deletes old)
 * @param {string} oldName - Current table name
 * @param {string} newName - New table name
 * @param {string[]} headers - Column names
 * @param {string[][]} rows - Row data
 */
export const renameTable = async (oldName, newName, headers, rows) => {
  await replaceTable(newName, headers, rows);
  await deleteTable(oldName);
};

/**
 * List all tables for the current user
 * @returns {Promise<Object>} { user_id, tables: [], count }
 */
export const listTables = async () => {
  const user_id = getUserId();
  const url = new URL(TABLE_ENDPOINTS.LIST);
  url.searchParams.append('user_id', user_id);
  const response = await fetch(url.toString());
  return handleResponse(response);
};
