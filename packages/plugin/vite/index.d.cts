import type { Plugin } from 'vite';

/**
 * Vite plugin for the Strapi admin build. Resolves deep imports into
 * @strapi/content-manager / @strapi/admin dists and installs the headless
 * document-context shim. See the package README for setup.
 */
export declare function breakoutKit(): Plugin;
export default breakoutKit;
