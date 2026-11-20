import type { ReactNode } from 'react';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import type { DemoProfileDto } from '@edura/contracts';
import { logout, switchProfile } from '@/app/actions';
import { getLogoUrl } from './site';
import { ConfirmSignOut, RailNav, PasswordInput, ThemeToggle, TopNav, type NavItem } from './client-ui';
import { callService, type Me } from './server';

export type Theme = 'light' | 'dark';

export async function getTheme(): Promise<Theme> {
  return (await cookies()).get('edura-theme')?.value === 'dark' ? 'dark' : 'light';
}

export const ICONS = {
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a2 2 0 0 0 3.4 0',
  play: 'M7 4l14 8-14 8z',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8',
  video: 'M3 6h13a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM17 10l5-3v10l-5-3',
  calendar: 'M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 10h18M8 3v4M16 3v4',
  users: 'M9 11a4 4 0 1 0 0-8a4 4 0 1 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.2a4 4 0 0 1 0 7.6M22 21v-1a6 6 0 0 0-4-5.6',
  card: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM2 10h20M6 15h4',
  mega: 'M3 11v3l14 5V6zM17 9a3 3 0 0 1 0 6M7 15.5v3a2 2 0 0 0 4 0v-1.2',
  check: 'M4 12l5 5L20 6',
  globe: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM2 12h20M12 2c3 3 4 6.5 4 10s-1 7-4 10c-3-3-4-6.5-4-10s1-7 4-10z',
  shield: 'M12 2l8 3v6c0 5-3.5 9-8 11c-4.5-2-8-6-8-11V5z',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h10',
} as const;

