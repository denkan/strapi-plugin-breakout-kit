import * as React from 'react';

import {
  COLLECTION_TYPES,
  DocumentRBAC,
  Form,
  SINGLE_TYPES,
  createYupSchema,
  getHeadlessDocumentContext,
  handleInvisibleAttributes,
  transformDocument,
  useContentTypeSchema,
  useRBAC,
  useStrapiDocument,
  useStrapiDocumentLayout,
} from '../access';
import type {
  CollectionType,
  DocumentMeta,
  EditLayout,
  HeadlessDocumentContextValue,
  Permission,
  UseDocumentReturn,
} from '../access';

import { HeadlessDataProvider, type DocumentCallbacks } from './context';
import { isControlledValue, resolveOverride, type Override } from './override';

/** Actions checked against the current admin user, same set as the stock edit view. */
const CM_PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete', 'publish'] as const;

type AnyRecord = Record<string, unknown>;

export interface DocumentProviderProps extends DocumentCallbacks {
  /* identity */
  model: string;
  documentId?: string;
  locale?: string;
  /** Draft & publish status to edit; ignored for content types without D&P. */
  status?: 'draft' | 'published';
  /** Extra API params, merged over { locale, status }. */
  params?: AnyRecord;

  /* controlled-mode overrides (value = controlled, function = transform of the fetched default) */
  document?: Override<AnyRecord | undefined>;
  schema?: Override<unknown>;
  components?: Override<AnyRecord>;
  layout?: Override<EditLayout>;
  initialValues?: Override<AnyRecord | undefined>;

  /** Skip the built-in permission fetch and use these instead. */
  permissions?: Permission[];

  /** Rendered while data is loading (default: nothing). */
  fallback?: React.ReactNode;
  /** Rendered when the document failed to load (default: nothing; onError also fires). */
  errorFallback?: React.ReactNode;

  children: React.ReactNode;
}

/**
 * Layer 2 root: builds everything the stock edit view derives from its route out of props,
 * and publishes it through three channels:
 * - the headless document context (read first by the Vite shim, so the stock input tree
 *   works below this provider)
 * - the plugin's own data context (consumed by the data-layer hooks)
 * - the admin shell's <Form> (form state), mirroring EditViewPage's wiring exactly
 */
