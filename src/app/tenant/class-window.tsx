'use client';

import { useEffect, useState, type ReactNode } from 'react';

/** The window a class opens in. Named, so the main window can find it again and bring it forward. */
export const CLASS_WINDOW = 'edura-class';
const STORAGE_KEY = 'edura-class-window';
const BEAT_MS = 2000;
const STALE_MS = 6000;

type Beat = { sessionId: string; at: number };

const read = (): Beat | undefined => {
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as Beat | null;
    return value && Date.now() - value.at < STALE_MS ? value : undefined;
  } catch {
    return undefined;
  }
};

/** Runs inside the class window: says every couple of seconds that this class is open, and stops when the window closes. */
export function ClassWindowBeat({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    const beat = () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, at: Date.now() }));
      } catch {
        // Storage can be blocked. The class still works; only "Return to class" is lost.
      }
    };
    const clear = () => {
      try {
        if (read()?.sessionId === sessionId) window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing to clean up.
      }
    };
    beat();
    const timer = setInterval(beat, BEAT_MS);
    window.addEventListener('pagehide', clear);
    return () => {
      clearInterval(timer);
      window.removeEventListener('pagehide', clear);
      clear();
    };
  }, [sessionId]);
  return null;
}

/** In the main window: shows "Return to class" while that class is open in its own window, and the usual buttons otherwise. */
export function ReturnToClass({ sessionId, children }: { sessionId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => setOpen(read()?.sessionId === sessionId);
    check();
    const timer = setInterval(check, BEAT_MS);
    return () => clearInterval(timer);
  }, [sessionId]);
  if (!open) return <>{children}</>;
  return (
    <button
      type="button"
      className="button-soft button-sm"
      onClick={() => {
        // The same name finds the class window if it is still open.
        window.open('', CLASS_WINDOW)?.focus();
      }}
    >
      Return to class
    </button>
  );
}

/** A link that opens the class in its own window, so the main Edura window stays free to browse courses and files. */
export function PopOutLink({ href, className, children }: { href: string; className?: string | undefined; children: ReactNode }) {
  return (
    <a
      className={className}
      href={href}
      onClick={(event) => {
        // A modified click (new tab and so on) keeps its usual meaning.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        const width = Math.min(1280, window.screen.availWidth);
        const height = Math.min(820, window.screen.availHeight);
        const left = Math.round((window.screen.availWidth - width) / 2);
        const top = Math.round((window.screen.availHeight - height) / 2);
        const opened = window.open(href, CLASS_WINDOW, `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
        // A blocked pop-up falls back to this window rather than doing nothing.
        if (opened) {
          event.preventDefault();
          opened.focus();
        }
      }}
    >
      {children}
    </a>
  );
}

/** On the end page, inside the class window: closes it and leaves the main window as it was. */
export function CloseClassWindow() {
  const [inWindow, setInWindow] = useState(false);
  useEffect(() => setInWindow(window.name === CLASS_WINDOW), []);
  if (!inWindow) return null;
  return (
    <button type="button" className="button-soft" onClick={() => window.close()}>
      Close this window
    </button>
  );
}
