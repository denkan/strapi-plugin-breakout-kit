/**
 * Fetch helpers for strapi/strapi source at a given tag, via raw.githubusercontent.com
 * (no clone needed). Tags are `v<version>`.
 */

const RAW_BASE = 'https://raw.githubusercontent.com/strapi/strapi';
const API_BASE = 'https://api.github.com/repos/strapi/strapi';

async function fetchWithRetry(url, init, attempts = 4) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, init);
      if (res.status === 404) return { status: 404 };
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return { status: 200, res };
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** i));
    }
  }
  throw lastError;
}

/** Returns the file content at the tag, or null when the file no longer exists. */
export async function fetchFileAtTag(version, filePath) {
  const { status, res } = await fetchWithRetry(`${RAW_BASE}/v${version}/${filePath}`);
  if (status === 404) return null;
  return res.text();
}

/** Resolves the commit sha a version tag points at (best effort; null offline). */
export async function fetchCommitForTag(version) {
  try {
    const { status, res } = await fetchWithRetry(`${API_BASE}/git/ref/tags/v${version}`, {
      headers: { accept: 'application/vnd.github+json' },
    });
    if (status === 404) return null;
    const data = await res.json();
    if (data.object?.type === 'tag') {
      const tag = await fetchWithRetry(data.object.url);
      if (tag.status === 200) return (await tag.res.json()).object?.sha ?? null;
    }
    return data.object?.sha ?? null;
  } catch {
    return null;
  }
}
