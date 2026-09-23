/**
 * Layer 2: Data.
 *
 * <DocumentProvider> + hooks. Consumes the access layer only; never reaches into
 * Strapi internals directly.
 */
export { DocumentProvider, type DocumentProviderProps } from './DocumentProvider';
export { useHeadlessData, type DocumentCallbacks } from './context';
export {
  useDocument,
  useEditLayout,
  useEditForm,
  useEditField,
  usePermissions,
  useLocales,
} from './hooks';
export { useDocumentOperations } from './operations';
export { resolveOverride, isControlledValue, type Override } from './override';
export {
  getEntryCustomizationContext,
  type EntryCustomization,
  type RenderFieldsOptions,
  type EntryCustomizationContextValue,
  type EntryActionDefaults,
  type ComponentEntry,
  type ComponentEntryMeta,
  type ComponentOption,
  type AddButtonContext,
  type DefaultAddButtonComponent,
  type DefaultEntryComponent,
  type ComponentBox,
  type SingleComponentCustomization,
  type DefaultBoxComponent,
} from './entry-customization';
