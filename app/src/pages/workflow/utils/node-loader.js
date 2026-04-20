// ─────────────────────────────────────────────
// NODE REGISTRY — built from manifest.json files
// Each node folder under app/src/nodes/ is auto-discovered at build time.
// To add a new node: drop a folder with manifest.json into app/src/nodes/.
// ─────────────────────────────────────────────
import { N8N_BASE } from "../../../config.js";

// Vite resolves this glob at build time — no server-side scanning needed.
// Path is relative from this file (features/workspace/nodes/) to nodes/.
const manifests = import.meta.glob("../../../nodes/*/manifest.json", {
  eager: true,
});

export const NODE_REGISTRY = {};

for (const [, module] of Object.entries(manifests)) {
  const manifest = module.default || module;

  // Build n8n_form_urls for backward compat with RunTab (mirrors catalogue.js shape)
  const n8nFormUrls = (manifest.n8n_workflows || [])
    .filter((w) => w.trigger_type === "form")
    .map((w) => ({
      fileType: w.file_type_filter || null,
      url: `${N8N_BASE}${w.trigger_path}`,
    }));

  NODE_REGISTRY[manifest.node_type] = {
    ...manifest,
    // Compat fields that consumers read from catalogue entries
    n8n_form_urls: n8nFormUrls.length > 0 ? n8nFormUrls : null,
    default_table_name: manifest.defaults?.table_name ?? "",
    prompt_label: manifest.ui?.prompt_label ?? "",
    prompt_placeholder: manifest.ui?.prompt_placeholder ?? "",
    table_name_label: manifest.ui?.table_name_label ?? "",
    table_name_hint: manifest.ui?.table_name_hint ?? "",
    file_type_options: manifest.ui?.file_type_options ?? null,
    extraction_mode_options: manifest.ui?.extraction_mode_options ?? null,
    output_format_options: manifest.ui?.output_format_options ?? null,
    default_output_format: manifest.defaults?.output_format ?? null,
    default_prompt_json: manifest.ui?.default_prompt_json ?? null,
    default_prompt_xml: manifest.ui?.default_prompt_xml ?? null,
    file_type: manifest.defaults?.file_type ?? null,
    extraction_mode: manifest.defaults?.extraction_mode ?? null,
    sheet_name: "",
    output_modes: manifest.table_output_mode && manifest.table_output_mode !== "none" ? ["create", "overwrite"] : [],
    conflict_modes: manifest.table_output_mode && manifest.table_output_mode !== "none" ? ["overwrite", "append"] : [],
  };
}

// Ordered list — preserves file system discovery order.
// NodePicker uses this for display ordering.
export const NODE_REGISTRY_LIST = Object.values(NODE_REGISTRY);
