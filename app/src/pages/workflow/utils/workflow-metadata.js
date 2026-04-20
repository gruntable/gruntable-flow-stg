import { INITIAL_NODES, DEFAULT_PROJECT_NODES, DEFAULT_NODE_PROMPTS, N8N_BASE } from "../../../config.js";
import { NODE_REGISTRY } from "./node-loader.js";

export const METADATA_STORAGE_KEY = "gruntable-flow-mvp1-workflow-metadata";
export const METADATA_VERSION = "1.2";

export const WORKFLOW_PLATFORMS = [
  { value: "excel",      label: "Excel" },
  { value: "accurate",   label: "Accurate" },
  { value: "jurnal",     label: "Jurnal (Mekari)" },
  { value: "zahir",      label: "Zahir Accounting" },
  { value: "kledo",      label: "Kledo" },
  { value: "harmony",    label: "Harmony" },
  { value: "paper_id",   label: "Paper.id" },
  { value: "odoo",       label: "Odoo" },
  { value: "efaktur",    label: "eFaktur (DJP)" },
  { value: "netsuite",   label: "Oracle NetSuite" },
  { value: "sap",        label: "SAP" },
];

export const INPUT_METHODS = [
  { value: "manual_import",    label: "Manual Import",    icon: "👆" },
  { value: "direct_api_input", label: "Direct API Input", icon: "⚡" },
];

export const BLANK_TABLE = () => ({
  headers: ["Column 1", "Column 2", "Column 3"],
  rows: [["", "", ""], ["", "", ""]],
});

export const makeId = (prefix) =>
  `${prefix}_${Date.now().toString(36)}`;

export const cloneInitialNodes = () =>
  INITIAL_NODES.map((node) => ({
    ...node,
    title: node.title ?? node.label,
    tableOutput: node.tableOutput ? { ...node.tableOutput } : null,
  }));

export const cloneDefaultNodes = () => {
  // Generate unique IDs immediately to avoid collision issues
  const usedIds = new Set();
  const nodes = DEFAULT_PROJECT_NODES.map((node) => {
    let id = makeId("node");
    while (usedIds.has(id)) {
      id = makeId("node");
    }
    usedIds.add(id);
    return {
      ...node,
      id,
      title: node.title ?? node.label,
      tableOutput: node.tableOutput ? { ...node.tableOutput } : null,
    };
  });
  
  // Build nodePrompts from DEFAULT_NODE_PROMPTS by matching node index
  const nodePrompts = {};
  nodes.forEach((node, idx) => {
    if (DEFAULT_NODE_PROMPTS[idx]) {
      nodePrompts[node.id] = DEFAULT_NODE_PROMPTS[idx];
    }
  });
  
  // Set source table for transformation node (3rd node, index 2)
  const nodeSourceTables = {};
  if (nodes.length >= 3) {
    nodeSourceTables[nodes[2].id] = [nodes[0].tableOutput?.name];
  }
  
  return { nodes, nodePrompts, nodeSourceTables };
};

export const createWorkflow = (name = "New Workflow", nodesOverride = null) => {
  let nodes, nodePrompts, nodeSourceTables;

  if (nodesOverride !== null) {
    nodes = nodesOverride;
    nodePrompts = {};
    nodeSourceTables = {};
  } else {
    const result = cloneDefaultNodes();
    nodes = result.nodes;
    nodePrompts = result.nodePrompts;
    nodeSourceTables = result.nodeSourceTables;
  }

  return {
    id: crypto.randomUUID(),
    name,
    editMode: true,
    platform: null,
    platform_input_method: null,
    nodes,
    tableNames: Object.fromEntries(nodes.map((node) => [node.id, node.tableOutput?.name ?? ""])),
    nodePrompts,
    nodeSourceTables,
  };
};

export const normalizeName = (name, fallback) => {
  const safe = typeof name === "string" ? name.trim() : "";
  return safe || fallback;
};

export const cleanStringMap = (value) => {
  if (!value || typeof value !== "object") return {};
  const out = {};
  Object.entries(value).forEach(([k, v]) => {
    // Coerce to string to handle corrupted data (numbers, booleans, etc.)
    if (v != null) out[k] = String(v);
  });
  return out;
};

export const cleanSourceTablesMap = (value) => {
  if (!value || typeof value !== "object") return {};
  const out = {};
  Object.entries(value).forEach(([k, v]) => {
    if (typeof v === "string") {
      out[k] = v;
    } else if (Array.isArray(v)) {
      // Filter and coerce array items to strings
      out[k] = v.map(item => item != null ? String(item) : "").filter(Boolean);
    } else if (v != null) {
      // Coerce non-array, non-string values to string
      out[k] = String(v);
    }
  });
  return out;
};