export function Icon({ name, size = 20 }: { name: keyof typeof ICONS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

export function Mark({ size = 34, stroke = 'var(--rail-mark)' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 20H32A12 12 0 1 0 26 30.4" fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="round" />
      <path d="M30 31a3 3 0 1 0 6 0a3 3 0 1 0-6 0z" fill="var(--accent)" />
    </svg>
  );
}

/**
 * Edura's own mark always stays. On an academy's pages it reads "Edura × the academy": the academy's logo (when it
 * has one) and name come after the cross, so people can see the page is run on Edura.
 */
export async function Brand({ name = 'Edura', tag, href = '/', size, stroke }: { name?: string; tag?: string; href?: string; size?: number; stroke?: string }) {
  const logo = name === 'Edura' ? undefined : await getLogoUrl();
  const academy = name !== 'Edura';
  return (
    <Link className="brand" href={href}>
      <Mark {...(size ? { size } : {})} {...(stroke ? { stroke } : {})} />
      {academy && (
        <>
          <span className="brand-edura">Edura</span>
          <span className="brand-x" aria-hidden="true">
            ×
          </span>
        </>
      )}
      {logo && <img className="brand-logo" src={logo} alt="" style={size ? { height: size } : undefined} />}
      <span className="brand-name">
        {name}
        {tag && <small className="brand-tag">{tag}</small>}
      </span>
    </Link>
  );
}

export function Field({
  label,
  name,
  type = 'text',
  autoComplete = 'off',
  hint,
  pattern,
  step,
  placeholder,
  defaultValue,
  required = true,
  min,
  max,
  maxLength,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  hint?: string;
  pattern?: string;
  step?: string;
  placeholder?: string;
  defaultValue?: string | number | undefined;
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {type === 'password' ? (
        <PasswordInput name={name} autoComplete={autoComplete} required={required} />
      ) : (
        <input
          name={name}
          type={type}
          autoComplete={autoComplete}
          pattern={pattern}
          step={step}
          placeholder={placeholder}
          defaultValue={defaultValue}
          required={required}
          min={min}
          max={max}
          maxLength={maxLength}
        />
      )}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function TextArea({ label, name, rows = 4, defaultValue, required = true, maxLength }: { label: string; name: string; rows?: number; defaultValue?: string | undefined; required?: boolean; maxLength?: number }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea name={name} rows={rows} defaultValue={defaultValue} required={required} maxLength={maxLength} />
    </label>
  );
}

export function Select({ label, name, options, defaultValue, required = true }: { label: string; name: string; options: { value: string; label: string }[]; defaultValue?: string; required?: boolean }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue} required={required}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Toggle({ label, name, hint, defaultChecked }: { label: string; name: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <label className="switch">
      <span className="switch-text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}

export function Checks({ label, name, options, selected = [] }: { label: string; name: string; options: { value: string; label: string }[]; selected?: string[] }) {
  return (
    <fieldset className="field">
      <legend className="check-label">{label}</legend>
      <div className="check-grid">
        {options.map((option) => (
          <label className="check" key={option.value}>
            <input type="checkbox" name={name} value={option.value} defaultChecked={selected.includes(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FormSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="form-section">
      <h3>{title}</h3>
      {note && <p>{note}</p>}
      {children}
    </section>
  );
}

export function PageHead({ title, sub, back, children }: { title: ReactNode; sub?: ReactNode; back?: { href: string; label: string }; children?: ReactNode }) {
  return (
    <header className="page-head">
      <div>
        {back && (
          <Link className="crumb" href={back.href}>
            ‹ {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </header>
  );
}

export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-head">
          {title && <h2>{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ value, label, tone, href }: { value: ReactNode; label: string; tone?: 'primary' | 'soft' | 'tint' | 'accent'; href?: string }) {
  const className = `stat${tone ? ` tone-${tone}` : ''}`;
  const content = (
    <>
      <strong>{value}</strong>
      <span>{label}</span>
    </>
  );
  return href ? (
    <Link className={className} href={href}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function Pill({ tone = 'good', children }: { tone?: 'good' | 'warn' | 'bad' | 'off' | 'solid'; children: ReactNode }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function Tabs({ label, items }: { label: string; items: { href: string; label: string; current: boolean }[] }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((item) => (
        <Link key={item.href} href={item.href} aria-current={item.current ? 'page' : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export const initialsOf = (first: string, last = '') => `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

export function Avatar({ first, last, small }: { first: string; last?: string; small?: boolean }) {
  return <span className={`avatar${small ? ' avatar-sm' : ''}`}>{initialsOf(first, last)}</span>;
}

export function IconTile({ name, alt }: { name: keyof typeof ICONS; alt?: boolean }) {
  return (
    <span className={`icon-tile${alt ? ' icon-tile-alt' : ''}`}>
      <Icon name={name} />
    </span>
  );
}

export function Row({ lead, title, sub, end, className = '' }: { lead?: ReactNode; title: ReactNode; sub?: ReactNode; end?: ReactNode; className?: string }) {
  return (
    <div className={`row ${className}`}>
      {lead}
      <div className="row-main">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </div>
      {end && <div className="row-end">{end}</div>}
    </div>
  );
}

export function Empty({ icon, title, body, children, heading = 'h2' }: { icon: keyof typeof ICONS; title: string; body?: string; children?: ReactNode; heading?: 'h1' | 'h2' }) {
  const Heading = heading;
  return (
    <div className="empty">
      <span className="empty-tile">
        <Icon name={icon} size={32} />
      </span>
      <Heading>{title}</Heading>
      {body && <p>{body}</p>}
      {children && <div className="actions">{children}</div>}
    </div>
  );
}

export const None = ({ children }: { children: ReactNode }) => <p className="empty-inline">{children}</p>;

export const Forbidden = ({ what }: { what: string }) => (
  <div className="page">
    <Empty icon="shield" title="You don't have access" body={`Your role does not include ${what}.`} heading="h1" />
  </div>
);

/** A readable text colour for the academy's chosen brand colour. */
function inkFor(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const linear = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return luminance > 0.4 ? '#17163a' : '#ffffff';
}

/** Applies an academy's colour in light mode. Dark mode keeps Edura's tested palette. */
export function BrandStyle({ color }: { color?: string | undefined }) {
  if (!color || !/^#[0-9a-fA-F]{6}$/.test(color) || color.toLowerCase() === '#4a3ae8') return null;
  const css = `:root[data-theme='light']{--primary:${color};--primary-ink:${inkFor(color)};--brand:${color};--link:${color};--rail-mark:${color};}`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

export async function getDemoProfiles(): Promise<DemoProfileDto[]> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '';
  const result = await callService<DemoProfileDto[]>('identity', `/auth/demo-profiles?host=${encodeURIComponent(host)}`);
  return result.ok ? result.data : [];
}

const LABEL: Record<string, string> = { admin: 'Admin', parent: 'Parent', student: 'Student' };
const profileOf = (kind: string) => (kind === 'parent' || kind === 'student' ? kind : 'admin');

function ProfileSwitcher({ profiles, current }: { profiles: DemoProfileDto[]; current: string }) {
  if (profiles.length === 0) return null;
  const order = ['student', 'parent', 'admin'];
  return (
    <div className="switcher" role="group" aria-label="Switch profile">
      {[...profiles]
        .sort((a, b) => order.indexOf(a.profile) - order.indexOf(b.profile))
        .map((profile) => (
          <form key={profile.profile} action={switchProfile.bind(null, profile.profile)}>
            <button type="submit" aria-pressed={profile.profile === profileOf(current)}>
              <Avatar first={profile.firstName} last={profile.lastName} small />
              {LABEL[profile.profile]}
            </button>
          </form>
        ))}
    </div>
  );
}

function SignOutIcon() {
  return <ConfirmSignOut action={logout} />;
}

function Bell({ unread }: { unread: number }) {
  return (
    <Link className="icon-button" href="/notifications" aria-label={`Notifications, ${unread} unread`}>
      <Icon name="bell" />
      {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}

/** Student and parent layout: everything in one top bar, like a streaming app. */
export async function TopShell({ site, me, nav, unread, children }: { site: string; me: Me; nav: NavItem[]; unread: number; children: ReactNode }) {
  const [theme, profiles] = await Promise.all([getTheme(), getDemoProfiles()]);
  return (
    <>
      <header className="topbar">
        <Brand name={site} size={32} stroke="var(--primary)" />
        <TopNav items={nav} />
        <div className="topbar-end">
          <ThemeToggle initial={theme} />
          <Bell unread={unread} />
          <ProfileSwitcher profiles={profiles} current={me.kind} />
          <SignOutIcon />
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}

/** Staff layout, shared by academies and the platform. */
export async function ConsoleShell({
  site,
  caption,
  me,
  groups,
  unread,
  search,
  platform,
  children,
}: {
  site: string;
  caption: string;
  me: Me;
  groups: { name: string; items: NavItem[] }[];
  unread?: number;
  search?: { action: string; name: string; placeholder: string } | undefined;
  platform?: boolean;
  children: ReactNode;
}) {
  const [theme, profiles] = await Promise.all([getTheme(), platform ? Promise.resolve([]) : getDemoProfiles()]);
  return (
    <div className={`console${platform ? ' console-platform' : ''}`}>
      <RailNav
        brand={<Brand name={site} tag={caption} size={32} />}
        groups={groups.filter((group) => group.items.length > 0)}
        foot={
          <>
            <span>
              {me.firstName} {me.lastName}
            </span>
            <small>{me.email}</small>
          </>
        }
      />
      <div>
        <header className="topbar">
          {search && (
            <form className="topbar-search" action={search.action} role="search">
              <input type="search" name={search.name} placeholder={search.placeholder} aria-label={search.placeholder} />
            </form>
          )}
          <div className="topbar-end">
            <ThemeToggle initial={theme} />
            {unread !== undefined && <Bell unread={unread} />}
            <ProfileSwitcher profiles={profiles} current={me.kind} />
            <SignOutIcon />
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}

/** Sign-in, sign-up and every other page a visitor reaches before they have a session. */
export async function AuthLayout({ site, title, sub, headline, lead, children }: { site: string; title: string; sub?: ReactNode; headline: string; lead: string; children: ReactNode }) {
  const theme = await getTheme();
  return (
    <div className="auth">
      <aside className="auth-brand">
        <svg className="auth-watermark" viewBox="0 0 40 40" aria-hidden="true">
          <path d="M8 20H32A12 12 0 1 0 26 30.4" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <Brand name={site} size={40} stroke="#fff" />
        <div>
          <h2>{headline}</h2>
          <p>{lead}</p>
        </div>
        <div className="auth-tiles" aria-hidden="true">
          <span style={{ background: '#ff7a50', color: '#17163a' }}>x²</span>
          <span style={{ background: '#fff', color: '#3527c4' }}>Aa</span>
          <span style={{ background: '#ffe7de', color: '#8f2f0e', fontSize: 21 }}>H₂O</span>
          <span style={{ background: '#eceafe', color: '#3527c4' }}>∑</span>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-panel">
          <div className="auth-top">
            <ThemeToggle initial={theme} />
          </div>
          <div className="auth-panel-head">
            <h1>{title}</h1>
            {sub && <p className="muted">{sub}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

export async function SiteLayout({ brand, signInHref = '/login', ctaHref, ctaLabel, footer, color, children }: { brand: string; signInHref?: string; ctaHref: string; ctaLabel: string; footer: string; color?: string | undefined; children: ReactNode }) {
  const theme = await getTheme();
  return (
    <div className="site">
      <BrandStyle color={color} />
      <header className="site-header">
        <Brand name={brand} stroke="var(--primary)" />
        <div className="actions">
          <ThemeToggle initial={theme} />
          <Link className="button-quiet" href={signInHref}>
            Sign in
          </Link>
          <Link className="button" href={ctaHref}>
            {ctaLabel}
          </Link>
        </div>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">{footer}</footer>
    </div>
  );
}
