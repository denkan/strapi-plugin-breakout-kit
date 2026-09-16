import type { Core } from "@strapi/strapi";

const controller = ({ strapi }: { strapi: Core.Strapi }) => ({
  index(ctx) {
    ctx.body = strapi
      .plugin("headless-content-manager")
      // the name of the service file & the method.
      .service("service")
      .getWelcomeMessage();
  },
});

export default controller;