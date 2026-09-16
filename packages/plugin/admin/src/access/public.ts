/**
 * Access layer — strategy 1: public exports.
 *
 * Everything here comes from documented/typed public entry points. Re-exported so the data
 * layer imports from `access/` only (PLAN design principle 5); the `unstable_` names are
 * confined to this file and drift-tracked as `kind: "export"` manifest entries.
 */
export {
  unstable_useDocument as useStrapiDocument,
  unstable_useDocumentActions as useStrapiDocumentActions,
  unstable_useDocumentLayout as useStrapiDocumentLayout,
  useDocumentRBAC,
  DocumentRBAC,
  buildValidParams,
  DocumentStatus,
} from '@strapi/content-manager/strapi-admin';

export type {
  EditFieldLayout,
  EditLayout,
  DocumentActionComponent,
  DocumentActionDescription,
  DocumentActionProps,
  HeaderActionComponent,
  HeaderActionDescription,
  PanelComponent,
  PanelComponentProps,
  PanelDescription,
  DocumentRBACProps,
} from '@strapi/content-manager/strapi-admin';

export {
  Form,
  useForm,
  useField,
  Blocker,
  getYupValidationErrors,
  Page,
  Layouts,
  useRBAC,
  useAuth,
  useStrapiApp,
  useQueryParams,
  useNotification,
  useAPIErrorHandler,
  adminApi,
  DescriptionComponentRenderer,
  createRulesEngine,
  translatedErrors,
  ConfirmDialog,
} from '@strapi/admin/strapi-admin';

export type {
  FormValues,
  FormErrors,
  FormProps,
  FieldValue,
  InputProps,
  Permission,
} from '@strapi/admin/strapi-admin';
