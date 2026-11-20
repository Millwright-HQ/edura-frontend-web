import type { NotificationsDto } from '@edura/contracts';
import Link from 'next/link';
import { ActionButton } from '@/lib/action-form';
import { dateTime } from '@/lib/format';
import { callAsUser } from '@/lib/server';
import { getTimezone } from '@/lib/site';
import { IconTile, None, PageHead, Panel, Pill, Row } from '@/lib/ui';
import { markNotificationsRead } from '../v1-actions';

export default async function NotificationsPage() {
  const [result, tz] = await Promise.all([callAsUser<NotificationsDto>('comms', '/me/notifications'), getTimezone()]);
  const items = result.ok ? result.data.items : [];
  const unread = result.ok ? result.data.unread : 0;
  return (
    <>
      <PageHead title="Notifications" sub={`${unread} unread`}>
        {unread > 0 && <ActionButton action={markNotificationsRead} label="Mark all as read" className="button-quiet" />}
      </PageHead>
      <Panel>
        {items.length === 0 ? (
          <None>Nothing yet.</None>
        ) : (
          <div className="rows">
            {items.map((item, index) => (
              <Row
                key={item.id}
                lead={<IconTile name="bell" alt={index % 2 === 1} />}
                title={item.href ? <Link href={item.href}>{item.title}</Link> : item.title}
                sub={`${dateTime(item.at, tz)}${item.body ? ` · ${item.body}` : ''}`}
                end={item.unread ? <Pill tone="warn">New</Pill> : undefined}
              />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
