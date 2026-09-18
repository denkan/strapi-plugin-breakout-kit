export interface RecursiveDynamicZonesConfig {
  /** Install the cycle-safe populate guards (behavior-neutral on acyclic schemas). */
  enabled: boolean;
  /**
   * How many times the same component may repeat along one populate nesting chain
   * (i.e. how deep editors can nest a recursive dynamic zone and still have the
   * content fetched). Minimum 2.
   */
  maxDepth: number;
}

export default {
  default: {
    recursiveDynamicZones: {
      enabled: true,
      maxDepth: 10,
    } satisfies RecursiveDynamicZonesConfig,
  },
  validator(config: { recursiveDynamicZones?: Partial<RecursiveDynamicZonesConfig> }) {
    const rdz = config?.recursiveDynamicZones;
    if (rdz == null) {
      return;
    }
    if (rdz.enabled !== undefined && typeof rdz.enabled !== 'boolean') {
      throw new Error('breakout-kit config: recursiveDynamicZones.enabled must be a boolean');
    }
    if (
      rdz.maxDepth !== undefined &&
      (!Number.isInteger(rdz.maxDepth) || (rdz.maxDepth as number) < 2)
    ) {
      throw new Error('breakout-kit config: recursiveDynamicZones.maxDepth must be an integer >= 2');
    }
  },
};
