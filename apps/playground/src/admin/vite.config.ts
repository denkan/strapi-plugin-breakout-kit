import { mergeConfig, type UserConfig } from 'vite';
import { breakoutKit } from 'strapi-plugin-breakout-kit/vite';

export default (config: UserConfig) =>
  mergeConfig(config, { plugins: [breakoutKit()] });
