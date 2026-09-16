import { Badge, Box, Flex, Main, Table, Tbody, Td, Th, Thead, Tr, Typography } from '@strapi/design-system';

import * as access from '../access';

/**
 * Access-layer diagnostics page (Phase 2 contract surface).
 *
 * Renders one row per adapter with a pass/fail state that the Playwright contract test
 * asserts. Grouped by strategy: public exports, deep imports (need the Vite helper),
 * the useDocumentContext shim, and live runtime checks against the running admin.
 */

interface Check {
  id: string;
  label: string;
  ok: boolean;
}

const isFn = (value: unknown) => typeof value === 'function';
const isObj = (value: unknown) => typeof value === 'object' && value !== null;

const staticChecks: Check[] = [
  // Strategy 1: public exports
  { id: 'public-use-document', label: 'public: unstable_useDocument', ok: isFn(access.useStrapiDocument) },
  { id: 'public-use-document-actions', label: 'public: unstable_useDocumentActions', ok: isFn(access.useStrapiDocumentActions) },
  { id: 'public-use-document-layout', label: 'public: unstable_useDocumentLayout', ok: isFn(access.useStrapiDocumentLayout) },
  { id: 'public-document-rbac', label: 'public: DocumentRBAC provider', ok: isFn(access.DocumentRBAC) },
  { id: 'public-use-document-rbac', label: 'public: useDocumentRBAC', ok: isFn(access.useDocumentRBAC) },
  { id: 'public-build-valid-params', label: 'public: buildValidParams', ok: isFn(access.buildValidParams) },
  { id: 'public-document-status', label: 'public: DocumentStatus', ok: isFn(access.DocumentStatus) },
  { id: 'public-form', label: 'shell: Form / useForm / useField', ok: isObj(access.Form) || isFn(access.Form) },
  { id: 'public-admin-api', label: 'shell: adminApi', ok: isObj(access.adminApi) },
  { id: 'public-dcr', label: 'shell: DescriptionComponentRenderer', ok: isFn(access.DescriptionComponentRenderer) },

  // Strategy 3: deep imports (resolved by the Vite helper)
  { id: 'deep-input-renderer', label: 'deep: InputRenderer', ok: isObj(access.InputRenderer) || isFn(access.InputRenderer) },
  { id: 'deep-form-layout', label: 'deep: FormLayout', ok: isObj(access.FormLayout) || isFn(access.FormLayout) },
  { id: 'deep-document-actions', label: 'deep: DocumentActions renderers', ok: isFn(access.DocumentActions) && isFn(access.DocumentActionButton) },
  { id: 'deep-transform-document', label: 'deep: transformDocument', ok: isFn(access.transformDocument) },
  { id: 'deep-create-default-form', label: 'deep: createDefaultForm', ok: isFn(access.createDefaultForm) },
  { id: 'deep-create-yup-schema', label: 'deep: createYupSchema', ok: isFn(access.createYupSchema) },
  { id: 'deep-use-content-type-schema', label: 'deep: useContentTypeSchema', ok: isFn(access.useContentTypeSchema) },
  { id: 'deep-use-lazy-components', label: 'deep: useLazyComponents', ok: isFn(access.useLazyComponents) },

  // The alias-replace shim
  { id: 'shim-active', label: 'shim: useDocumentContext replaced', ok: access.__headlessShim === true },

  // Module identity: deep-imported module === public export instance
  {
    id: 'singleton-document-rbac',
    label: 'singleton: deep import === public export',
    ok: access.__singletonProbe.useDocumentRBACViaDeepImport === access.useDocumentRBAC,
  },
];

/** Live check: CM's schema hook works outside the content-manager routes. */
const SchemaProbe = () => {
  const { schema, components, isLoading } = access.useContentTypeSchema('api::article.article');
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

const HomePage = () => {
  const failures = staticChecks.filter((check) => !check.ok).length;

  return (
    <Main>
      <Box padding={8}>
        <Flex direction="column" alignItems="flex-start" gap={4}>
          <Typography variant="alpha" tag="h1">
            Headless Content Manager — access layer diagnostics
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
            <access.DocumentStatus status="draft" />
            <access.DocumentStatus status="published" />
          </Flex>
        </Flex>
      </Box>
    </Main>
  );
};

export { HomePage };
