import { streamingGatewayConfig } from '@/config/env';
import { MediaMtxGateway } from './mediamtx.gateway';
import type { StreamingGateway } from './types';

/**
 * Gateway factory + test seam. The CCTV domain layer depends on the
 * `StreamingGateway` interface, never on MediaMTX directly.
 */

let gatewayFactory: () => StreamingGateway = () =>
  new MediaMtxGateway({
    apiUrl: streamingGatewayConfig.apiUrl,
    webrtcUrl: streamingGatewayConfig.webrtcUrl,
    hlsUrl: streamingGatewayConfig.hlsUrl,
    rtspUrl: streamingGatewayConfig.rtspUrl,
  });

/** Overrides the gateway implementation. Intended for dependency injection/tests. */
export function setStreamingGatewayFactory(factory: () => StreamingGateway): void {
  gatewayFactory = factory;
}

/** Restores the default (MediaMTX) gateway. */
export function resetStreamingGatewayFactory(): void {
  gatewayFactory = () =>
    new MediaMtxGateway({
      apiUrl: streamingGatewayConfig.apiUrl,
      webrtcUrl: streamingGatewayConfig.webrtcUrl,
      hlsUrl: streamingGatewayConfig.hlsUrl,
      rtspUrl: streamingGatewayConfig.rtspUrl,
    });
}

/** Returns the configured streaming gateway. */
export function getStreamingGateway(): StreamingGateway {
  return gatewayFactory();
}

/** True when Live View is enabled by configuration. */
export function isStreamingEnabled(): boolean {
  return streamingGatewayConfig.enabled;
}