export const normalizeNodes = (nodes) => {
  const safeNodes = Array.isArray(nodes) ? nodes.filter(Boolean) : [];
  const uniqueIds = new Set();

  return safeNodes.map((rawNode, idx) => {
      const behavior = typeof rawNode.behavior === "string" ? rawNode.behavior : "interactive";

      let id = typeof rawNode.id === "string" && rawNode.id.trim() ? rawNode.id : makeId("node");
      while (uniqueIds.has(id)) id = makeId("node");
      uniqueIds.add(id);

      const normalizedLabel = normalizeName(rawNode.label, `Node ${idx + 1}`);
      return {
        ...rawNode,
        id,
        behavior,
        node_type: typeof rawNode.node_type === "string" && rawNode.node_type.trim() ? rawNode.node_type : "custom",
        label: normalizedLabel,
        title: typeof rawNode.title === "string" && rawNode.title.trim() ? rawNode.title : normalizedLabel,
        tableOutput: (NODE_REGISTRY[rawNode.node_type]?.is_export ??
            (behavior === "basic_export" || behavior === "ai_export" || behavior === "export"))
          ? null
          : (rawNode.tableOutput ? { ...rawNode.tableOutput } : { mode: "create", name: "" }),
      };
    });
};

export const normalizeWorkflow = (rawProject, idx) => {
  const nodes = normalizeNodes(rawProject?.nodes);
  const fallbackName = `Workflow ${idx + 1}`;
  const isValidUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
  const id = (typeof rawProject?.id === "string" && isValidUUID(rawProject.id)) ? rawProject.id : crypto.randomUUID();
  const name = normalizeName(rawProject?.name, fallbackName);

  const nodeOutputNames = Object.fromEntries(nodes.map((node) => [node.id, node.tableOutput?.name ?? ""]));
  const tableNames = { ...nodeOutputNames, ...cleanStringMap(rawProject?.tableNames) };

  // Rebuild nodePrompts: start with existing prompts, then add defaults by node index
  const nodePrompts = { ...cleanStringMap(rawProject?.nodePrompts) };
  nodes.forEach((node, nodeIdx) => {
    const manifest = NODE_REGISTRY[node.node_type];
    if (DEFAULT_NODE_PROMPTS[nodeIdx] && !nodePrompts[node.id]?.trim() && manifest?.requires_prompt) {
      nodePrompts[node.id] = DEFAULT_NODE_PROMPTS[nodeIdx];
    }
  });

  // Rebuild nodeSourceTables: start with existing, then add defaults by node index
  const nodeSourceTables = { ...cleanSourceTablesMap(rawProject?.nodeSourceTables) };
  nodes.forEach((node, nodeIdx) => {
    // For default template transformation node (index 2), set source to first node's table
    if (nodeIdx === 2 && nodes[0]?.tableOutput?.name && !nodeSourceTables[node.id]) {
      nodeSourceTables[node.id] = [nodes[0].tableOutput.name];
    }
  });

  // Set default settings for export node (index 3) if not present
  if (nodes[3] && !nodes[3].settings?.processing?.file_name) {
    nodes[3] = {
      ...nodes[3],
      settings: {
        ...nodes[3].settings,
        processing: {
          ...nodes[3].settings?.processing,
          file_name: "Hasil Export Gruntable.xlsx"
        }
      }
    };
  }

  return {
    id,
    name,
    editMode: rawProject?.editMode ?? true,
    platform: rawProject?.platform ?? null,
    platform_input_method: rawProject?.platform_input_method ?? null,
    nodes,
    tableNames,
    nodePrompts,
    nodeSourceTables,
  };
};

export const normalizeWorkflowMetadata = (raw) => {
  // Support both new key (workflows) and legacy key (projects) for migration
  const inputWorkflows = Array.isArray(raw?.workflows) ? raw.workflows
    : Array.isArray(raw?.projects) ? raw.projects
    : [];
  const normalizedWorkflows = inputWorkflows.map((workflow, idx) => normalizeWorkflow(workflow, idx));
  const workflows = normalizedWorkflows.length ? normalizedWorkflows : [createWorkflow("New Workflow")];

  const idSet = new Set();
  const dedupedWorkflows = workflows.map((workflow) => {
    let id = workflow.id;
    while (idSet.has(id)) id = crypto.randomUUID();
    idSet.add(id);
    return id === workflow.id ? workflow : { ...workflow, id };
  });

  // Support both new key (activeWorkflowId) and legacy key (activeProjectId) for migration
  const rawActiveId = raw?.activeWorkflowId ?? raw?.activeProjectId;
  const activeWorkflowId = (typeof rawActiveId === "string" && dedupedWorkflows.some((w) => w.id === rawActiveId))
    ? rawActiveId
    : dedupedWorkflows[0].id;

  return {
    version: METADATA_VERSION,
    activeWorkflowId,
    workflows: dedupedWorkflows,
  };
};

export const serializeWorkflowMetadata = (workflows, activeWorkflowId) => ({
  version: METADATA_VERSION,
  activeWorkflowId,
  workflows,
});

export const loadWorkflowMetadata = () => {
  if (typeof window === "undefined") return normalizeWorkflowMetadata(null);
  try {
    const raw = window.localStorage.getItem(METADATA_STORAGE_KEY);
    if (!raw) return normalizeWorkflowMetadata(null);
    return normalizeWorkflowMetadata(JSON.parse(raw));
  } catch {
    return normalizeWorkflowMetadata(null);
  }
};



