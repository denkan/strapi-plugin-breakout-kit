import { PLUGIN_ID } from "./pluginId";
import { Initializer } from "./components/Initializer";

import type { StrapiApp } from "@strapi/strapi/admin";

// Public API — the three usage levels: composition (<EditPage>), components, data hooks.
// The plugin intentionally registers NO admin UI of its own (no menu link, no pages);
// it is a library delivered as a plugin. Demos live in the repo's playground app.
export {
  DocumentProvider,
  type DocumentProviderProps,
  type DocumentCallbacks,
  type Override,
  useDocument,
  useEditLayout,
  useEditForm,
  useEditField,
  usePermissions,
  useLocales,
  useDocumentOperations,
  type EntryCustomization,
  type RenderFieldsOptions,
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
} from "./data";
export {
  FieldRenderer,
  type FieldRendererProps,
  EditForm,
  type EditFormProps,
  type RenderField,
  type RenderPanel,
  type RenderBody,
  type PanelInfo,
  EditHeader,
  type EditHeaderProps,
  DocumentActionsBar,
  type DocumentActionsBarProps,
  type ActionType,
  EditSidePanels,
  type EditSidePanelsProps,
} from "./components";
export {
  EditPage,
  type EditPageProps,
  setEditViewReplacement,
  type EditViewReplacementResolver,
  type EditViewRouteInfo,
} from "./composition";
export { accessDiagnostics } from "./access/diagnostics";

const plugin: StrapiApp["appPlugins"][string] = {
  register(app) {
    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },
};

export default plugin;
