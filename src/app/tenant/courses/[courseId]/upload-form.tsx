'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { finishUpload, partUrls, startUpload } from '@/app/tenant/academic-actions';
import { FileDrop } from '@/lib/client-ui';

/** The file goes straight from the browser to storage, so large videos never pass through the app. */
function putFile(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Upload failed'));
    request.onerror = () => reject(new Error('Upload failed'));
    request.send(file);
  });
}

const PART_RETRIES = 3;
const PARALLEL_PARTS = 3;

function putPart(url: string, blob: Blob, onBytes: (sent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    request.upload.onprogress = (event) => onBytes(event.loaded);
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error('Part failed')));
    request.onerror = () => reject(new Error('Part failed'));
    request.send(blob);
  });
}

/** A large file goes up in numbered parts, a few at a time, each retried on its own. */
async function putInParts(
  courseId: string,
  weekId: string,
  itemId: string,
  file: File,
  plan: { partSize: number; parts: number },
  onProgress: (percent: number) => void,
) {
  const sent = new Array<number>(plan.parts + 1).fill(0);
  const report = () => onProgress(Math.round((sent.reduce((a, b) => a + b, 0) / file.size) * 100));
  let next = 1;
  async function worker() {
    for (let number = next++; number <= plan.parts; number = next++) {
      const blob = file.slice((number - 1) * plan.partSize, number * plan.partSize);
      for (let attempt = 1; ; attempt++) {
        try {
          const asked = await partUrls(courseId, weekId, itemId, [number]);
          if (!asked.urls) throw new Error(asked.error);
          await putPart(asked.urls[0]!.url, blob, (loaded) => {
            sent[number] = loaded;
            report();
          });
          sent[number] = blob.size;
          report();
          break;
        } catch (failure) {
          sent[number] = 0;
          if (attempt >= PART_RETRIES) throw failure;
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, plan.parts) }, worker));
}

export function UploadForm({ courseId, weekId }: { courseId: string; weekId: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [round, setRound] = useState(0);
  const [type, setType] = useState('notes');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get('file') as File;
    setError('');
    setProgress(0);
    try {
      const started = await startUpload(courseId, weekId, {
        type,
        title: String(data.get('title')).trim(),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      });
      if (!started.upload) throw new Error(started.error);
      if (started.upload.multipart) {
        await putInParts(courseId, weekId, started.upload.itemId, file, started.upload.multipart, setProgress);
      } else {
        await putFile(started.upload.uploadUrl!, file, setProgress);
      }
      const finished = await finishUpload(courseId, weekId, started.upload.itemId);
      if (finished.error) throw new Error(finished.error);
      dialog.current?.close();
      setRound((value) => value + 1);
      router.refresh();
    } catch (failure) {
      setError((failure as Error).message || 'Upload failed');
    } finally {
      setProgress(null);
    }
  }

  const uploading = progress !== null;
  const close = () => {
    if (!uploading) dialog.current?.close();
  };
  return (
    <>
      <button className="button" type="button" onClick={() => dialog.current?.showModal()}>
        Upload a file
      </button>
      <dialog ref={dialog} className="modal" aria-label="Upload a file" onClick={(event) => event.target === dialog.current && close()}>
        <form key={round} className="modal-form" onSubmit={submit}>
          <div className="modal-head">
            <div>
              <h2>Upload a file</h2>
              <p>Any file type. Videos, PDFs and images open in the page; other files download.</p>
            </div>
          </div>
          <div className="modal-body">
            <div className="form-grid">
              <label className="field">
                <span>Type</span>
                <select value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="notes">Class notes</option>
                  <option value="resource">Resource / attachment</option>
                  <option value="recording">Lecture recording</option>
                  <option value="video">Video</option>
                </select>
              </label>
              <label className="field">
                <span>Title</span>
                <input name="title" required maxLength={160} autoComplete="off" />
              </label>
            </div>
            <div className="field">
              <span>File</span>
              <FileDrop name="file" hint="Any file, any size" />
            </div>
            {uploading && <progress value={progress} max={100} aria-label="Upload progress" />}
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-foot">
            <button className="button-quiet" type="button" onClick={close} disabled={uploading}>
              Cancel
            </button>
            <button className="button" type="submit" disabled={uploading}>
              {uploading ? `Uploading ${progress}%` : 'Upload'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