const normalizeN8NFormUrls = (n8nFormUrls) => {
  if (!Array.isArray(n8nFormUrls)) return n8nFormUrls;
  
  const hasSpreadsheet = n8nFormUrls.some(u => u?.fileType === 'spreadsheet');
  if (!hasSpreadsheet) return n8nFormUrls;

  return n8nFormUrls.flatMap(u => {
    if (u?.fileType === 'spreadsheet') {
      return [
        { fileType: 'xlsx', url: u.url?.replace('/form/ai-extraction-spreadsheet', '/form/ai-extraction-xlsx') || `${N8N_BASE}/form/ai-extraction-xlsx` },
        { fileType: 'csv', url: u.url?.replace('/form/ai-extraction-spreadsheet', '/form/ai-extraction-csv') || `${N8N_BASE}/form/ai-extraction-csv` },
      ];
    }
    return u;
  });
};
export const convertNodesToOrchestratorFormat = (nodes, tableNames, nodePrompts, nodeSourceTables, allTables = []) => {
  const result = nodes.map((node, index) => {
    const manifest = NODE_REGISTRY[node.node_type];
    const outputName = tableNames[node.id] || `${node.label} Output`;
    const prevNode = index > 0 ? nodes[index - 1] : null;
    const inputName = prevNode ? (tableNames[prevNode.id] || prevNode.label) : '';

    // Source tables (unified: always an array for all requires_table_input nodes)
    let sourceTableNames = null;
    if (manifest?.requires_table_input) {
      const stored = nodeSourceTables[node.id];
      console.log(`[WF-META] Node "${node.label}" - nodeSourceTables[${node.id}]:`, stored);
      if (Array.isArray(stored)) {
        sourceTableNames = stored.filter(t => t && t.trim());
      } else if (typeof stored === 'string' && stored.startsWith('[')) {
        try {
          sourceTableNames = JSON.parse(stored).filter(t => t && t.trim());
        } catch {
          sourceTableNames = stored ? [stored] : [];
        }
      } else if (typeof stored === 'string' && stored.trim()) {
        sourceTableNames = [stored.trim()];
      }
      console.log(`[WF-META] Parsed source_table_names for "${node.label}":`, sourceTableNames);
    }

    // Text node: pass markdown content to n8n for HTML rendering
    let textSettings = null;
    if (node.node_type === 'display_text') {
      textSettings = {
        content: node.settings?.text?.content || '',
      };
    }

    // Code node: JS code + source table names (code manages its own source table list)
    let codeSettings = null;
    if (node.node_type === 'code') {
      const proc = node.settings?.processing || {};
      const stored = nodeSourceTables[node.id];
      let codeSourceTableNames = [];
      if (Array.isArray(stored)) {
        codeSourceTableNames = stored.filter(t => t && t.trim());
      } else if (typeof stored === 'string' && stored.trim()) {
        codeSourceTableNames = [stored.trim()];
      }
      codeSettings = {
        jsCode: proc.jsCode || '',
        sourceTableNames: codeSourceTableNames,
      };
    }

    const isExport = manifest?.is_export ?? false;
    const isAiExport = manifest?.behavior === 'ai_export';
    const aiExportFormat = node.settings?.processing?.outputFormat || manifest?.defaults?.output_format || 'json';
    const aiExportExt = aiExportFormat === 'xml' ? '.xml' : '.json';
    const defaultFileName = isAiExport ? `output${aiExportExt}` : 'export.xlsx';
    const conflictMode = node.tableOutput?.conflictMode || 'overwrite';

    // webhook_url: derived from manifest so orchestrator needs no hardcoded URLs
    const webhookWorkflow = manifest?.n8n_workflows?.find(w => w.trigger_type === 'webhook');
    const webhookUrl = webhookWorkflow ? `${N8N_BASE}${webhookWorkflow.trigger_path}` : null;

    return {
      node_id: node.id,
      node_type: node.node_type,
      label: node.label,
      behavior: manifest?.behavior || node.behavior || '',
      output_name: outputName,
      prompt: manifest?.requires_prompt ? (nodePrompts[node.id] || '') : undefined,
      input_name: inputName,
      webhook_url: webhookUrl,
      source_table_names: sourceTableNames,
      pauseForReview: node.settings?.processing?.pauseForReview ?? node.pauseForReview ?? true,
      fileName: isExport
        ? (node.settings?.processing?.file_name || nodePrompts?.[node.id] || defaultFileName)
        : undefined,
      output_format: isAiExport ? aiExportFormat : undefined,
      n8n_form_urls: normalizeN8NFormUrls(node.n8n_form_urls) || null,
      extraction_mode: node.node_type === 'ai_extraction'
        ? (node.settings?.processing?.extractionMode || node.extraction_mode || 'per_page')
        : undefined,
      conflict_mode: conflictMode,
      code_settings: codeSettings,
      text_settings: textSettings,
    };
  });

  console.log('[WF-META] convertNodesToOrchestratorFormat - sending to orchestrator:', JSON.stringify(result, null, 2));
  return result;
};
