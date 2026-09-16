import { getTranslation } from "./utils/getTranslation";
import { PLUGIN_ID } from "./pluginId";
import { Initializer } from "./components/Initializer";
import { PluginIcon } from "./components/PluginIcon";

import type { StrapiApp } from "@strapi/strapi/admin";

// Public API (levels 2 and 3 of the usage model: composition pieces and hooks).
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
} from "./data";
export {
  FieldRenderer,
  type FieldRendererProps,
  EditForm,
  type EditFormProps,
  type RenderField,
  type RenderPanel,
  EditHeader,
  type EditHeaderProps,
  DocumentActionsBar,
  type DocumentActionsBarProps,
  type ActionType,
  EditSidePanels,
  type EditSidePanelsProps,
} from "./components";
export { EditPage, type EditPageProps } from "./composition";

const plugin: StrapiApp["appPlugins"][string] = {
  register(app) {
    app.addMenuLink({
      to: `plugins/${PLUGIN_ID}`,
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.plugin.name`,
        defaultMessage: PLUGIN_ID,
      },
      Component: () => import("./pages/App"),
      permissions: [],
    });

    app.registerPlugin({
      id: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
      name: PLUGIN_ID,
    });
  },

  registerTrads({ locales }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = (await import(
            `./translations/${locale}.json`
          )) as {
            default: Record<string, string>;
          };

          const newData: Record<string, string> = {};
          const keys = Object.keys(data);

          for (const key of keys) {
            newData[getTranslation(key)] = data[key];
          }

          return { data: newData, locale };
        } catch {
          return { data: {}, locale };
        }
      }),
    );
  },
};

export default plugin;