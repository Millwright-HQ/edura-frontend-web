'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import { FileDrop } from '@/lib/client-ui';
import { finishReceiptUpload, startReceiptUpload } from '../v1-actions';

export function ReceiptUpload({ invoiceId, number, again }: { invoiceId: string; number: string; again: boolean }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = new FormData(event.currentTarget).get('receipt') as File;
    setBusy(true);
    setError('');
    try {
      const started = await startReceiptUpload(invoiceId, { fileName: file.name, mimeType: file.type, size: file.size });
      if (!started.uploadUrl) throw new Error(started.error);
      const put = await fetch(started.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!put.ok) throw new Error('Upload failed');
      const finished = await finishReceiptUpload(invoiceId);
      if (finished.error) throw new Error(finished.error);
      dialog.current?.close();
      setRound((value) => value + 1);
      router.refresh();
    } catch (failure) {
      setError((failure as Error).message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    if (!busy) dialog.current?.close();
  };
  return (
    <>
      <button className="button button-sm" type="button" onClick={() => dialog.current?.showModal()}>
        {again ? 'Upload again' : 'Pay'}
      </button>
      <dialog ref={dialog} className="modal" aria-label="Upload your receipt" onClick={(event) => event.target === dialog.current && close()}>
        <form key={round} className="modal-form" onSubmit={upload}>
          <div className="modal-head">
            <div>
              <h2>Upload your receipt</h2>
              <p>{number}. The academy will check it and mark the invoice paid.</p>
            </div>
          </div>
          <div className="modal-body">
            <FileDrop name="receipt" accept="application/pdf,image/png,image/jpeg" hint="PDF, PNG or JPEG, up to 10 MB" />
            {error && (
              <p className="notice notice-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="modal-foot">
            <button className="button-quiet" type="button" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button className="button" type="submit" disabled={busy}>
              {busy ? 'Uploading…' : 'Upload receipt'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
