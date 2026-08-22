export type ExperimentConfig = {
  /** Stable experiment id - becomes the `experiment_id` property on
   * `experiment_view`/`experiment_conversion` events (brief §5, §21). */
  id: string;
  /** Variant names, e.g. `["control", "variant_b"]`. The first entry is
   * the fallback rendered before a client-side bucket assignment exists
   * (server render, and the very first client render before hydration). */
  variants: readonly string[];
};
