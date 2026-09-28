import { decryptSecret } from '@/lib/crypto/secret-box';
import { OnvifClient } from '@/lib/onvif';
import { IsapiClient } from '@/lib/isapi';
import { env } from '@/config/env';
import { resolveDeviceProtocol } from './protocol';
import { HikvisionIsapiProvider } from './hikvision.provider';
import { XmeyeOnvifProvider } from './onvif.provider';
import type { CctvOnvifClient } from './onvif-client';
import type { CctvIntegrationProvider, IntegrationProtocol } from './types';
import type { IsapiClientConfig } from '@/lib/isapi';
import type { OnvifCredentials } from '@/lib/onvif';

/** Builds an ONVIF client from a raw device row. */
export type OnvifClientFactory = (device: Record<string, unknown>) => CctvOnvifClient;
/** Builds a Hikvision ISAPI client from a raw device row. */
export type IsapiClientFactory = (device: Record<string, unknown>) => InstanceType<typeof IsapiClient>;

function defaultBuildOnvifClient(device: Record<string, unknown>): CctvOnvifClient {
  const password = decryptSecret(device.passwordEncrypted as string | null) ?? '';
  const credentials: OnvifCredentials = {
    username: (device.username as string | null) ?? '',
    password,
  };
  return new OnvifClient({
    host: device.ipAddress as string,
    port: device.port as number,
    credentials,
    timeoutMs: env.CCTV_ONVIF_TIMEOUT_MS,
  });
}

function defaultBuildIsapiClient(device: Record<string, unknown>): InstanceType<typeof IsapiClient> {
  const password = decryptSecret(device.passwordEncrypted as string | null) ?? '';
  const config: IsapiClientConfig = {
    host: device.ipAddress as string,
    port: device.port as number,
    credentials: {
      username: (device.username as string | null) ?? '',
      password,
    },
    timeoutMs: env.CCTV_ISAPI_TIMEOUT_MS,
  };
  return new IsapiClient(config);
}

let onvifClientFactory: OnvifClientFactory = defaultBuildOnvifClient;
let isapiClientFactory: IsapiClientFactory = defaultBuildIsapiClient;

/** Overrides the ONVIF client factory. Intended for dependency injection/tests. */
export function setCctvClientFactory(factory: OnvifClientFactory): void {
  onvifClientFactory = factory;
}

/** Restores the default ONVIF client factory. */
export function resetCctvClientFactory(): void {
  onvifClientFactory = defaultBuildOnvifClient;
}

/** Overrides the ISAPI client factory. Intended for dependency injection/tests. */
export function setCctvIsapiClientFactory(factory: IsapiClientFactory): void {
  isapiClientFactory = factory;
}

/** Restores the default ISAPI client factory. */
export function resetCctvIsapiClientFactory(): void {
  isapiClientFactory = defaultBuildIsapiClient;
}

/**
 * Builds the integration provider for a device based on its vendor/type.
 * The decrypted password is used only to construct the client and never leaves
 * this layer.
 */
export function buildIntegrationProvider(device: Record<string, unknown>): CctvIntegrationProvider {
  const protocol: IntegrationProtocol = resolveDeviceProtocol(device);
  if (protocol === 'ISAPI') {
    return new HikvisionIsapiProvider(isapiClientFactory(device));
  }
  return new XmeyeOnvifProvider(onvifClientFactory(device));
}

export { resolveIntegrationProtocol, resolveDeviceProtocol, isIntegrationProtocol, isHikvision } from './protocol';
