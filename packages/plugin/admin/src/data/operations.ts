import * as React from 'react';
import { useIntl } from 'react-intl';

import {
  SINGLE_TYPES,
  createYupSchema,
  handleInvisibleAttributes,
  useForm,
  useNotification,
  useStrapiDocumentActions,
} from '../access';

import { useHeadlessData } from './context';
import { transformDocumentData } from './transform-data';

type AnyRecord = Record<string, unknown>;
type OperationResult =
  { data: AnyRecord; error?: undefined } | { error: unknown; data?: undefined };

const isValidationError = (error: unknown): error is { name: string; details: unknown } =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: string }).name === 'ValidationError';

/**
 * The stock actions resolve with the unwrapped payload (`res.data`) on success and with
 * `{ error }` on failure — normalize to a discriminated result.
 */
const toResult = (res: unknown): OperationResult => {
  if (res && typeof res === 'object' && 'error' in res && (res as { error: unknown }).error) {
    return { error: (res as { error: unknown }).error };
  }
  return { data: res as AnyRecord };
};

/**
 * Extracts the documentId from a create/clone action result. The stock
 * `useDocumentActions().create/autoClone` resolve with the RESPONSE BODY
 * (`{ data: { documentId, … }, meta }`) — the stock edit view reads
 * `res.data.data.documentId`. A bare `{ documentId }` is accepted too so a future
 * unwrapping upstream cannot silently break the callbacks.
 */
const documentIdOf = (payload: unknown): string => {
  const outer = payload as { documentId?: string; data?: { documentId?: string } } | undefined;
  const id = outer?.data?.documentId ?? outer?.documentId;
  if (typeof id !== 'string') {
    throw new Error('[breakout-kit] create/clone succeeded but the response carried no documentId');
  }
  return id;
};

/**
 * Promise-returning document operations with NO navigation: side effects surface only
 * through the <DocumentProvider> callbacks. Mirrors the stock default actions' data flow
 * (validate → strip invisible → transform → mutate → resetForm/setErrors), minus routing,
 * guided-tour and telemetry wiring (docs/decisions.md #3).
 */
