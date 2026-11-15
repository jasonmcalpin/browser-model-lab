declare module "virtual:bml-model-cards" {
  /** BML host-selected and ArcanAI-enumerated JSON files, keyed by source path. */
  const cards: Readonly<Record<string, unknown>>;
  export default cards;
}
