import { mergeConfig, type UserConfig } from 'vite';
import { headlessContentManager } from 'strapi-plugin-headless-content-manager/vite';

export default (config: UserConfig) =>
  mergeConfig(config, { plugins: [headlessContentManager()] });
