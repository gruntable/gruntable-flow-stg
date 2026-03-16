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

// Form URLs for AI extraction nodes
export const N8N_FORM_URLS = [
  { fileType: 'pdf', url: `${N8N_BASE}/form/ai-extraction-pdf` },
  { fileType: 'image', url: `${N8N_BASE}/form/ai-extraction-image` },
  { fileType: 'spreadsheet', url: `${N8N_BASE}/form/ai-extraction-spreadsheet` }
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
      { fileType: 'spreadsheet', url: `${N8N_BASE}/form/ai-extraction-spreadsheet` }
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
      { fileType: 'spreadsheet', url: `${N8N_BASE}/form/ai-extraction-spreadsheet` }
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
  }
];

// Default prompts for the default project template (matched by node index)
export const DEFAULT_NODE_PROMPTS = [
  "Ekstrak Mutasi Bank menjadi kolom-kolom berikut:\n- Tanggal\n- Keterangan\n- Debit\n- Kredit\n- Saldo",
  "Ekstrak data penjualan menjadi kolom-kolom berikut:\n- Tanggal\n- Nomor transaksi penjualan\n- Nama pembeli\n- Jumlah gross\n- Jumlah net",
  "Bandingkan data mutasi bank dan penjualan. Cari pasangannya untuk transaksi bank dan penjualan. Output: data mutasi bank ditambah satu kolom \"Nomor Transaksi Penjualan\".",
  "Hasil Export Gruntable.xlsx"
];
