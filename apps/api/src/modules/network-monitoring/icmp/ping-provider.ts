/**
 * ICMP provider abstraction.
 *
 * The monitoring engine depends on this interface, not on a concrete library.
 * This keeps the engine decoupled from the OS/ICMP implementation and lets
 * tests inject a fake provider.
 */
export interface PingResult {
  /** True if the probe got a reply (reachable / online). */
  success: boolean;
  /** Backend/server timestamp of when the probe was performed. */
  checkedAt: Date;
  /** Round-trip time in milliseconds when a reply was received. */
  roundTripMs?: number;
}

export interface ICMPProvider {
  /**
   * Perform a single ICMP echo to `ipAddress` and report success/failure.
   * Implementations SHOULD throw on invalid input (e.g. malformed IP) or
   * provider-level failures so the engine can isolate per-device errors.
   */
  ping(ipAddress: string): Promise<PingResult>;
}
