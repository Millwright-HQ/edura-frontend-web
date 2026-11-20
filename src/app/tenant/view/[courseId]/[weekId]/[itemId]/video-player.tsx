'use client';

import { useEffect, useRef } from 'react';

const SAVE_EVERY_SECONDS = 15;

/** Plays a video and, for students, remembers the position for Continue watching. */
export function VideoPlayer({
  src,
  startAt,
  save,
  allowDownload = false,
}: {
  src: string;
  startAt: number;
  allowDownload?: boolean;
  save?: ((positionSeconds: number, durationSeconds: number) => Promise<void>) | undefined;
}) {
  const lastSaved = useRef(startAt);
  const element = useRef<HTMLVideoElement>(null);
  const resumed = useRef(false);

  /** The browser can finish loading before React attaches, so both paths try to resume. */
  const resume = () => {
    const video = element.current;
    if (!video || resumed.current || video.readyState < 1) return;
    resumed.current = true;
    if (startAt > 0) video.currentTime = startAt;
  };
  useEffect(resume, []);

  const record = (video: HTMLVideoElement) => {
    if (save && Number.isFinite(video.duration) && video.duration > 0) {
      lastSaved.current = video.currentTime;
      void save(video.currentTime, video.duration).catch(() => undefined);
    }
  };

  return (
    <video
      ref={element}
      src={src}
      controls
      controlsList={allowDownload ? undefined : 'nodownload'}
      preload="metadata"
      onLoadedMetadata={resume}
      onTimeUpdate={(event) => {
        if (Math.abs(event.currentTarget.currentTime - lastSaved.current) >= SAVE_EVERY_SECONDS) record(event.currentTarget);
      }}
      onPause={(event) => record(event.currentTarget)}
      onEnded={(event) => record(event.currentTarget)}
    />
  );
}
