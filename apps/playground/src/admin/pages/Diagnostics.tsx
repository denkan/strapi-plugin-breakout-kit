import { Badge, Box, Flex, Main, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';

// ONLY the plugin's public entry is imported here. In dev, app-source imports of
// @strapi/content-manager (entry or deep files) would pull the CM graph out of the
// Vite dep prebundle and split module singletons — the plugin's prebundled
// accessDiagnostics export carries every probe instead.
import { accessDiagnostics } from 'strapi-plugin-breakout-kit/strapi-admin';

interface Check {
  id: string;
  label: string;
  ok: boolean;
}

const isFn = (value: unknown) => typeof value === 'function';
const isObj = (value: unknown) => typeof value === 'object' && value !== null;
const isRenderable = (value: unknown) => isFn(value) || isObj(value);

const { refs } = accessDiagnostics;

const staticChecks: Check[] = [
  // Strategy 1: public exports
  { id: 'public-use-document', label: 'public: unstable_useDocument', ok: isFn(refs.useStrapiDocument) },
  { id: 'public-use-document-actions', label: 'public: unstable_useDocumentActions', ok: isFn(refs.useStrapiDocumentActions) },
  { id: 'public-use-document-layout', label: 'public: unstable_useDocumentLayout', ok: isFn(refs.useStrapiDocumentLayout) },
  { id: 'public-document-rbac', label: 'public: DocumentRBAC provider', ok: isFn(refs.DocumentRBAC) },
  { id: 'public-use-document-rbac', label: 'public: useDocumentRBAC', ok: isFn(refs.useDocumentRBAC) },
  { id: 'public-build-valid-params', label: 'public: buildValidParams', ok: isFn(refs.buildValidParams) },
  { id: 'public-document-status', label: 'public: DocumentStatus', ok: isFn(refs.DocumentStatus) },
  { id: 'public-form', label: 'shell: Form', ok: isRenderable(refs.Form) },
  { id: 'public-admin-api', label: 'shell: adminApi', ok: isObj(refs.adminApi) },
  { id: 'public-dcr', label: 'shell: DescriptionComponentRenderer', ok: isFn(refs.DescriptionComponentRenderer) },

  // Strategy 3: deep imports through the Vite helper
  { id: 'deep-input-renderer', label: 'deep: InputRenderer', ok: isRenderable(refs.InputRenderer) },
  { id: 'deep-form-layout', label: 'deep: FormLayout', ok: isRenderable(refs.FormLayout) },
  { id: 'deep-document-actions', label: 'deep: DocumentActions renderers', ok: isFn(refs.DocumentActions) && isFn(refs.DocumentActionButton) },
  { id: 'deep-transform-document', label: 'deep: transformDocument', ok: isFn(refs.transformDocument) },
  { id: 'deep-create-default-form', label: 'deep: createDefaultForm', ok: isFn(refs.createDefaultForm) },
  { id: 'deep-create-yup-schema', label: 'deep: createYupSchema', ok: isFn(refs.createYupSchema) },
  { id: 'deep-use-content-type-schema', label: 'deep: useContentTypeSchema', ok: isFn(refs.useContentTypeSchema) },
  { id: 'deep-use-lazy-components', label: 'deep: useLazyComponents', ok: isFn(refs.useLazyComponents) },

  // The alias-replace shim + module identity
  { id: 'shim-active', label: 'shim: useDocumentContext replaced', ok: accessDiagnostics.headlessShimActive },
  { id: 'singleton-document-rbac', label: 'singleton: deep import === public export', ok: accessDiagnostics.singletonOk },
];

/** Live check: CM's schema hook works outside the content-manager routes. */
const SchemaProbe = () => {
  const { schema, components, isLoading } = refs.useContentTypeSchema('api::article.article');
  const ok = !isLoading && isObj(schema);
  return (
    <CheckRow
      check={{
        id: 'live-schema',
        label: `live: useContentTypeSchema(api::article.article)${isLoading ? ' (loading…)' : ''} — ${Object.keys(components ?? {}).length} components`,
        ok,
      }}
      pending={isLoading}
    />
  );
};

const CheckRow = ({ check, pending = false }: { check: Check; pending?: boolean }) => (
  <Tr>
    <Td>
      <Typography textColor="neutral800">{check.label}</Typography>
    </Td>
    <Td>
      <Badge
        data-testid={`access-check-${check.id}`}
        data-status={pending ? 'pending' : check.ok ? 'pass' : 'fail'}
        backgroundColor={pending ? 'neutral150' : check.ok ? 'success100' : 'danger100'}
        textColor={pending ? 'neutral600' : check.ok ? 'success700' : 'danger700'}
      >
        {pending ? 'PENDING' : check.ok ? 'PASS' : 'FAIL'}
      </Badge>
    </Td>
  </Tr>
);

const Diagnostics = () => {
  const failures = staticChecks.filter((check) => !check.ok).length;
  const StatusBadge = refs.DocumentStatus;

  return (
    <Main>
      <Box padding={8}>
        <Flex direction="column" alignItems="flex-start" gap={4}>
          <Typography variant="alpha" tag="h1">
            Breakout Kit — access layer diagnostics
          </Typography>
          <Typography
            variant="epsilon"
            data-testid="access-summary"
            data-failures={failures}
            textColor={failures === 0 ? 'success700' : 'danger700'}
          >
            {failures === 0
              ? `All ${staticChecks.length} static checks pass`
              : `${failures} of ${staticChecks.length} static checks failing`}
          </Typography>
          <Box width="100%">
            <Table colCount={2} rowCount={staticChecks.length + 1}>
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma">Adapter</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Status</Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {staticChecks.map((check) => (
                  <CheckRow key={check.id} check={check} />
                ))}
                <SchemaProbe />
              </Tbody>
            </Table>
          </Box>
          <Flex gap={2}>
            <Typography textColor="neutral600">Render check (DocumentStatus):</Typography>
            <StatusBadge status="draft" />
            <StatusBadge status="published" />
          </Flex>
        </Flex>
      </Box>
    </Main>
  );
};

export { Diagnostics };
