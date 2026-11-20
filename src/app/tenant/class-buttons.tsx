import { PopOutLink } from './class-window';

/**
 * Two ways into a class, always side by side: inside Edura, or in the Zoom app. Which one a person prefers is
 * theirs to choose each time, so neither is hidden behind a setting.
 */
export function ClassButtons({
  kind,
  sessionId,
  part,
  parts,
  small = false,
  rejoin = false,
}: {
  kind: 'join' | 'host';
  sessionId: string;
  /** Set when the class is made of several meetings and this button is for one of them. */
  part?: number;
  parts?: number;
  small?: boolean;
  rejoin?: boolean;
}) {
  const route = kind === 'join' ? 'join-class' : 'host-class';
  const verb = kind === 'join' ? 'Join' : rejoin ? 'Rejoin' : 'Start';
  const what = part && parts && parts > 1 ? ` part ${part}` : ' class';
  const query = (via: 'web' | 'app') => `?via=${via}${part ? `&part=${part}` : ''}`;
  const size = small ? ' button-sm' : '';
  return (
    <span className="class-buttons">
      {/* Opens in its own window, so browsing the rest of Edura never drops the class. */}
      <PopOutLink className={`${kind === 'join' ? 'button-accent' : 'button'}${size}`} href={`/${route}/${sessionId}${query('web')}`}>
        {verb}
        {what} here
      </PopOutLink>
      <a className={`button-soft${size}`} href={`/${route}/${sessionId}${query('app')}`}>
        {verb}
        {what} in Zoom app
      </a>
    </span>
  );
}
