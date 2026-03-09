// ─────────────────────────────────────────────
// NODE CATALOGUE — MVP-1 node set
// Node Types: AI Form, AI Go, Basic Export, AI Export
// PRD: prd/nodes.md
// ─────────────────────────────────────────────
import { N8N_BASE } from "../../../config.js";

export const NODE_CATALOGUE = [
  // ── AI Extraction ──────────────────────────
  // behavior: "ai_form" — Has form UI (file upload), pauses for input, then QC
  {
    node_type: "ai_extraction",
    label: "AI Extraction PDF, Spreadsheet, Image",
    behavior: "ai_form",
    category: "AI",
    icon: "🗂️",
    desc: "Upload a file and let AI extract structured data from it. File upload is required.",
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
    default_table_name: "AI Extraction Output",
    file_type: "pdf",
    file_type_options: [
      { value: "pdf", label: "PDF" },
      { value: "spreadsheet", label: "Spreadsheet (XLSX, CSV)" },
      { value: "image", label: "Image (PNG, JPG, JPEG)" }
    ],
    sheet_name: "",
  },

  // ── AI Transformation ──────────────────────
  // behavior: "ai_go" — Auto-triggers via webhook, runs AI, then pauses for QC
  {
    node_type: "ai_transformation",
    label: "AI Transformation",
    behavior: "ai_go",
    category: "AI",
    icon: "✨",
    desc: "Apply an AI transformation to an upstream table using a text prompt. No file upload needed.",
    requires_file: false,
    requires_prompt: true,
    requires_table_input: true,
    output_modes: ["create", "overwrite"],
    prompt_label: "Transformation Prompt",
    prompt_placeholder: "e.g. Normalize all dates to YYYY-MM-DD, remove duplicate rows",
    table_name_label: "Output Table Name",
    table_name_hint: "Name this table to reference it in downstream nodes.",
    default_table_name: "AI Transformation Output",
  },

  // ── Export to Excel ─────────────────────────
  // behavior: "basic_export" — Auto-triggers via webhook, downloads file, no QC
  {
    node_type: "export_excel",
    label: "Export to Excel",
    behavior: "basic_export",
    category: "Export",
    icon: "📤",
    desc: "Export a table to a .xlsx file.",
    requires_file: false,
    requires_prompt: false,
    requires_table_input: true,
    table_name_label: "Source Table Name",
    table_name_hint: "Enter the name of the table to export. Must match the output table name from the upstream node.",
    default_table_name: "",
  },

  // ── AI Export ───────────────────────────────
  // behavior: "ai_export" — Auto-triggers via webhook, AI generates output, downloads file, no QC
  {
    node_type: "ai_export",
    label: "AI Export to JSON & XML",
    behavior: "ai_export",
    category: "Export",
    icon: "📤✨",
    desc: "Use AI to export a table to JSON or XML format. You provide a prompt describing the desired output structure.",
    requires_file: false,
    requires_prompt: true,
    requires_table_input: true,
    output_format_options: [
      { value: "json", label: "JSON" },
      { value: "xml", label: "XML" }
    ],
    default_output_format: "json",
    prompt_label: "Export Prompt",
    prompt_placeholder: "e.g. Export as nested JSON with 'records' as root array",
    table_name_label: "Source Table Name",
    table_name_hint: "Enter the name of the table to export. Must match the output table name from the upstream node.",
    default_table_name: "",
    default_prompt_json: `Export the upstream table to nested JSON with this structure:
{
  "metadata": {
    "totalRecords": "<auto-calculated from table>",
    "sourceTable": "<table name from Table Source>",
    "exportedAt": "<current timestamp>"
  },
  "records": [
    {
      "id": "<value from id column>",
      "name": "<value from name column>",
      "amount": <value from amount column>,
      "details": {
        "category": "<value from category column>",
        "date": "<value from date column>",
        "status": "<value from status column>"
      }
    }
  ]
}
Keep all original columns from the upstream table. Use appropriate data types for numbers and booleans.`,
    default_prompt_xml: `Convert the upstream table to XML with this structure:
<?xml version="1.0" encoding="UTF-8"?>
<root>
  <metadata>
    <totalRecords>100</totalRecords>
    <sourceTable>table_name</sourceTable>
    <exportedAt>2026-03-08T10:00:00Z</exportedAt>
  </metadata>
  <records>
    <record id="1">
      <name>Sample Name</name>
      <amount>1000</amount>
      <details>
        <category>Category A</category>
        <date>2026-01-15</date>
        <status>active</status>
      </details>
    </record>
  </records>
</root>
Keep all original columns from the upstream table as XML elements. Use attributes for key fields like id.`,
  },
];
