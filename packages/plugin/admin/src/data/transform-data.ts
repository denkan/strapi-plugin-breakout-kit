/**
 * Recursively unwraps `{ apiData }` wrappers that relation inputs store in form values.
 *
 * Vendored from @strapi/content-manager `pages/EditView/components/DocumentActions.tsx`
 * (`transformData`, module-private, ~15 lines) at the manifest's pinned version — the file
 * is hash-tracked as drift/manifest.json#cm-document-actions-renderers.
 */
export function transformDocumentData<T>(data: T): T {
  if (Array.isArray(data)) {
    return data.map((value) => transformDocumentData(value)) as T;
  }
  if (typeof data === 'object' && data !== null) {
    if ('apiData' in data) {
      return (data as { apiData: T }).apiData;
    }
    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, transformDocumentData(value)])
    ) as T;
  }
  return data;
}