export function useDocumentOperations() {
  const { meta, currentDocument, isCreating, hasDraftAndPublish, callbacks, initialValues } =
    useHeadlessData('useDocumentOperations');
  const { toggleNotification } = useNotification();
  const { formatMessage } = useIntl();
  const actions = useStrapiDocumentActions();

  const validate = useForm('useDocumentOperations', (state) => state.validate);
  const getValues = useForm('useDocumentOperations', (state) => state.getValues);
  const setErrors = useForm('useDocumentOperations', (state) => state.setErrors);
  const setSubmitting = useForm('useDocumentOperations', (state) => state.setSubmitting);
  const resetForm = useForm('useDocumentOperations', (state) => state.resetForm);
  const modified = useForm('useDocumentOperations', (state) => state.modified);

  const { model, collectionType, documentId, params } = meta;
  const schema = currentDocument.schema as
    { attributes?: AnyRecord; options?: { draftAndPublish?: boolean } } | undefined;
  const components = currentDocument.components as AnyRecord;

  /** Shared pre-submit pipeline: blur+flush, validate, strip invisible, unwrap apiData. */
  const prepareValues = React.useCallback(
    async (validationStatus: 'draft' | 'published'): Promise<AnyRecord | null> => {
      // Same flush dance as the stock UpdateAction: blur the active input so debounced
      // editors commit, and let batched updates settle before validating.
      globalThis.document?.activeElement instanceof HTMLElement &&
        globalThis.document.activeElement.blur();
      await Promise.resolve();
      await Promise.resolve();

      const { errors } = await validate(true, { status: validationStatus });
      if (errors) {
        toggleNotification({
          type: 'danger',
          message: formatMessage({
            id: 'content-manager.validation.error',
            defaultMessage:
              'There are validation errors in your document. Please fix them before saving.',
          }),
        });
        return null;
      }
      const { data } = handleInvisibleAttributes(transformDocumentData(getValues()) as AnyRecord, {
        schema,
        initialValues,
        components,
      });
      return data;
    },
    [validate, getValues, toggleNotification, formatMessage, schema, initialValues, components]
  );

  const save = React.useCallback(async (): Promise<OperationResult> => {
    setSubmitting(true);
    try {
      const data = await prepareValues(hasDraftAndPublish ? 'draft' : 'published');
      if (!data) return { error: new Error('ValidationFailed') };

      if (!isCreating) {
        const result = toResult(
          await actions.update({ collectionType, model, documentId, params }, data)
        );
        if (result.error) {
          if (isValidationError(result.error)) setErrors(result.error as never);
          return result;
        }
        resetForm(getValues());
        return result;
      }

      const result = toResult(await actions.create({ model, params }, data));
      if (result.error) {
        if (isValidationError(result.error)) setErrors(result.error as never);
        return result;
      }
      resetForm(getValues());
      callbacks.onCreated?.({ documentId: documentIdOf(result.data) });
      return result;
    } finally {
      setSubmitting(false);
    }
  }, [
    actions,
    callbacks,
    collectionType,
    documentId,
    getValues,
    hasDraftAndPublish,
    isCreating,
    model,
    params,
    prepareValues,
    resetForm,
    setErrors,
    setSubmitting,
  ]);

  const publish = React.useCallback(async (): Promise<OperationResult> => {
    setSubmitting(true);
    try {
      const data = await prepareValues('published');
      if (!data) return { error: new Error('ValidationFailed') };

      const result = toResult(
        await actions.publish(
          { collectionType, model, documentId: isCreating ? undefined : documentId, params },
          data
        )
      );
      if (result.error) {
        if (isValidationError(result.error)) setErrors(result.error as never);
        return result;
      }
      resetForm(getValues());
      callbacks.onPublished?.({
        documentId: (result.data as { documentId?: string } | undefined)?.documentId,
      });
      return result;
    } finally {
      setSubmitting(false);
    }
  }, [
    actions,
    callbacks,
    collectionType,
    documentId,
    getValues,
    isCreating,
    model,
    params,
    prepareValues,
    resetForm,
    setErrors,
    setSubmitting,
  ]);

  const unpublish = React.useCallback(
    async (opts?: { discardDraft?: boolean }): Promise<OperationResult> => {
      const result = toResult(
        await actions.unpublish(
          { collectionType, model, documentId, params },
          opts?.discardDraft ?? false
        )
      );
      if (result.error) return result;
      callbacks.onUnpublished?.();
      return result;
    },
    [actions, callbacks, collectionType, documentId, model, params]
  );

  const discard = React.useCallback(async (): Promise<OperationResult> => {
    const result = toResult(await actions.discard({ collectionType, model, documentId, params }));
    if (result.error) return result;
    callbacks.onDiscarded?.();
    return result;
  }, [actions, callbacks, collectionType, documentId, model, params]);

  const deleteDocument = React.useCallback(async (): Promise<OperationResult> => {
    // Stock DeleteAction deletes across locales (locale: '*'); keep that behavior.
    const result = toResult(
      await actions.delete({
        collectionType,
        model,
        documentId,
        params: { ...params, locale: '*' },
      })
    );
    if (result.error) return result;
    callbacks.onDeleted?.();
    return result;
  }, [actions, callbacks, collectionType, documentId, model, params]);

  const clone = React.useCallback(async (): Promise<OperationResult> => {
    if (!documentId) return { error: new Error('Cannot clone an unsaved document') };
    // autoClone (no payload) — the stock clone-with-data flow navigates to a clone route,
    // which has no headless equivalent yet (docs/decisions.md #4).
    const result = toResult(
      await actions.autoClone({
        model,
        sourceId: documentId,
        locale: params?.locale as string | undefined,
      })
    );
    if (result.error) return result;
    callbacks.onCloned?.({ documentId: documentIdOf(result.data) });
    return result;
  }, [actions, callbacks, documentId, model]);

  return React.useMemo(
    () => ({
      save,
      publish,
      unpublish,
      discard,
      delete: deleteDocument,
      clone,
      isModified: modified,
      isLoading: actions.isLoading,
    }),
    [save, publish, unpublish, discard, deleteDocument, clone, modified, actions.isLoading]
  );
}

/** Validation helper mirroring EditViewPage's validateSync (used for forced validation). */
export function createStatusAwareValidator(
  schema: { attributes?: AnyRecord } | undefined,
  components: AnyRecord,
  status: 'draft' | 'published'
) {
  return (values: AnyRecord) => {
    const { data, removedAttributes } = handleInvisibleAttributes(values, {
      schema,
      initialValues: values,
      components,
    });
    const yupSchema = createYupSchema(schema?.attributes, components, {
      status,
      removedAttributes,
    });
    return yupSchema.validate(data, { abortEarly: false });
  };
}
