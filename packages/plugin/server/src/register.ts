import type { Core } from "@strapi/strapi";

import { installRecursiveDynamicZonePatches } from "./access/recursive-populate";

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // Must run in register (before other plugins' bootstrap) so content history's
  // createServiceUtils is wrapped before the content-manager bootstrap calls it.
  try {
    installRecursiveDynamicZonePatches({ strapi });
  } catch (error) {
    strapi.log.warn(
      `[breakout-kit] failed to install recursive dynamic zone populate guards — recursive component schemas will crash Strapi's populate builders: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};

export default register;
