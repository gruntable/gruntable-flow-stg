// ─────────────────────────────────────────────
// N8N CONFIGURATION
// Update N8N_BASE if the host changes.
// n8n form paths are defined in nodes/catalogue.js and
// must match imported workflows in /n8n/workflows.
//
// To switch environments, create/edit app/.env.local:
//   STG:  VITE_API_BASE_URL=https://n8n-stg.gruntable.com
//   PROD: VITE_API_BASE_URL=https://grunts.gruntable-api.com
// To change the default fallback, set VITE_DEFAULT_API_BASE_URL.
// Then restart the dev server. .env.local is gitignored.
// ─────────────────────────────────────────────

export const N8N_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_DEFAULT_API_BASE_URL || "https://n8n-stg.gruntable.com";

// Orchestrator endpoints (PRD: prd/platform/orchestrator.md)
export const ORCHESTRATOR_ENDPOINTS = {
  START: `${N8N_BASE}/webhook/orchestrator/start`,
  STATUS: `${N8N_BASE}/webhook/orchestrator/status`,
  ADVANCE: `${N8N_BASE}/webhook/orchestrator/advance`,
  CANCEL: `${N8N_BASE}/webhook/orchestrator/cancel`,
  NODE_COMPLETE: `${N8N_BASE}/webhook/orchestrator/node-complete`,
};

// Table utility endpoints (PRD: prd/platform/n8n-workflows/utilities.md)
export const TABLE_ENDPOINTS = {
  READ: `${N8N_BASE}/webhook/table/read`,
  REPLACE: `${N8N_BASE}/webhook/table/replace`,
  LIST: `${N8N_BASE}/webhook/table/list`,
  DELETE: `${N8N_BASE}/webhook/table/delete`,
};

// Home page endpoints
export const HOME_ENDPOINTS = {
  CARDS: `${N8N_BASE}/webhook/home/cards`,
};

// Templates page endpoints
export const TEMPLATE_ENDPOINTS = {
  REGISTRY: `${N8N_BASE}/webhook/template/registry`,
};

// Workflow CRUD endpoints
export const WORKFLOW_ENDPOINTS = {
  SAVE: `${N8N_BASE}/webhook/workflow/save`,
  LIST: `${N8N_BASE}/webhook/workflow/list`,
  GET: `${N8N_BASE}/webhook/workflow/get`,
  DELETE: `${N8N_BASE}/webhook/workflow/delete`,
};

// Form URLs for AI extraction nodes
export const N8N_FORM_URLS = [
  { fileType: 'pdf', url: `${N8N_BASE}/form/ai-extraction-pdf` },
  { fileType: 'image', url: `${N8N_BASE}/form/ai-extraction-image` },
  { fileType: 'xlsx', url: `${N8N_BASE}/form/ai-extraction-xlsx` },
  { fileType: 'csv', url: `${N8N_BASE}/form/ai-extraction-csv` }
];

// Initial workflow nodes — empty; user adds nodes via the picker
export const INITIAL_NODES = [];

