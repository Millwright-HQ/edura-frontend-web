import type { ContentAccessDto, ContentItemDto } from '@edura/contracts';
import { callAsUser } from '@/lib/server';
import { Pill } from '@/lib/ui';
import { saveProgress } from '../../academic-actions';
import { VideoPlayer } from '../../view/[courseId]/[weekId]/[itemId]/video-player';

/** One piece of course material, shown in place on the course page: playable, readable and downloadable. */
export async function ItemViewer({
  courseId,
  weekId,
  item,
  startAt,
  label,
  tone,
}: {
  courseId: string;
  weekId: string;
  item: ContentItemDto;
  startAt: number;
  label: string;
  tone: 'good' | 'warn';
}) {
  const result = await callAsUser<ContentAccessDto>('academic', `/courses/${courseId}/weeks/${weekId}/items/${item.id}/access`);
  const download = `/download/${courseId}/${weekId}/${item.id}`;
  const head = (canDownload: boolean) => (
    <div className="item-head">
      <h3>{item.title}</h3>
      <Pill tone={tone}>{label}</Pill>
      {canDownload && (
        <a className="button-soft" href={download}>
          Download
        </a>
      )}
    </div>
  );

  if (!result.ok) {
    return (
      <article className="item-card">
        {head(false)}
        <p className="muted small">This file could not be loaded right now. Reload the page to try again.</p>
      </article>
    );
  }
  const { url, mimeType, canDownload, passcode, title } = result.data;
  let body;
  if (mimeType === 'text/uri-list') {
    body = (
      <div className="item-link">
        <a className="button" href={url} target="_blank" rel="noreferrer">
          Open recording
        </a>
        {passcode && (
          <Pill tone="warn">
            Passcode: <span translate="no">{passcode}</span>
          </Pill>
        )}
      </div>
    );
  } else if (mimeType.startsWith('video/')) {
    body = (
      <div className="player">
        <VideoPlayer src={url} startAt={startAt} allowDownload={canDownload} save={saveProgress.bind(null, courseId, weekId, item.id)} />
      </div>
    );
  } else if (mimeType === 'application/pdf') {
    body = (
      <div className="player">
        <iframe src={canDownload ? url : `${url}#toolbar=0`} title={title} />
      </div>
    );
  } else if (mimeType === 'image/png' || mimeType === 'image/jpeg') {
    body = (
      <div className="player">
        <img src={url} alt={title} />
      </div>
    );
  } else {
    body = <p className="muted small">This file type cannot be shown in the browser. {canDownload ? 'Use Download to open it.' : ''}</p>;
  }
  return (
    <article className="item-card" id={`item-${item.id}`}>
      {head(canDownload)}
      {body}
    </article>
  );
}
