export type GenerationPhase = "route" | "places" | "suggestions" | "assembling";
export type GenerationOptions = { signal?: AbortSignal; onProgress?: (phase: GenerationPhase) => void };

/** One owner for each generation; stale work can never finish a newer request. */
export function createGenerationGate() {
  let active: AbortController | undefined;
  return {
    isActive: () => !!active,
    begin() {
      if (active) return undefined;
      const controller = new AbortController();
      active = controller;
      return {
        signal: controller.signal,
        isCurrent: () => active === controller && !controller.signal.aborted,
        finish: () => { if (active === controller) active = undefined; },
      };
    },
    cancel() { const previous = active; active = undefined; previous?.abort(); },
  };
}
