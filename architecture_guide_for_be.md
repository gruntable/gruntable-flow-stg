# Gruntable Flow — Architecture Guide for Backend Engineers

> **Audience:** Backend engineers who need to understand what HTTP requests the frontend makes, what payloads it sends, what it expects back, and how state flows through the app.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React SPA (Vite)                       │
│                                                             │
│  ┌───────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │ Workspace │──│ useWorkflows │──│ localStorage          │ │
│  │ (root)    │  │ useOrchest.  │  │  • user_id            │ │
│  │           │  │ useQCTable   │  │  • workflow metadata   │ │
│  │           │  │ usePanelW.   │  │  • open table tabs     │ │
│  └─────┬─────┘  └──────┬───────┘  └───────────────────────┘ │
│        │               │                                    │
│  ┌─────▼───────────────▼────────────────────────────────┐   │
│  │              Service Layer (fetch calls)              │   │
│  │  orchestrator.js  │  table.js  │  user.js             │   │
│  └──────────┬────────────┬────────────────────────────── │   │
└─────────────┼────────────┼──────────────────────────────────┘
              │            │
              ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                n8n Instance (Webhook API)                    │
│                                                             │
│  /webhook/orchestrator/start     POST                       │
│  /webhook/orchestrator/status    GET                        │
│  /webhook/orchestrator/advance   POST                       │
│  /webhook/orchestrator/cancel    POST                       │
│  /webhook/orchestrator/node-complete  POST                  │
│                                                             │
│  /webhook/table/read             GET                        │
│  /webhook/table/replace          POST                       │
│  /webhook/table/list             GET                        │
│  /webhook/table/delete           POST                       │
│                                                             │
│  /form/ai-extraction-pdf         (n8n form, loaded in iframe)│
│  /form/ai-extraction-image       (n8n form, loaded in iframe)│
│  /form/ai-extraction-spreadsheet (n8n form, loaded in iframe)│
│                                                             │
│  + Dynamic webhook URLs returned by orchestrator /start     │
└─────────────────────────────────────────────────────────────┘
```

### Environment Config

The single environment variable that controls the backend target:

```
VITE_API_BASE_URL=https://grunts-gruntable-api.com
```

Resolved in `src/config.js` as:
```js
export const N8N_BASE = import.meta.env.VITE_API_BASE_URL
  || import.meta.env.VITE_DEFAULT_API_BASE_URL
  || "https://n8n-stg.gruntable.com";
