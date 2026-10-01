/**
 * Monotonic generation guard for async lifecycles.
 *
 * Each Play/Stop/selection change bumps the generation. An async response is
 * only allowed to mutate state while its captured generation is still current,
 * so a stale Play response can never overwrite a newer state (e.g. after Stop).
 */
export class GenerationGuard {
  private gen = 0;

  /** Invalidates all in-flight generations and returns the new one. */
  bump(): number {
    this.gen += 1;
    return this.gen;
  }

  get current(): number {
    return this.gen;
  }

  /** True when `gen` is still the latest generation. */
  isCurrent(gen: number): boolean {
    return gen === this.gen;
  }
}
