import * as React from 'react';

import {
  useDocumentRBAC,
  useField,
  useForm,
  useStrapiApp,
  useFetchClient,
} from '../access';
import type { DocumentMeta, EditLayout, UseDocumentReturn } from '../access';

import { useHeadlessData } from './context';
import { resolveOverride, type Override } from './override';

type AnyRecord = Record<string, unknown>;

/**
 * Document data + schema + validation for the surrounding <DocumentProvider>.
 * All values already include the provider's controlled-mode overrides.
 */
export function useDocument(): {
  document: AnyRecord | undefined;
  meta: DocumentMeta;
  schema: unknown;
  components: AnyRecord;
  isCreating: boolean;
  isLoading: boolean;
  hasDraftAndPublish: boolean;
  status: 'draft' | 'published';
  refetch: () => void;
  validate: UseDocumentReturn['validate'];
  getTitle: (mainField: string) => string;
} {
  const { meta, currentDocument, isCreating, hasDraftAndPublish, status } =
    useHeadlessData('useDocument');
  const doc = currentDocument as unknown as AnyRecord;
  return {
    document: doc.document as AnyRecord | undefined,
    meta,
    schema: doc.schema,
    components: doc.components as AnyRecord,
    isCreating,
    isLoading: Boolean(doc.isLoading),
    hasDraftAndPublish,
    status,
    refetch: doc.refetch as () => void,
    validate: doc.validate as UseDocumentReturn['validate'],
    getTitle: doc.getTitle as (mainField: string) => string,
  };
}

/** Resolved edit layout (after configuration + hook waterfall + provider override). */
export function useEditLayout(override?: Override<EditLayout>): {
  layout: EditLayout;
  isLoading: boolean;
} {
  const { editLayout, isLayoutLoading } = useHeadlessData('useEditLayout');
  return {
    layout: resolveOverride(override, editLayout),
    isLoading: isLayoutLoading,
  };
}

/** Form-level state and helpers over the shell Form mounted by the provider. */
export function useEditForm() {
  const values = useForm('useEditForm', (state) => state.values as AnyRecord);
  const errors = useForm('useEditForm', (state) => state.errors as AnyRecord);
  const modified = useForm('useEditForm', (state) => state.modified as boolean);
  const isSubmitting = useForm('useEditForm', (state) => state.isSubmitting as boolean);
  const disabled = useForm('useEditForm', (state) => state.disabled as boolean);
  const onChange = useForm(
    'useEditForm',
    (state) => state.onChange as (name: string, value: unknown) => void
  );
  const resetForm = useForm('useEditForm', (state) => state.resetForm as () => void);

  const setValue = React.useCallback(
    (path: string, value: unknown) => onChange(path, value),
    [onChange]
  );

  return { values, errors, modified, isSubmitting, disabled, setValue, resetForm };
}

/** One field's value/error/onChange by path — direct re-export of the shell's useField. */
export const useEditField = useField;

/** Document-level RBAC computed by the provider (canCreate/Read/Update/Delete/Publish, field lists). */
export function usePermissions() {
  return useDocumentRBAC('usePermissions', (state) => state);
}

interface Locale {
  code: string;
  name: string;
  isDefault: boolean;
}

/**
 * i18n locales when the i18n plugin is enabled; safe no-op shape otherwise.
 * (The i18n plugin exposes no public admin exports, so this fetches /i18n/locales
 * with the admin fetch client — one request, cached for the component lifetime.)
 */
export function useLocales(): { isEnabled: boolean; locales: Locale[]; isLoading: boolean } {
  const plugins = useStrapiApp('useLocales', (state) => state.plugins);
  const isEnabled = 'i18n' in plugins;
  const { get } = useFetchClient();
  const [locales, setLocales] = React.useState<Locale[]>([]);
  const [isLoading, setIsLoading] = React.useState(isEnabled);

  React.useEffect(() => {
    if (!isEnabled) return;
    let cancelled = false;
    get('/i18n/locales')
      .then((res) => {
        const data = res.data as Locale[];
        if (!cancelled) setLocales(Array.isArray(data) ? data : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [get, isEnabled]);

  return { isEnabled, locales, isLoading };
}