// Default project template - used only on first load (when no projects exist)
export const DEFAULT_PROJECT_NODES = [
  {
    node_type: "ai_extraction",
    behavior: "ai_form",
    label: "AI Extraction PDF, Spreadsheet, Image",
    title: "Ekstrak Mutasi Bank",
    icon: "🗂️",
    description: "Upload a file and let AI extract structured data from it. File upload is required.",
    n8n_form_urls: [
      { fileType: 'pdf', url: `${N8N_BASE}/form/ai-extraction-pdf` },
      { fileType: 'image', url: `${N8N_BASE}/form/ai-extraction-image` },
      { fileType: 'xlsx', url: `${N8N_BASE}/form/ai-extraction-xlsx` },
      { fileType: 'csv', url: `${N8N_BASE}/form/ai-extraction-csv` }
    ],
    requires_file: true,
    requires_prompt: false,
    requires_table_input: false,
    output_modes: ["create", "overwrite"],
    prompt_label: "Extraction Prompt",
    prompt_placeholder: "e.g. Extract all transactions from this bank statement",
    table_name_label: "Output Table Name",
    table_name_hint: "Name this table to reference it in downstream nodes.",
    tableOutput: { mode: "create", name: "Mutasi Bank" }
  },
  {
    node_type: "ai_extraction",
    behavior: "ai_form",
    label: "AI Extraction PDF, Spreadsheet, Image",
    title: "Ekstrak Data Penjualan",
    icon: "🗂️",
    description: "Upload a file and let AI extract structured data from it. File upload is required.",
    n8n_form_urls: [
      { fileType: 'pdf', url: `${N8N_BASE}/form/ai-extraction-pdf` },
      { fileType: 'image', url: `${N8N_BASE}/form/ai-extraction-image` },
      { fileType: 'xlsx', url: `${N8N_BASE}/form/ai-extraction-xlsx` },
      { fileType: 'csv', url: `${N8N_BASE}/form/ai-extraction-csv` }
    ],
    requires_file: true,
    requires_prompt: false,
    requires_table_input: false,
    output_modes: ["create", "overwrite"],
    prompt_label: "Extraction Prompt",
    prompt_placeholder: "e.g. Extract all transactions from this bank statement",
    table_name_label: "Output Table Name",
    table_name_hint: "Name this table to reference it in downstream nodes.",
    tableOutput: { mode: "create", name: "Data Penjualan" }
  },
  {
    node_type: "ai_transformation",
    behavior: "ai_go",
    label: "AI Transformation",
    title: "Reconcile Mutasi vs Penjualan",
    icon: "✨",
    description: "Apply an AI transformation to an upstream table using a text prompt. No file upload needed.",
    requires_file: false,
    requires_prompt: true,
    requires_table_input: true,
    output_modes: ["create", "overwrite"],
    prompt_label: "Transformation Prompt",
    prompt_placeholder: "e.g. Normalize all dates to YYYY-MM-DD, remove duplicate rows",
    table_name_label: "Output Table Name",
    table_name_hint: "Name this table to reference it in downstream nodes.",
    tableOutput: { mode: "create", name: "Reconciled Data" }
  },
  {
    node_type: "export_excel",
    behavior: "basic_export",
    label: "Export to Excel",
    title: "Export to Excel",
    icon: "📤",
    description: "Export a table to a .xlsx file.",
    requires_file: false,
    requires_prompt: false,
    requires_table_input: true,
    output_modes: ["create"],
    table_name_label: "Source Table Name",
    table_name_hint: "Enter the name of the table to export. Must match the output table name from the upstream node.",
    tableOutput: null,
    settings: {
      processing: {
        file_name: "Hasil Export Gruntable.xlsx"
      }
    }
  },
  {
    node_type: "code",
    behavior: "basic_go",
    label: "Code",
    title: "Transform Data",
    icon: "📝",
    description: "Execute custom JavaScript code with access to Gruntable tables and external API calls.",
    requires_file: false,
    requires_prompt: false,
    requires_table_input: false,
    max_input_tables: 5,
    output_modes: ["create", "overwrite"],
    table_name_label: "Output Table Name",
    table_name_hint: "Name this table to store code output.",
    tableOutput: { mode: "create", name: "Code Output" },
    settings: {
      processing: {
        jsCode: `// Access input table using $table()
const input = $table('Input Table Name');

// Transform data - modify rows here
const output = input.rows.map(row => ({
  // Add your transformation logic here
  ...row
}));

// Return result with $table (for downstream) and $frontend (for display)
return {
  $table: {
    columns: input.columns,
    rows: output
  },
  $frontend: {
    status: 'ok',
    processed: output.length
  }
};`
      }
    }
  }
];

// Default prompts for the default project template (matched by node index)
export const DEFAULT_NODE_PROMPTS = [
  "Ekstrak Mutasi Bank menjadi kolom-kolom berikut:\n- Tanggal\n- Keterangan\n- Debit\n- Kredit\n- Saldo",
  "Ekstrak data penjualan menjadi kolom-kolom berikut:\n- Tanggal\n- Nomor transaksi penjualan\n- Nama pembeli\n- Jumlah gross\n- Jumlah net",
  "Bandingkan data mutasi bank dan penjualan. Cari pasangannya untuk transaksi bank dan penjualan. Output: data mutasi bank ditambah satu kolom \"Nomor Transaksi Penjualan\".",
  "Hasil Export Gruntable.xlsx",
  "" // Code node - user fills in their own JS
];
