import { TEMPLATE_ENDPOINTS } from '../../../config.js';

export async function listTemplateRegistry(country = 'Indonesia') {
  const res = await fetch(`${TEMPLATE_ENDPOINTS.REGISTRY}?country=${encodeURIComponent(country)}`);
  if (!res.ok) throw new Error('Failed to load template registry');
  return res.json(); // { collections: [...], templates: [...] }
}
