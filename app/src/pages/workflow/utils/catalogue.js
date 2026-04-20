// ─────────────────────────────────────────────
// NODE CATALOGUE — compatibility shim
// Node definitions have moved to app/src/nodes/{name}/manifest.json
// This file re-exports the registry list so all existing consumers continue to work.
// ─────────────────────────────────────────────
import { NODE_REGISTRY_LIST } from "./node-loader.js";

export const NODE_CATALOGUE = NODE_REGISTRY_LIST;
