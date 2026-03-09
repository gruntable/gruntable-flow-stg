import { INITIAL_NODES, DEFAULT_PROJECT_NODES, DEFAULT_NODE_PROMPTS } from "../../../config.js";

export const METADATA_STORAGE_KEY = "gruntable-flow-mvp1-workflow-metadata";
export const METADATA_VERSION = "1.1";

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

export const createProject = (name = "New Workflow", nodesOverride = null) => {
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
    id: makeId("project"),
    name,
    editMode: true,
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
    if (typeof v === "string") out[k] = v;
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
      out[k] = v;
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
        tableOutput: behavior === "basic_export" || behavior === "ai_export" || behavior === "export"
          ? null
          : (rawNode.tableOutput ? { ...rawNode.tableOutput } : { mode: "create", name: "" }),
      };
    });
};

export const normalizeProject = (rawProject, idx) => {
  const nodes = normalizeNodes(rawProject?.nodes);
  const fallbackName = `Flow Project ${idx + 1}`;
  const id = typeof rawProject?.id === "string" && rawProject.id.trim() ? rawProject.id : makeId("project");
  const name = normalizeName(rawProject?.name, fallbackName);

  const nodeOutputNames = Object.fromEntries(nodes.map((node) => [node.id, node.tableOutput?.name ?? ""]));
  const tableNames = { ...nodeOutputNames, ...cleanStringMap(rawProject?.tableNames) };

  // Rebuild nodePrompts: start with existing prompts, then add defaults by node index
  const nodePrompts = { ...cleanStringMap(rawProject?.nodePrompts) };
  nodes.forEach((node, nodeIdx) => {
    if (DEFAULT_NODE_PROMPTS[nodeIdx] && !nodePrompts[node.id]?.trim()) {
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
    editMode: rawProject?.editMode === false ? false : true,
    nodes,
    tableNames,
    nodePrompts,
    nodeSourceTables,
  };
};

export const normalizeWorkflowMetadata = (raw) => {
  const inputProjects = Array.isArray(raw?.projects) ? raw.projects : [];
  const normalizedProjects = inputProjects.map((project, idx) => normalizeProject(project, idx));
  const projects = normalizedProjects.length ? normalizedProjects : [createProject("New Workflow")];

  const idSet = new Set();
  const dedupedProjects = projects.map((project) => {
    let id = project.id;
    while (idSet.has(id)) id = makeId("project");
    idSet.add(id);
    return id === project.id ? project : { ...project, id };
  });

  const activeProjectId = (typeof raw?.activeProjectId === "string" && dedupedProjects.some((project) => project.id === raw.activeProjectId))
    ? raw.activeProjectId
    : dedupedProjects[0].id;

  return {
    version: METADATA_VERSION,
    activeProjectId,
    projects: dedupedProjects,
  };
};

export const serializeWorkflowMetadata = (projects, activeProjectId) => ({
  version: METADATA_VERSION,
  activeProjectId,
  projects,
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

export const convertNodesToOrchestratorFormat = (nodes, tableNames, nodePrompts, nodeSourceTables) => {
  const result = nodes
    .map((node, index) => {
      const outputName = (tableNames[node.id] || `${node.label} Output`).replace(/\s+/g, '_');
      const prevNode = index > 0 ? nodes[index - 1] : null;
      const inputName = prevNode ? (tableNames[prevNode.id] || prevNode.label).replace(/\s+/g, '_') : '';

      let sourceTableNames = null;
      if (node.node_type === 'ai_transformation') {
        const stored = nodeSourceTables[node.id];
        console.log(`[WF-META] AI Transformation node "${node.label}" - nodeSourceTables[${node.id}]:`, stored);
        if (Array.isArray(stored)) {
          sourceTableNames = stored.filter(t => t && t.trim());
        } else if (typeof stored === 'string' && stored.startsWith('[')) {
          try {
            sourceTableNames = JSON.parse(stored).filter(t => t && t.trim());
          } catch {
            sourceTableNames = stored ? [stored] : [];
          }
        } else if (stored) {
          sourceTableNames = [stored];
        }
        console.log(`[WF-META] Parsed source_table_names for "${node.label}":`, sourceTableNames);
      }

      const isAiExport = node.behavior === 'ai_export';
      const aiExportFormat = node.settings?.processing?.outputFormat || node.default_output_format || 'json';
      const aiExportExt = aiExportFormat === 'xml' ? '.xml' : '.json';
      
      return {
        node_id: node.id,
        node_type: node.node_type,
        label: node.label,
        output_name: outputName,
        prompt: nodePrompts[node.id] || '',
        input_name: inputName,
        source_table_names: sourceTableNames,
        file_name: (node.behavior === 'basic_export' || isAiExport || node.behavior === 'export')
          ? (node.settings?.processing?.file_name || (isAiExport ? `output${aiExportExt}` : 'export.xlsx'))
          : undefined,
        output_format: isAiExport ? aiExportFormat : undefined,
        // n8n_form_urls intentionally omitted — orchestrator generates URLs with query params
      };
    });

  console.log('[WF-META] convertNodesToOrchestratorFormat - sending to orchestrator:', JSON.stringify(result, null, 2));
  return result;
};