export const DocumentProvider = ({
  model,
  documentId,
  locale,
  status = 'draft',
  params: extraParams,
  document: documentOverride,
  schema: schemaOverride,
  components: componentsOverride,
  layout: layoutOverride,
  initialValues: initialValuesOverride,
  permissions: passedPermissions,
  fallback = null,
  errorFallback = null,
  children,
  onCreated,
  onCloned,
  onDeleted,
  onPublished,
  onUnpublished,
  onDiscarded,
  onError,
}: DocumentProviderProps) => {
  // Schema first: collectionType is derived from it, not passed by the consumer.
  const {
    schema: fetchedSchema,
    components: fetchedComponents,
    isLoading: isLoadingSchema,
  } = useContentTypeSchema(model);
  const schema = resolveOverride(schemaOverride, fetchedSchema) as
    | { kind?: string; options?: { draftAndPublish?: boolean }; attributes?: AnyRecord }
    | undefined;
  const components = resolveOverride(componentsOverride, fetchedComponents) as AnyRecord;

  const collectionType: CollectionType =
    schema?.kind === 'singleType' ? SINGLE_TYPES : COLLECTION_TYPES;
  const hasDraftAndPublish = schema?.options?.draftAndPublish ?? false;
  const effectiveStatus = hasDraftAndPublish ? status : 'draft';

  const params = React.useMemo(() => {
    const merged: AnyRecord = { ...extraParams };
    if (locale !== undefined) merged.locale = locale;
    if (hasDraftAndPublish) merged.status = effectiveStatus;
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale, effectiveStatus, hasDraftAndPublish, JSON.stringify(extraParams ?? {})]);

  const meta: DocumentMeta = React.useMemo(
    () => ({ model, collectionType, documentId, params }),
    [model, collectionType, documentId, params]
  );

  // Uncontrolled document fetch (skipped in controlled mode; schema access above is
  // independent of this query).
  const isDocumentControlled = isControlledValue(documentOverride);
  const strapiDoc = useStrapiDocument(
    { model, collectionType, documentId, params },
    { skip: isDocumentControlled }
  );
  const resolvedDocument = resolveOverride(
    documentOverride,
    strapiDoc.document as AnyRecord | undefined
  );

  const isCreating = !documentId && collectionType !== SINGLE_TYPES && !resolvedDocument;

  // Permissions: fetched like ProtectedEditViewPage unless supplied.
  const permissionsToCheck = React.useMemo(
    () =>
      CM_PERMISSION_ACTIONS.map((action) => ({
        action: `plugin::content-manager.explorer.${action}`,
        subject: model,
      })),
    [model]
  );
  const { permissions: fetchedPermissions = [], isLoading: isLoadingPermissions } = useRBAC(
    permissionsToCheck,
    passedPermissions
  );
  const permissions = passedPermissions ?? fetchedPermissions;

  // Layout, after Strapi's own resolution (configuration + hook waterfall) and overrides.
  const {
    edit: fetchedEditLayout,
    isLoading: isLayoutLoading,
    error: layoutError,
  } = useStrapiDocumentLayout(model);
  const editLayout = resolveOverride(layoutOverride, fetchedEditLayout as EditLayout);

  // The useDocument-shaped object all consumers (incl. the shim's readers) see.
  const currentDocument = React.useMemo<UseDocumentReturn>(() => {
    const base = strapiDoc as unknown as AnyRecord;
    return {
      ...base,
      document: resolvedDocument,
      schema,
      components,
      isLoading: isDocumentControlled ? false : (base.isLoading as boolean),
    } as unknown as UseDocumentReturn;
  }, [strapiDoc, resolvedDocument, schema, components, isDocumentControlled]);

  // Form initial values: stock derivation, except controlled documents run through
  // transformDocument directly.
  const defaultInitialValues = React.useMemo(() => {
    if (isDocumentControlled) {
      return resolvedDocument && schema
        ? (transformDocument(schema, components)(resolvedDocument) as AnyRecord)
        : undefined;
    }
    return strapiDoc.getInitialFormValues?.(isCreating) as AnyRecord | undefined;
  }, [isDocumentControlled, resolvedDocument, schema, components, strapiDoc, isCreating]);
  const initialValues = resolveOverride(initialValuesOverride, defaultInitialValues);

  const callbacks = React.useMemo<DocumentCallbacks>(
    () => ({ onCreated, onCloned, onDeleted, onPublished, onUnpublished, onDiscarded, onError }),
    [onCreated, onCloned, onDeleted, onPublished, onUnpublished, onDiscarded, onError]
  );

  const bridgeValue = React.useMemo<HeadlessDocumentContextValue>(
    () => ({ currentDocumentMeta: meta, currentDocument }),
    [meta, currentDocument]
  );

  const hasError = Boolean(strapiDoc.hasError) || Boolean(layoutError);
  React.useEffect(() => {
    if (hasError) {
      onError?.(layoutError ?? new Error(`Failed to load document for ${model}`));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasError]);

  const HeadlessDocumentContext = getHeadlessDocumentContext();

  const isLoading =
    isLoadingSchema ||
    isLoadingPermissions ||
    isLayoutLoading ||
    (!isDocumentControlled && strapiDoc.isLoading) ||
    !schema ||
    !initialValues;

  // Gate ONLY the initial load of each document identity. Later transient loading states
  // (tag-invalidation refetches after save/publish, permission re-checks) must NOT unmount
  // the children — that would wipe consumer component state mid-interaction. Render-phase
  // ref write is deliberate: waiting for an effect would let one frame of children render
  // against a not-yet-loaded new identity.
  const identityKey = `${collectionType}:${model}:${documentId ?? 'create'}:${locale ?? 'default'}`;
  const loadedIdentityRef = React.useRef<string | null>(null);
  if (!isLoading && !hasError) {
    loadedIdentityRef.current = identityKey;
  }
  const isInitialLoad = loadedIdentityRef.current !== identityKey;

  if (hasError) {
    return <>{errorFallback}</>;
  }

  if (isLoading && isInitialLoad) {
    return <>{fallback}</>;
  }
  if (!initialValues || !schema) {
    // Loaded before, but the data for this identity is momentarily unavailable.
    return <>{fallback}</>;
  }

  return (
    <HeadlessDocumentContext.Provider value={bridgeValue}>
      <HeadlessDataProvider
        value={{
          meta,
          currentDocument,
          isCreating,
          hasDraftAndPublish,
          status: effectiveStatus,
          editLayout,
          isLayoutLoading,
          initialValues,
          callbacks,
        }}
      >
        <DocumentRBAC model={model} permissions={permissions}>
          <Form
            key={`${collectionType}:${model}:${documentId ?? 'create'}:${locale ?? 'default'}`}
            disabled={hasDraftAndPublish && effectiveStatus === 'published'}
            method={isCreating ? 'POST' : 'PUT'}
            initialValues={initialValues}
            validate={(values: AnyRecord, options: AnyRecord) => {
              // Identical to EditViewPage: strip fields hidden by visibility conditions,
              // then validate against the status-aware yup schema.
              const { data: cleanedValues, removedAttributes } = handleInvisibleAttributes(
                values,
                { schema, initialValues, components }
              );
              const yupSchema = createYupSchema(schema?.attributes, components, {
                status: effectiveStatus,
                removedAttributes,
                ...options,
              });
              return yupSchema.validate(cleanedValues, { abortEarly: false });
            }}
          >
            {children}
          </Form>
        </DocumentRBAC>
      </HeadlessDataProvider>
    </HeadlessDocumentContext.Provider>
  );
};
