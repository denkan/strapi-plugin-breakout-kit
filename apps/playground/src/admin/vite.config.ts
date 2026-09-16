import { mergeConfig, type UserConfig } from 'vite';
import { headlessContentManager } from 'strapi-plugin-breakout-kit/vite';

export default (config: UserConfig) =>
  mergeConfig(config, { plugins: [headlessContentManager()] });
