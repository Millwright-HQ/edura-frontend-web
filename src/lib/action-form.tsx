'use client';

import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface FormState {
  error?: string;
  success?: string;
}

type Action = (previous: FormState, data: FormData) => Promise<FormState>;

/** Submitting through a transition keeps what the person typed when there is an error. */
function useSubmit(action: Action) {
  const [state, submit, pending] = useActionState(action, {});
  const send = (form: HTMLFormElement) => {
    const data = new FormData(form);
    startTransition(() => submit(data));
  };
  return { state, send, pending };
}

function Toast({ message, tone, onDone }: { message: string; tone?: 'error'; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, tone === 'error' ? 6000 : 3500);
    return () => clearTimeout(timer);
  }, [onDone, tone]);
  return (
    <div className={`toast${tone === 'error' ? ' toast-error' : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {message}
    </div>
  );
}

/** A form that lives on the page: sign-in, sign-up and the public contact form. */
export function ActionForm({
  action,
  submitLabel,
  children,
  submitClassName = 'button button-lg button-block',
}: {
  action: Action;
  submitLabel: string;
  children?: ReactNode;
  submitClassName?: string;
}) {
  const { state, send, pending } = useSubmit(action);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) form.current?.reset();
  }, [state]);

  return (
    <form
      ref={form}
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        send(event.currentTarget);
      }}
    >
      {children}
      {state.error && (
        <p className="notice notice-error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="notice notice-success" role="status">
          {state.success}
        </p>
      )}
      <button className={submitClassName} type="submit" disabled={pending}>
        {pending ? 'Please wait…' : submitLabel}
      </button>
    </form>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function ModalFields({
  action,
  title,
  description,
  submitLabel,
  submitClassName,
  confirmWord,
  headingId,
  onClose,
  onDone,
  children,
}: {
  action: Action;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  submitClassName: string;
  confirmWord?: string | undefined;
  headingId: string;
  onClose: () => void;
  onDone: (message?: string) => void;
  children?: ReactNode;
}) {
  const { state, send, pending } = useSubmit(action);
  const first = useRef(state);
  const [typed, setTyped] = useState('');

  // Anything but an error means it worked: the pop-up closes itself.
  useEffect(() => {
    if (state !== first.current && !state.error) onDone(state.success);
  }, [state, onDone]);

  const waiting = confirmWord !== undefined && typed.trim() !== confirmWord;
  return (
    <form
      className="modal-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!waiting) send(event.currentTarget);
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>
      {(children || confirmWord || state.error) && (
        <div className="modal-body">
          {children}
          {confirmWord && (
            <label className="field">
              <span>Type {confirmWord} to confirm</span>
              <input autoComplete="off" value={typed} onChange={(event) => setTyped(event.target.value)} />
            </label>
          )}
          {state.error && (
            <p className="notice notice-error" role="alert">
              {state.error}
            </p>
          )}
        </div>
      )}
      <div className="modal-foot">
        <button className="button-quiet" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className={submitClassName} type="submit" disabled={pending || waiting}>
          {pending ? 'Please wait…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Every in-app form: a button opens the pop-up, and a successful submit closes it. */
export function ModalForm({
  label,
  buttonClassName = 'button',
  title,
  description,
  action,
  submitLabel,
  submitClassName = 'button',
  confirmWord,
  wide,
  children,
}: {
  label: ReactNode;
  buttonClassName?: string;
  title: string;
  description?: ReactNode;
  action: Action;
  submitLabel: string;
  submitClassName?: string;
  /** For actions that can't be undone: the person must type this word first. */
  confirmWord?: string;
  wide?: boolean;
  children?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [round, setRound] = useState(0);
  const [toast, setToast] = useState('');
  const close = () => dialog.current?.close();
  const clearToast = useRef(() => setToast('')).current;
  const finish = useRef((message?: string) => {
    dialog.current?.close();
    setRound((value) => value + 1);
    if (message) setToast(message);
  }).current;

  return (
    <>
      <button className={buttonClassName} type="button" onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={dialog}
        className={`modal${wide ? ' modal-wide' : ''}`}
        aria-labelledby={headingId}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
      >
        <ModalFields
          key={round}
          action={action}
          title={title}
          description={description}
          submitLabel={submitLabel}
          submitClassName={submitClassName}
          confirmWord={confirmWord}
          headingId={headingId}
          onClose={close}
          onDone={finish}
        >
          {children}
        </ModalFields>
      </dialog>
      {toast && <Toast message={toast} onDone={clearToast} />}
    </>
  );
}

/** A pop-up with no form of its own, such as a list to pick from. */
export function Modal({
  label,
  buttonClassName = 'button-quiet',
  title,
  description,
  wide,
  children,
}: {
  label: ReactNode;
  buttonClassName?: string;
  title: string;
  description?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  return (
    <>
      <button className={buttonClassName} type="button" onClick={() => dialog.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={dialog}
        className={`modal${wide ? ' modal-wide' : ''}`}
        aria-labelledby={headingId}
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="modal-head">
          <div>
            <h2 id={headingId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={() => dialog.current?.close()}>
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </dialog>
    </>
  );
}

/** One click with nothing to fill in, such as Mark paid. Problems appear as a toast. */
export function ActionButton({
  action,
  label,
  className = 'button-quiet button-sm',
}: {
  action: Action;
  label: string;
  className?: string;
}) {
  const { state, send, pending } = useSubmit(action);
  const [dismissed, setDismissed] = useState<FormState | null>(null);
  const clear = useRef(() => setDismissed(null));
  useEffect(() => {
    clear.current = () => setDismissed(state);
  }, [state]);
  const showing = state.error && dismissed !== state;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        send(event.currentTarget);
      }}
    >
      <button className={className} type="submit" disabled={pending}>
        {pending ? 'Please wait…' : label}
      </button>
      {showing && <Toast message={state.error!} tone="error" onDone={() => clear.current()} />}
    </form>
  );
}

/** Narrows a long list inside a pop-up without a page reload. */
export function FilterList({
  placeholder,
  items,
  empty,
}: {
  placeholder: string;
  items: { key: string; text: string; node: ReactNode }[];
  empty: string;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = items.filter((item) => item.text.toLowerCase().includes(needle));
  return (
    <>
      <input aria-label={placeholder} placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} />
      {shown.length === 0 ? <p className="muted">{empty}</p> : <div className="rows">{shown.map((item) => <div key={item.key}>{item.node}</div>)}</div>}
    </>
  );
}

/**
 * Pick several things with tick boxes, then submit once. Put it inside a ModalForm; the ticked values are sent
 * under `name`. Replaces a row of "Add" buttons, one per item.
 */
export function CheckList({
  name,
  placeholder,
  items,
  empty,
}: {
  name: string;
  placeholder: string;
  items: { key: string; text: string; node: ReactNode }[];
  empty: string;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const needle = query.trim().toLowerCase();
  const shown = items.filter((item) => item.text.toLowerCase().includes(needle));
  const toggle = (key: string, on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  // "Select all" acts on what the search shows, so a search narrows who gets ticked.
  const setShown = (on: boolean) =>
    setPicked((current) => {
      const next = new Set(current);
      for (const item of shown) {
        if (on) next.add(item.key);
        else next.delete(item.key);
      }
      return next;
    });
  if (items.length === 0) return <p className="muted">{empty}</p>;
  return (
    <>
      <input aria-label={placeholder} placeholder={placeholder} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="picklist-bar">
        <span className="muted small">{picked.size} selected</span>
        <span className="picklist-links">
          <button type="button" className="link-button" onClick={() => setShown(true)}>
            Select all{needle ? ' shown' : ''}
          </button>
          <button type="button" className="link-button" onClick={() => setPicked(new Set())} disabled={picked.size === 0}>
            Select none
          </button>
        </span>
      </div>
      {shown.length === 0 ? (
        <p className="muted">Nobody matches that search.</p>
      ) : (
        <div className="rows picklist">
          {shown.map((item) => (
            <label key={item.key} className="picklist-item">
              <input type="checkbox" checked={picked.has(item.key)} onChange={(event) => toggle(item.key, event.target.checked)} />
              <span className="picklist-body">{item.node}</span>
            </label>
          ))}
        </div>
      )}
      {/* Ticked items stay in the form even while a search hides them. */}
      {[...picked].map((key) => (
        <input key={key} type="hidden" name={name} value={key} />
      ))}
    </>
  );
}
