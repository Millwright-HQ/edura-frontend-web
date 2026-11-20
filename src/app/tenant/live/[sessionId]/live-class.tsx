'use client';

import type { SdkJoinDto } from '@edura/contracts';
import { useEffect, useState } from 'react';
import { ClassWindowBeat } from '../../class-window';

/** Zoom's own scripts, kept in step with the installed package. Its bundle can't be built into the page, so it is loaded from Zoom. */
const SDK_VERSION = '6.10.0';
const BASE = `https://source.zoom.us/${SDK_VERSION}/`;
const WAIT_SECONDS = 8;

/** The little of Zoom's full meeting client that this page uses. */
interface ZoomClient {
  setZoomJSLib(path: string, dir?: string): void;
  preLoadWasm(): void;
  prepareWebSDK(): void;
  i18n?: { load(language: string): void };
  init(options: Record<string, unknown>): void;
  join(options: Record<string, unknown>): void;
}

function addScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    // Zoom's pieces depend on one another, so they are fetched in order.
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not reach Zoom to start the class here.'));
    document.head.appendChild(script);
  });
}

let loading: Promise<ZoomClient> | undefined;

/** The full Zoom meeting screen needs React and a few helpers on the page first; Zoom serves its own copies. */
function loadZoom(): Promise<ZoomClient> {
  const ready = () => (window as unknown as { ZoomMtg?: ZoomClient }).ZoomMtg;
  const existing = ready();
  if (existing) return Promise.resolve(existing);
  loading ??= (async () => {
    for (const file of ['react.min.js', 'react-dom.min.js', 'redux.min.js', 'redux-thunk.min.js', 'lodash.min.js']) {
      await addScript(`${BASE}lib/vendor/${file}`);
    }
    await addScript(`${BASE}zoom-meeting-${SDK_VERSION}.min.js`);
    const found = ready();
    if (!found) throw new Error('Zoom did not load.');
    return found;
  })().catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

type Failure = { errorCode?: number | string; errorMessage?: string; reason?: string; message?: string; result?: string };

const notStarted = (failure: Failure) =>
  Number(failure.errorCode) === 3008 || /not (yet )?started/i.test(`${failure.errorMessage ?? ''} ${failure.reason ?? ''} ${failure.result ?? ''}`);

/**
 * Runs the whole Zoom meeting in the browser window, with all of Zoom's own controls. Everyone joins with their
 * microphone and camera off and can turn them on from Zoom. If the host hasn't started yet the person waits here
 * and is let in as soon as the host arrives. When they leave, they are taken to the class's end page.
 */
export function LiveClass({
  join,
  userName,
  userEmail,
  fallbackHref,
  leaveHref,
  sessionId,
}: {
  join: SdkJoinDto;
  userName: string;
  userEmail: string;
  fallbackHref: string;
  leaveHref: string;
  sessionId: string;
}) {
  const [state, setState] = useState<'loading' | 'live' | 'waiting' | 'failed'>('loading');
  const [reason, setReason] = useState('');
  const [seconds, setSeconds] = useState(WAIT_SECONDS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const zoom = await loadZoom();
        if (cancelled) return;
        zoom.setZoomJSLib(`${BASE}lib`, '/av');
        zoom.preLoadWasm();
        zoom.prepareWebSDK();
        zoom.init({
          leaveUrl: new URL(leaveHref, window.location.origin).toString(),
          patchJsMedia: true,
          leaveOnPageUnload: true,
          // Straight into the meeting, with no audio or video until the person chooses to turn them on.
          disablePreview: true,
          audioPanelAlwaysOpen: false,
          success: () => {
            zoom.join({
              signature: join.signature,
              meetingNumber: join.meetingNumber,
              passWord: join.password,
              userName,
              userEmail,
              ...(join.zak ? { zak: join.zak } : {}),
              success: () => {
                if (!cancelled) setState('live');
              },
              error: (failure: Failure) => {
                if (cancelled) return;
                if (notStarted(failure)) return setState('waiting');
                setReason(failure.errorMessage || failure.reason || failure.message || 'Zoom could not start here.');
                setState('failed');
              },
            });
          },
          error: (failure: Failure) => {
            if (cancelled) return;
            setReason(failure.errorMessage || failure.reason || failure.message || 'Zoom could not start here.');
            setState('failed');
          },
        });
      } catch (error) {
        if (cancelled) return;
        setReason((error as Error).message || 'Zoom could not start here.');
        setState('failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [join, userName, userEmail, leaveHref]);

  // Waiting for the host: look again every few seconds. A fresh load also brings a fresh signature.
  useEffect(() => {
    if (state !== 'waiting') return;
    setSeconds(WAIT_SECONDS);
    const tick = setInterval(() => {
      setSeconds((left) => {
        if (left <= 1) {
          window.location.reload();
          return WAIT_SECONDS;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [state]);

  return (
    <div className="stack">
      <ClassWindowBeat sessionId={sessionId} />
      {state === 'loading' && <p role="status">Connecting to your class…</p>}
      {state === 'waiting' && (
        <div className="notice" role="status">
          <p>
            <strong>Waiting for the host to start the class.</strong>
          </p>
          <p className="muted">You will be let in as soon as they start. Checking again in {seconds}s.</p>
          <p>
            <a className="button-soft" href={leaveHref}>
              Leave
            </a>
          </p>
        </div>
      )}
      {state === 'failed' && (
        <div className="notice notice-error" role="alert">
          <p>{reason}</p>
          <p>
            <a className="button" href={fallbackHref}>
              Open in the Zoom app instead
            </a>
          </p>
        </div>
      )}
      {/* Zoom fills these with the meeting and takes over the whole window. */}
      <div id="zmmtg-root" />
      <div id="aria-notify-area" />
    </div>
  );
}