```

All endpoint constants (`ORCHESTRATOR_ENDPOINTS`, `TABLE_ENDPOINTS`, `N8N_FORM_URLS`) are derived from this single base URL.

---

## 2. User Identity

**File:** `src/services/user.js`

The current system generates a **UUIDv4 client-side** and stores it in `localStorage` under the key `gruntable_user_id`. This `user_id` is attached to **every** API request as a tenant partition key.

| Function | What it does |
|---|---|
| `getUserId()` | Returns the stored UUID, or generates + stores a new one |
| `resetUserId()` | Generates a fresh UUID (for testing) |
| `hasUserId()` | Checks if a UUID exists in localStorage |

> [!IMPORTANT]
> There is **no server-side authentication** today. Any API call can impersonate any user by passing their `user_id`. The SSO guide (`bubble_supabase_sso_guide.md`) in this repo covers the production auth plan.

---

## 3. The Orchestrator — Complete Lifecycle

This is the most complex system. The orchestrator manages **workflow runs** — executing a sequence of AI processing nodes one at a time.

### 3.1 API Contracts

#### `POST /webhook/orchestrator/start`

**Request body:**
```json
{
  "trigger_mode": "run_workflow" | "single_node",
  "workflow_id": "<UUID of the active workflow>",
  "user_id": "<UUID from localStorage>",
  "nodes": [
    {
      "node_id": "node_abc123",
      "node_type": "ai_extraction" | "ai_transformation" | "export_excel" | "ai_export",
      "label": "AI Extraction PDF, Spreadsheet, Image",
      "output_name": "Mutasi Bank",
      "prompt": "Extract all transactions...",
      "input_name": "",
      "source_table_names": null | ["Table A", "Table B"],
      "source_table_name": null | "Table A",
      "fileName": "export.xlsx",
      "extraction_mode": "per_page" | "per_file",
      "conflict_mode": "overwrite" | "append",
      "output_format": "json" | "xml"
    }
  ]
}
```

**Expected response:**
```json
{
  "run_guid": "<UUID>",
  "status": "running",
  "current_node_index": 0,
  "total_nodes": 3,
  "nodes": [
    {
      "node_id": "node_abc123",
      "node_type": "ai_extraction",
      "trigger_type": "form" | "auto",
      "form_url": "https://...n8n form URL with query params...",
      "webhook_url": "https://...webhook URL for auto-trigger nodes...",
      "webhook_body": { "...payload the frontend should POST..." },
      "table_name": "user123_wf456_Mutasi Bank",
      "label": "AI Extraction PDF, Spreadsheet, Image"
    }
  ]
}
```

> [!IMPORTANT]
> The `nodes` array in the response is **the authoritative run plan**. It contains server-generated URLs (`form_url`, `webhook_url`) and the **technical table name** (prefixed with `user_id` and `workflow_id`). The frontend uses these directly — it does NOT construct URLs itself.

**Two trigger types the backend must assign to each node:**

| `trigger_type` | Behavior | Node types |
|---|---|---|
| `"form"` | Frontend renders an iframe pointing at `form_url`. The n8n form handles user interaction (file upload). When the form completes, n8n signals `node-complete` itself. | `ai_extraction` |
| `"auto"` | Frontend auto-POSTs `webhook_body` to `webhook_url`. No user interaction needed. | `ai_transformation`, `export_excel`, `ai_export` |

---

#### `GET /webhook/orchestrator/status?run_guid=<UUID>`

**Polled every 2 seconds** while a run is active.

**Expected response:**
```json
{
  "status": "running" | "node_done" | "export_downloaded" | "done" | "error" | "cancelled",
  "current_node_index": 0,
  "output_table": "user123_wf456_Mutasi Bank",
  "error_message": null | "Something went wrong"
}
```

**Status values and what the frontend does:**

| Status | Frontend reaction |
|---|---|
| `running` | Continues polling (2s interval) |
| `node_done` | **Stops polling.** Fetches the output table for QC review. If single-node run, auto-advances. If multi-node, waits for user to click "Advance". |
| `export_downloaded` | **Stops polling.** Shows export confirmation UI. |
| `done` | **Stops polling.** Shows "Workflow complete" notice. |
| `error` | **Stops polling.** Displays `error_message` in the UI. |

---

#### `POST /webhook/orchestrator/advance`

Called when the user approves a QC result and wants to move to the next node.

**Request body:**
```json
{ "run_guid": "<UUID>" }
```

**Expected response:**
```json
{
  "status": "running" | "done",
  "current_node_index": 1
}
```

If `status` is `"running"`, the frontend restarts polling for the next node.

---

#### `POST /webhook/orchestrator/cancel`

**Request body:**
```json
{ "run_guid": "<UUID>" }
```

**Expected response:**
```json
{ "run_guid": "<UUID>", "status": "cancelled" }
```

---

#### `POST /webhook/orchestrator/node-complete`

Not typically called from the React frontend (called by n8n internally when a form-based node finishes). Available as an escape hatch (`forceNodeComplete`) for debugging.

**Request body:**
```json
{
  "run_guid": "<UUID>",
  "node_index": 0,
  "output_table": "user123_wf456_Mutasi Bank",
  "rows_processed": 42,
  "error": null
}
```

---

### 3.2 Orchestrator State Machine (Frontend View)

```
                    ┌──────────┐
                    │   idle   │  (user hasn't started a run)
                    └────┬─────┘
                         │ user clicks "Run Workflow" or "Run Node"
                         ▼
              POST /orchestrator/start
                         │
                         ▼
                    ┌──────────┐
            ┌──────│ running  │◄────────────────────────┐
            │      └────┬─────┘                         │
            │           │ poll /status every 2s          │
            │           ▼                               │
            │   ┌──────────────┐                        │
            │   │  node_done   │                        │
            │   └──────┬───────┘                        │
            │          │                                │
            │    ┌─────┴──────┐                         │
            │    │            │                         │
            │  single      multi-node                   │
            │  node run    run                          │
            │    │            │                         │
            │    │auto       user clicks                │
            │    │advance    "Advance"                  │
            │    │            │                         │
            │    ▼            ▼                         │
            │  POST /advance  POST /advance             │
            │    │            │                         │
            │    ▼            ├── status=running ───────┘
            │  done           │
            │                 ▼
            │           status=done ──► idle
            │
            ├── status=error ──► show error
            │
            └── status=export_downloaded ──► show download confirmation
                                                │
                                          user clicks OK
                                                │
                                          POST /advance  (if more nodes)
```

### 3.3 Auto-Trigger for Webhook Nodes

When the orchestrator is `running` and the current node has `trigger_type: "auto"`, the frontend **immediately** POSTs to the node's `webhook_url` with `webhook_body` (both provided by the `/start` response).

For **export nodes** (`export_excel`, `ai_export`):
- The response is expected to be a **binary blob** (file download).
- The frontend creates a temporary `<a>` tag, triggers the download, and shows a confirmation.

For **transformation nodes** (`ai_transformation`):
- The response is expected to be JSON (acknowledgement).
- Processing happens server-side; the frontend relies on polling `/status` for completion.

---

## 4. Table CRUD — API Contracts

**File:** `src/services/table.js`

All table operations scope data by `user_id`.

### `GET /webhook/table/read?user_id=<UUID>&table_name=<string>`

**Response (array, frontend takes first element):**
```json
[
  {
    "columns": ["Date", "Description", "Amount"],
    "rows": [
      { "Date": "2026-01-01", "Description": "Payment", "Amount": "100" },
      { "Date": "2026-01-02", "Description": "Refund", "Amount": "-50" }
    ],
    "row_count": 2
  }
]
```

> [!NOTE]
> `rows` can be either **objects** (keyed by column name) or **arrays** (ordered by column index). The frontend normalizes object rows into arrays matching column order. Your backend can return either format.

---

### `POST /webhook/table/replace`

**Replaces the entire table** (not a patch — full overwrite).

**Request body:**
```json
{
  "user_id": "<UUID>",
  "table_name": "Mutasi Bank",
  "columns": ["Date", "Description", "Amount"],
  "rows": [
    ["2026-01-01", "Payment", "100"],
    ["2026-01-02", "Refund", "-50"]
  ]
}
```

**Expected response:**
```json
{ "table_name": "Mutasi Bank", "rows_saved": 2, "status": "ok" }
```

---

### `GET /webhook/table/list?user_id=<UUID>`

**Expected response:**
```json
{
  "user_id": "<UUID>",
  "tables": ["Mutasi Bank", "Data Penjualan", "Reconciled Data"],
  "count": 3
}
```

---

### `POST /webhook/table/delete`

**Request body:**
```json
{
  "user_id": "<UUID>",
  "table_name": "Mutasi Bank"
}
```

**Expected response:**
```json
{ "table_name": "Mutasi Bank", "status": "ok" }
```

---

### Table Rename (No Native API)

Rename is implemented client-side as `replaceTable(newName, ...) → deleteTable(oldName)`. There is no dedicated rename endpoint.

---

## 5. Node Types & Behaviors

**File:** `src/features/workspace/nodes/catalogue.js`

The **node catalogue** defines what the user can add to a workflow. Each node type has a `behavior` that determines how it interacts with your backend.

| Node Type | Behavior | Trigger | Has File Upload | Has Prompt | Has QC Review | Output |
|---|---|---|---|---|---|---|
| `ai_extraction` | `ai_form` | n8n form (iframe) | ✅ | ❌ (prompt is in node config) | ✅ | Creates a table |
| `ai_transformation` | `ai_go` | Auto-webhook | ❌ | ✅ | ✅ | Creates a table |
| `export_excel` | `basic_export` | Auto-webhook | ❌ | ❌ (file name only) | ❌ | Downloads .xlsx |
| `ai_export` | `ai_export` | Auto-webhook | ❌ | ✅ | ❌ | Downloads .json/.xml |

### What happens for each behavior during a run:

**`ai_form` (AI Extraction):**
1. Orchestrator returns `trigger_type: "form"` with a `form_url`
2. Frontend renders the n8n form in an iframe
3. User uploads a file through the form
4. n8n processes the file, writes results to a table, calls `/node-complete`
5. Frontend polls, gets `node_done`, fetches the table for QC

**`ai_go` (AI Transformation):**
1. Orchestrator returns `trigger_type: "auto"` with `webhook_url` + `webhook_body`
2. Frontend auto-POSTs to the webhook
3. n8n processes the transformation, writes to table, calls `/node-complete`
4. Frontend polls, gets `node_done`, fetches the table for QC

**`basic_export` (Export Excel):**
1. Orchestrator returns `trigger_type: "auto"` with `webhook_url` + `webhook_body`
2. Frontend POSTs to webhook, expects a blob response
3. Frontend triggers browser download
4. Polling picks up `export_downloaded`

**`ai_export` (AI Export to JSON/XML):**
1. Same as `basic_export`, but the webhook body includes a `prompt` and `output_format`

---

## 6. Node-to-Orchestrator Payload Conversion

**File:** `src/features/workspace/utils/workflow-metadata.js` → `convertNodesToOrchestratorFormat()`

This function transforms frontend node objects into the payload format expected by `POST /orchestrator/start`. Key field mappings:

| Frontend field | Orchestrator payload field | Notes |
|---|---|---|
| `node.id` | `node_id` | |
| `node.node_type` | `node_type` | |
| `node.label` | `label` | |
| `tableNames[node.id]` | `output_name` | The user-visible table name |
| `nodePrompts[node.id]` | `prompt` | AI prompt or export file name |
| `tableNames[prevNode.id]` | `input_name` | Previous node's output table |
| `nodeSourceTables[node.id]` | `source_table_names` | Array, for ai_transformation |
| `nodeSourceTables[node.id]` | `source_table_name` | String, for export nodes |
| `node.settings.processing.file_name` | `fileName` | Export file name |
| `node.settings.processing.extractionMode` | `extraction_mode` | `per_page` or `per_file` |
| `node.settings.processing.outputFormat` | `output_format` | `json` or `xml` |
| `node.tableOutput.conflictMode` | `conflict_mode` | `overwrite` or `append` |

---

## 7. State Management Architecture

There is **no global state library** (no Redux, no Zustand). All state lives in **React hooks** composed inside `Workspace.jsx`.

### 7.1 Hook Hierarchy

```
Workspace.jsx
├── useWorkflows()        ← Workflow/node CRUD, persisted to localStorage
├── useOrchestrator()     ← Run lifecycle, polling, auto-trigger
├── useQCTable()          ← QC table fetch/save after node completion
└── usePanelWidths()      ← UI layout (persisted to localStorage)
```

### 7.2 `useWorkflows` — Workflow & Node State

**Persistence:** `localStorage` key `gruntable-flow-mvp1-workflow-metadata`

This hook owns **all** workflow configuration state:

| State | Type | Description |
|---|---|---|
| `workflows` | `Array<Workflow>` | All workflows for this user |
| `activeWorkflowId` | `string` | Currently selected workflow |
| `nodes` | `Array<Node>` | Nodes in the active workflow |
| `tableNames` | `{nodeId: string}` | Output table name per node |
| `nodePrompts` | `{nodeId: string}` | AI prompt per node |
| `nodeSourceTables` | `{nodeId: string\|string[]}` | Input table(s) per node |
| `editMode` | `boolean` | Whether workflow is editable |

**Every change** to workflows triggers an immediate `localStorage.setItem(...)` in a `useEffect`.

Supports **import/export** — workflows can be serialized to JSON files and re-imported.

### 7.3 `useOrchestrator` — Run State Machine

| State | Type | Description |
|---|---|---|
| `runGuid` | `string\|null` | Current run UUID |
| `runConfig` | `object\|null` | Full response from `/start` (including node webhook URLs) |
| `orchestratorStatus` | `string` | `idle` / `running` / `node_done` / `done` / `error` / `cancelled` |
| `currentNodeIndex` | `number\|null` | Which node is currently executing |
| `isPolling` | `boolean` | Whether the 2s poll loop is active |
| `pollCount` | `number` | Number of consecutive polls (for stale detection, warns at 30+) |
| `qcTableName` | `string\|null` | Table name to fetch when `node_done` |
| `isAdvancing` | `boolean` | Lock to prevent double-advance |
| `isStarting` | `boolean` | Lock to prevent double-start |

**Polling details:**
- Interval: **2000ms**
- Pauses when the browser tab is hidden (`visibilitychange`)
- Resumes immediately when the tab becomes visible
- Uses `AbortController` for cleanup on unmount
- Stale warning logged after **30 consecutive** `running` polls

### 7.4 `useQCTable` — QC Table Lifecycle

Triggered by `tableRefreshKey` (incremented by the orchestrator when `node_done` fires).

| Step | What happens |
|---|---|
| 1 | `node_done` arrives → orchestrator sets `qcTableName` and increments `tableRefreshKey` |
| 2 | `useQCTable` effect fires → calls `readTable(qcTableName)` |
| 3 | On success → `qcTableData` is populated, `showQC = true` |
| 4 | On failure → retries up to **3 times** with **2s delay** |
| 5 | User edits table → `qcTableDirty = true` |
| 6 | User saves → `replaceTable(name, headers, rows)` is called |
| 7 | User advances → table data is accumulated to `accumulatedTables` |

---

## 8. localStorage Keys Reference

| Key | Purpose | Written by |
|---|---|---|
| `gruntable_user_id` | User UUID (tenant partition) | `user.js` |
| `gruntable-flow-mvp1-workflow-metadata` | Full workflow tree (nodes, prompts, table names) | `useWorkflows` |
| `gruntable-flow-mvp1-open-tables-{workflowId}` | Which table tabs are open + active tab | `Workspace.jsx` |
| `gruntable-flow-panel-widths` | UI panel width percentages | `usePanelWidths` |

---

## 9. Routing

**File:** `src/main.jsx`

| Route | Component | Notes |
|---|---|---|
| `/` | `Workspace` | Default landing |
| `/workspace` | `Workspace` | Alias |
| `/workflow?id=<UUID>` | `Workspace` | Deep-link to a specific workflow |
| `/home` | `HomePage` | Landing/marketing page |

The URL query param `?id=<UUID>` syncs bidirectionally with `activeWorkflowId`.

---

## 10. Key Data Flows (End-to-End)

### Flow A: User runs a full workflow

```
1. User configures nodes in the SettingsTab (prompts, table names, file types)
         ↓
2. User clicks "Run Workflow" button
         ↓
3. Frontend: validateNodeFields() checks all nodes
         ↓
4. Frontend: convertNodesToOrchestratorFormat() builds payload
         ↓
5. POST /orchestrator/start { trigger_mode: "run_workflow", nodes: [...], ... }
         ↓
6. Backend returns { run_guid, status: "running", nodes: [...with webhook details...] }
         ↓
7. Frontend starts 2s polling loop on GET /orchestrator/status?run_guid=xxx
         ↓
8. For AI Extraction nodes (form-based):
   └─ Frontend renders iframe → user uploads file → n8n processes → node-complete
         ↓
9. For AI Transformation / Export nodes (auto):
   └─ Frontend POSTs to webhook_url with webhook_body automatically
         ↓
10. Backend sets status to "node_done" → frontend fetches table via /table/read
         ↓
11. User reviews QC table, optionally edits, clicks "Advance"
         ↓
12. POST /orchestrator/advance { run_guid } → backend starts next node
         ↓
13. Repeat 7-12 until all nodes complete → status becomes "done"
```

### Flow B: User edits a previously created table

```
1. User opens TablePicker → GET /table/list?user_id=xxx
         ↓
2. User selects a table → GET /table/read?user_id=xxx&table_name=yyy
         ↓
3. User edits cells in the spreadsheet UI
         ↓
4. User clicks Save → POST /table/replace { user_id, table_name, columns, rows }
```

---

## 11. What the Backend Must Guarantee

1. **`/orchestrator/start` must return `run_guid`** — the frontend checks for this and shows an error if missing.

2. **`/orchestrator/status` must eventually transition out of `running`** — the frontend warns at 30+ polls but never auto-cancels.

3. **`/table/read` response format** — must return `columns` (array of strings) and `rows` (array of objects or arrays). The frontend normalizes both.

4. **Export webhooks must return binary blobs** — the frontend calls `response.blob()` and triggers download. Content-Type should be appropriate (e.g., `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).

