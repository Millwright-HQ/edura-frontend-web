'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';

const SUN = 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4';
const MOON = 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z';
const EYE = 'M2 12s4-7 10-7s10 7 10 7s-4 7-10 7s-10-7-10-7zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z';
const MENU = 'M4 6h16M4 12h16M4 18h16';

function Glyph({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The chosen mode lives in a cookie, so the server paints the right colours first time. */
export function ThemeToggle({ initial }: { initial: 'light' | 'dark' }) {
  const [theme, setTheme] = useState(initial);
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `edura-theme=${next}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <button className="icon-button" type="button" onClick={flip} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
      <Glyph d={theme === 'dark' ? SUN : MOON} />
    </button>
  );
}

const isCurrent = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

export interface NavItem {
  href: string;
  label: string;
}

export function TopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="top-nav" aria-label="Main">
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function RailNav({ brand, groups, foot }: { brand: ReactNode; groups: { name: string; items: NavItem[] }[]; foot: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className={`rail${open ? ' is-open' : ''}`}>
      {brand}
      <button className="icon-button rail-toggle" type="button" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((value) => !value)}>
        <Glyph d={MENU} />
      </button>
      <nav className="rail-groups" aria-label="Main">
        {groups.map((group) => (
          <div className="rail-group" key={group.name}>
            <span>{group.name}</span>
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? 'page' : undefined} onClick={() => setOpen(false)}>
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="rail-foot">{foot}</div>
    </aside>
  );
}

export function PasswordInput({ name, autoComplete, required = true }: { name: string; autoComplete?: string | undefined; required?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="password">
      <input name={name} type={shown ? 'text' : 'password'} autoComplete={autoComplete} required={required} />
      <button type="button" aria-label={shown ? 'Hide password' : 'Show password'} onClick={() => setShown((value) => !value)}>
        <Glyph d={EYE} />
      </button>
    </div>
  );
}

/** A file picker with a drop area. The input stays real, so it submits with the form. */
export function FileDrop({ name, accept, hint, required = true, onPick }: { name: string; accept?: string | undefined; hint: string; required?: boolean; onPick?: (file: File | null) => void }) {
  const [fileName, setFileName] = useState('');
  const [over, setOver] = useState(false);
  return (
    <label className={`dropzone${over ? ' is-over' : ''}`} onDragEnter={() => setOver(true)} onDragLeave={() => setOver(false)} onDrop={() => setOver(false)}>
      <Glyph d="M12 16V4M7 9l5-5 5 5M4 20h16" size={26} />
      <span>{fileName || <>Drop a file here or <em>browse</em></>}</span>
      <small>{hint}</small>
      <input
        name={name}
        type="file"
        accept={accept}
        required={required}
        aria-label="Choose a file"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          setFileName(file?.name ?? '');
          onPick?.(file);
        }}
      />
    </label>
  );
}

const LOGOUT = 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10';

/** The sign-out button never signs anyone out by itself: it asks first. */
export function ConfirmSignOut({ action }: { action: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button className="icon-button" type="button" aria-label="Sign out" onClick={() => dialog.current?.showModal()}>
        <Glyph d={LOGOUT} />
      </button>
      <dialog
        ref={dialog}
        className="modal"
        aria-labelledby="signout-title"
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
      >
        <form className="modal-form" action={action}>
          <div className="modal-head">
            <div>
              <h2 id="signout-title">Sign out?</h2>
              <p>You will need to sign in again to get back in.</p>
            </div>
          </div>
          <div className="modal-foot">
            <button className="button-quiet" type="button" autoFocus onClick={() => dialog.current?.close()}>
              Stay signed in
            </button>
            <button className="button" type="submit">
              Sign out
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
