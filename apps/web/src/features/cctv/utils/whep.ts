/**
 * Minimal WHEP (WebRTC-HTTP Egress Protocol) client.
 *
 * Used to play the streaming gateway's WebRTC output directly in the browser,
 * through the API's same-origin WHEP proxy. The browser never learns the RTSP
 * URL or the CCTV credentials — only an opaque session endpoint.
 *
 * Flow (RFC-draft WHEP):
 *   OPTIONS  -> ICE servers (Link header, optional)
 *   POST sdp -> 201 + Location (session URL) + answer SDP
 *   PATCH    -> trickle ICE candidates
 *   DELETE   -> teardown
 */

export interface WhepCallbacks {
  onTrack: (stream: MediaStream) => void;
  onError: (message: string) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

export interface WhepReader {
  close: () => void;
}

const RETRY_PAUSE_MS = 2000;

function parseIceServers(header: string | null): RTCIceServer[] {
  if (!header) return [];
  const servers: RTCIceServer[] = [];
  for (const link of header.split(',')) {
    const match = link.match(/^<(.+?)>;\s*rel="ice-server"(?:;\s*username="(.*?)";\s*credential="(.*?)")?/i);
    if (!match) continue;
    const server: RTCIceServer = { urls: [match[1]] };
    if (match[2] !== undefined && match[3] !== undefined) {
      server.username = JSON.parse(`"${match[2]}"`);
      server.credential = JSON.parse(`"${match[3]}"`);
    }
    servers.push(server);
  }
  return servers;
}

export function createWhepReader(url: string, token: string | null, callbacks: WhepCallbacks): WhepReader {
  let state: 'running' | 'closed' = 'running';
  let pc: RTCPeerConnection | null = null;
  let sessionUrl: string | null = null;
  let restartTimer: number | null = null;
  let localOfferSdp = '';
  const queuedCandidates: RTCIceCandidate[] = [];

  const authHeader = (): Record<string, string> =>
    token ? { Authorization: `Bearer ${token}` } : {};

  function cleanup(): void {
    if (pc) {
      pc.close();
      pc = null;
    }
    if (sessionUrl) {
      fetch(sessionUrl, { method: 'DELETE', headers: authHeader() }).catch(() => {});
      sessionUrl = null;
    }
  }

  function fail(message: string): void {
    if (state === 'closed') return;
    callbacks.onError(message);
  }

  function restartOrFail(message: string): void {
    if (state !== 'running') return;
    cleanup();
    callbacks.onError(message);
    restartTimer = window.setTimeout(() => {
      if (state === 'running') void start();
    }, RETRY_PAUSE_MS);
  }

  async function start(): Promise<void> {
    if (state !== 'running') return;
    try {
      const optionsRes = await fetch(url, { method: 'OPTIONS', headers: authHeader() });
      const iceServers = parseIceServers(optionsRes.headers.get('Link'));

      pc = new RTCPeerConnection({ iceServers });
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      pc.onicecandidate = (evt) => {
        if (!evt.candidate) return;
        if (sessionUrl) {
          void sendCandidate(evt.candidate);
        } else {
          queuedCandidates.push(evt.candidate);
        }
      };
      pc.ontrack = (evt) => {
        if (evt.streams[0]) callbacks.onTrack(evt.streams[0]);
      };
      pc.onconnectionstatechange = () => {
        if (!pc) return;
        callbacks.onConnectionStateChange?.(pc.connectionState);
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          restartOrFail('WebRTC connection closed.');
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      localOfferSdp = offer.sdp ?? '';

      const answerRes = await fetch(url, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/sdp' },
        body: offer.sdp ?? '',
      });
      if (answerRes.status === 404) {
        fail('Stream not available.');
        return;
      }
      if (!answerRes.ok) {
        fail(`Signalling failed (HTTP ${answerRes.status}).`);
        return;
      }
      const location = answerRes.headers.get('Location');
      if (location) sessionUrl = new URL(location, url).toString();

      const answerSdp = await answerRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Flush candidates gathered before the session URL existed.
      while (queuedCandidates.length > 0) {
        const candidate = queuedCandidates.shift();
        if (candidate) await sendCandidate(candidate);
      }
    } catch (error) {
      restartOrFail(error instanceof Error ? error.message : 'WebRTC failed.');
    }
  }

  function sendCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!sessionUrl || !pc) return Promise.resolve();
    // Build a trickle-ICE fragment carrying the offer's credentials and one
    // m-line per media section (video/audio), tagged with the candidate's mid.
    const ufrag = extract(localOfferSdp, 'a=ice-ufrag:');
    const pwd = extract(localOfferSdp, 'a=ice-pwd:');
    const mediaLines = localOfferSdp
      .split('\r\n')
      .filter((l) => l.startsWith('m='))
      .map((l, index) => `m=${l.slice(2)}\r\na=mid:${index}\r\n`);
    const targetIndex = candidate.sdpMLineIndex ?? 0;
    const mediaWithCandidate = mediaLines.map((line, index) =>
      index === targetIndex ? `${line}a=${candidate.candidate}\r\n` : line,
    );
    const frag = `a=ice-ufrag:${ufrag}\r\n` + `a=ice-pwd:${pwd}\r\n` + mediaWithCandidate.join('');
    return fetch(sessionUrl, {
      method: 'PATCH',
      headers: {
        ...authHeader(),
        'Content-Type': 'application/trickle-ice-sdpfrag',
        'If-Match': '*',
      },
      body: frag,
    })
      .then(() => undefined)
      .catch(() => {
        // Individual candidate failures are non-fatal.
      });
  }

  function extract(sdp: string | undefined, key: string): string {
    if (!sdp) return '';
    const line = sdp.split('\r\n').find((l) => l.startsWith(key));
    return line ? line.slice(key.length) : '';
  }

  void start();

  return {
    close: () => {
      state = 'closed';
      if (restartTimer !== null) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      cleanup();
    },
  };
}
