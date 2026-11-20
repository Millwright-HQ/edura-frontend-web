'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { ImagePurpose } from '@edura/contracts';
import { finishImage, startImage } from '@/app/tenant/media-actions';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;
const UPLOAD = 'M12 16V4M7 9l5-5 5 5M4 20h16';

/**
 * Picks an image by dropping it on the box or clicking the box, sends it straight to storage, and puts
 * the finished image's id in a hidden field so the surrounding form can save it. Nothing is saved until
 * the form is (a profile photo is saved as soon as it is sent, and the page refreshes).
 */
export function ImagePicker({
  name,
  purpose,
  label,
  current,
  currentUrl,
  refresh = false,
}: {
  name: string;
  purpose: ImagePurpose;
  label: string;
  current?: string | undefined;
  currentUrl?: string | undefined;
  refresh?: boolean;
}) {
  const router = useRouter();
  const [imageId, setImageId] = useState(current ?? '');
  const [preview, setPreview] = useState(currentUrl ?? '');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const local = useRef('');

  // A preview made from the person's own file is released when it is replaced or the box goes away.
  useEffect(() => () => {
    if (local.current) URL.revokeObjectURL(local.current);
  }, []);

  const round = purpose === 'person' || purpose === 'tutor';

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setState('error');
      setMessage('Choose a PNG, JPEG or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setState('error');
      setMessage('That image is over 5 MB. Choose a smaller one.');
      return;
    }
    setState('sending');
    setMessage('');
    try {
      const started = await startImage({ purpose, fileName: file.name, mimeType: file.type, size: file.size });
      if (!started.upload) throw new Error(started.error);
      const put = await fetch(started.upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('Upload failed');
      const finished = await finishImage(started.upload.imageId);
      if (!finished.imageId) throw new Error(finished.error);
      if (local.current) URL.revokeObjectURL(local.current);
      local.current = URL.createObjectURL(file);
      setImageId(finished.imageId);
      setPreview(local.current);
      setState('idle');
      if (refresh) router.refresh();
    } catch (failure) {
      setState('error');
      setMessage((failure as Error).message || 'Upload failed');
    }
  }

  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setOver(false);
    if (state !== 'sending') void pick(event.dataTransfer.files[0]);
  };

  return (
    <div className="field">
      <span>{label}</span>
      <label
        className={`photo-drop${round ? ' is-round' : ''}${over ? ' is-over' : ''}${state === 'sending' ? ' is-busy' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <span className="photo-frame">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" />
          ) : (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={UPLOAD} />
            </svg>
          )}
        </span>
        <span className="photo-text">
          <strong>{state === 'sending' ? 'Uploading…' : preview ? 'Drop a new image or click to replace' : 'Drop an image here or click to choose'}</strong>
          <small>PNG, JPEG or WebP, up to 5 MB.</small>
        </span>
        <input
          ref={input}
          type="file"
          accept={TYPES.join(',')}
          aria-label={label}
          disabled={state === 'sending'}
          onChange={(event) => {
            void pick(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
      {imageId && !refresh && state !== 'sending' && (
        <button
          type="button"
          className="button-quiet button-sm photo-remove"
          onClick={() => {
            setImageId('');
            setPreview('');
            setMessage('');
            setState('idle');
          }}
        >
          Remove image
        </button>
      )}
      <input type="hidden" name={name} value={imageId} />
      {state === 'error' && (
        <small className="photo-error" role="alert">
          {message}
        </small>
      )}
    </div>
  );
}
