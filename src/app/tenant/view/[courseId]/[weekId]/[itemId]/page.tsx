import type { ContentAccessDto, ContinueWatchingDto, LearnerCourseDetailDto } from '@edura/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { callAsUser, getMe } from '@/lib/server';
import { Empty, Forbidden, IconTile, PageHead, Panel, Pill, Row } from '@/lib/ui';
import { saveProgress } from '../../../../academic-actions';
import { VideoPlayer } from './video-player';

export default async function ViewPage({
  params,
}: {
  params: Promise<{ courseId: string; weekId: string; itemId: string }>;
}) {
  const { courseId, weekId, itemId } = await params;
  const path = `/courses/${courseId}/weeks/${weekId}/items/${itemId}`;
  const [me, result] = await Promise.all([getMe(), callAsUser<ContentAccessDto>('academic', `${path}/access`)]);
  if (result.status === 403 && me.kind === 'student') {
    return (
      <div className="page">
        <Empty icon="shield" title="Your access to this has ended" body="Your student group has finished, so its course material is no longer available." heading="h1" />
      </div>
    );
  }
  if (result.status === 403) return <Forbidden what="this file" />;
  if (!result.ok) notFound();
  const { url, title, mimeType, canDownload, passcode } = result.data;
  const isStudent = me.kind === 'student';
  const back = isStudent ? `/learn/${courseId}` : `/courses/${courseId}?open=${weekId}`;
  const isVideo = mimeType.startsWith('video/');

  const [course, continuing] = isStudent
    ? await Promise.all([
        callAsUser<LearnerCourseDetailDto>('academic', `/me/courses/${courseId}`),
        callAsUser<ContinueWatchingDto[]>('academic', '/me/continue-watching'),
      ])
    : [null, null];
  const startAt = continuing?.ok ? (continuing.data.find((v) => v.itemId === itemId)?.positionSeconds ?? 0) : 0;
  const week = course?.ok ? course.data.weeks.find((w) => w.id === weekId) : undefined;
  const others = week?.items.filter((item) => item.id !== itemId) ?? [];
  const download = canDownload ? (
    <a className="button-soft" href={`/download/${courseId}/${weekId}/${itemId}`}>
      Download
    </a>
  ) : undefined;

  const viewer =
    mimeType === 'text/uri-list' ? (
      <Empty icon="video" title="Class recording" body="This recording is on Zoom. Use the passcode when Zoom asks for it.">
        <a className="button" href={url} target="_blank" rel="noreferrer">
          Open recording
        </a>
        {passcode && (
          <Pill tone="warn">
            Passcode: <span translate="no">{passcode}</span>
          </Pill>
        )}
      </Empty>
    ) : (
      <div className="player">
        {isVideo ? (
          <VideoPlayer src={url} allowDownload={canDownload} startAt={startAt} save={isStudent ? saveProgress.bind(null, courseId, weekId, itemId) : undefined} />
        ) : mimeType === 'application/pdf' ? (
          <iframe src={canDownload ? url : `${url}#toolbar=0`} title={title} />
        ) : mimeType === 'image/png' || mimeType === 'image/jpeg' ? (
          <img src={url} alt={title} />
        ) : (
          <Empty icon="file" title={title} body="This file type cannot be shown in the page. Download it to open it.">
            <a className="button" href={`/download/${courseId}/${weekId}/${itemId}`}>
              Download
            </a>
          </Empty>
        )}
      </div>
    );

  return (
    <>
      {/* A plain link: the file's short-lived address should not be kept in client state. */}
      <a className="crumb" href={back}>
        ‹ Back to {isStudent ? 'course' : 'week'}
      </a>
      {others.length > 0 ? (
        <div className="cols cols-main">
          <div className="section">
            {viewer}
            <div className="player-title">
              <h1>{title}</h1>
              {download}
            </div>
          </div>
          <Panel title="In this week">
            <div className="rows">
              {others.map((item, index) => (
                <Row
                  key={item.id}
                  lead={<IconTile name={item.mimeType.startsWith('video/') || item.type === 'recording' ? 'play' : 'file'} alt={index % 2 === 1} />}
                  title={<Link href={`/view/${courseId}/${weekId}/${item.id}`}>{item.title}</Link>}
                />
              ))}
            </div>
          </Panel>
        </div>
      ) : (
        <div className="section">
          {viewer}
          <PageHead title={title}>{download}</PageHead>
        </div>
      )}
    </>
  );
}
