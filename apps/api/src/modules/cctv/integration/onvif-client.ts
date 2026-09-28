/**
 * The ONVIF operations the integration layer depends on.
 *
 * Kept as an interface (rather than the concrete `OnvifClient`) so a fake can
 * be injected in tests without touching a real device. The concrete
 * `OnvifClient` from `@/lib/onvif` satisfies it structurally.
 */
export interface CctvOnvifClient {
  getDeviceInformation(): Promise<{
    manufacturer: string | null;
    model: string | null;
    firmwareVersion: string | null;
    serialNumber: string | null;
    hardwareId: string | null;
  }>;
  getServices(): Promise<{ namespace: string; xAddr: string }[]>;
  getVideoSources(): Promise<{
    token: string;
    sourceToken: string | null;
    name: string | null;
    resolution: string | null;
  }[]>;
  getProfiles(): Promise<
    {
      token: string;
      name: string | null;
      videoSourceToken: string | null;
      videoSourceName: string | null;
      encoderToken: string | null;
      encoding: string | null;
      resolution: string | null;
      fps: number | null;
    }[]
  >;
  getStreamUri(profileToken: string): Promise<{ uri: string | null }>;
}
