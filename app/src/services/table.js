// ─────────────────────────────────────────────
// TABLE SERVICE
// Handles table read/edit/row operations for QC panel
// PRD: prd/platform/n8n-workflows/utilities.md
// ─────────────────────────────────────────────
import { TABLE_ENDPOINTS } from '../config.js';

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
  const url = new URL(TABLE_ENDPOINTS.READ);
  url.searchParams.append('table_name', table_name);
  const response = await fetch(url.toString());
  const data = await handleResponse(response);

  // API returns an array; take the first element
  const record = Array.isArray(data) ? data[0] : data;
  const columns = record?.columns || [];

  // Rows are objects — convert to ordered arrays matching column order
  const rawRows = record?.rows || [];
  const rows = rawRows.map(row =>
    Array.isArray(row) ? row : columns.map(col => row[col] ?? '')
  );

  return { headers: columns, rows, row_count: record?.row_count };
};

/**
 * Apply edits to table
 * @param {string} table_name - Name of the table to edit
 * @param {Array} edits - Array of edit objects { row_index, column, new_value }
 * @returns {Promise<Object>} { edits_applied: number }
 */
export const editTable = async (table_name, edits) => {
  const response = await fetch(TABLE_ENDPOINTS.EDIT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table_name, edits }),
  });
  return handleResponse(response);
};

/**
 * Row operations (add/delete)
 * @param {string} table_name - Name of the table to modify
 * @param {string} operation - 'add' or 'delete'
 * @param {number|null} row_index - Row index for delete; null for add (appends to end)
 * @param {Object|null} values - Row values as { column: value } object (for add)
 * @returns {Promise<Object>} { new_row_count: number }
 */
export const rowOperation = async (table_name, operation, row_index = null, values = null) => {
  const payload = { table_name, operation };
  if (operation === 'delete') payload.row_index = row_index;
  if (operation === 'add' && values) payload.values = values;

  const response = await fetch(TABLE_ENDPOINTS.ROW, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

/**
 * Add a new row (appends to end)
 * @param {string} table_name - Name of the table
 * @param {Object} values - Row values as { column: value } object
 * @returns {Promise<Object>} { new_row_count: number }
 */
export const addRow = (table_name, values) => rowOperation(table_name, 'add', null, values);

/**
 * Delete a row
 * @param {string} table_name - Name of the table
 * @param {number} row_index - Row index to delete
 * @returns {Promise<Object>} { new_row_count: number }
 */
export const deleteRow = (table_name, row_index) => rowOperation(table_name, 'delete', row_index);