5. **Table names are scoped by `user_id`** — the backend must enforce tenant isolation. The frontend sends `user_id` with every request but does not verify isolation.

6. **`webhook_url` and `webhook_body` in `/start` response** — the frontend trusts these completely and POSTs them verbatim. The backend generates these.

---

## 12. File Index

| File | Purpose |
|---|---|
| `src/config.js` | All endpoint URLs, form URLs, default project template |
| `src/services/user.js` | User ID generation and localStorage management |
| `src/services/table.js` | Table CRUD (`readTable`, `replaceTable`, `deleteTable`, `listTables`, `renameTable`) |
| `src/services/orchestrator.js` | Orchestrator API calls (`startRun`, `pollStatus`, `advanceRun`, `cancelRun`, `nodeComplete`) |
| `src/main.jsx` | React Router setup, 4 routes |
| `src/features/workspace/Workspace.jsx` | Root component — composes all hooks, manages table accumulation |
| `src/features/workspace/hooks/useWorkflows.js` | Workflow/node CRUD, localStorage persistence, import/export |
| `src/features/workspace/hooks/useOrchestrator.js` | Run lifecycle, polling, auto-trigger, state machine |
| `src/features/workspace/hooks/useQCTable.js` | QC table fetch/save with retry |
| `src/features/workspace/hooks/usePanelWidths.js` | UI layout persistence |
| `src/features/workspace/nodes/catalogue.js` | Node type definitions (4 types) |
| `src/features/workspace/utils/workflow-metadata.js` | Serialization, deserialization, node payload conversion |
| `src/features/workspace/components/LeftPanel.jsx` | Node list, run/stop/edit buttons |
| `src/features/workspace/components/MiddlePanel.jsx` | Settings tab + Run tab container |
| `src/features/workspace/components/SettingsTab.jsx` | Node configuration forms |
| `src/features/workspace/components/RunTab.jsx` | Live run status, iframe for forms, QC controls |
| `src/features/workspace/components/TablePanel.jsx` | Spreadsheet viewer/editor, tabbed |
| `src/features/workspace/components/TopBar.jsx` | Workflow dropdown, save status, import/export |
| `src/features/workspace/components/NodePicker.jsx` | Modal to add nodes from catalogue |
| `src/features/workspace/components/TablePicker.jsx` | Modal to open/create tables |
