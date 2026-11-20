import type { FeedbackDto } from '@edura/contracts';
import { ActionButton, ModalForm } from '@/lib/action-form';
import { callAsUser, getMe } from '@/lib/server';
import { Field, Forbidden, IconTile, None, PageHead, Panel, Pill, Row, TextArea, Toggle } from '@/lib/ui';
import { createFeedback, deleteFeedback, setFeedbackPublished } from '../v1-actions';

export default async function FeedbackPage({ searchParams }: { searchParams: Promise<{ year?: string; search?: string }> }) {
  const [me, params] = await Promise.all([getMe(), searchParams]);
  const query = new URLSearchParams();
  if (/^\d{4}$/.test(params.year ?? '')) query.set('year', params.year!);
  if (params.search) query.set('search', params.search);
  const result = await callAsUser<FeedbackDto[]>('comms', `/feedback?${query}`);
  if (result.status === 403) return <Forbidden what="feedback" />;
  const can = (action: string) => me.permissions.includes(`tenant.feedback.${action}`);
  const items = result.ok ? result.data : [];

  return (
    <>
      <PageHead title="Feedback" sub="Published quotes appear on your website.">
        {can('create') && (
          <ModalForm label="Add feedback" title="Add feedback" action={createFeedback} submitLabel="Add">
            <div className="form-grid">
              <Field label="Student name" name="studentName" />
              <Field label="Year" name="year" type="number" min={2000} max={2100} defaultValue={new Date().getFullYear()} />
            </div>
            <TextArea label="What they said" name="quote" rows={3} maxLength={1000} />
            <Toggle label="Publish on the website" name="published" hint="Visitors will see this quote." />
          </ModalForm>
        )}
      </PageHead>
      <div className="toolbar">
        <form className="search" action="/feedback">
          <input name="search" defaultValue={params.search} placeholder="Search" aria-label="Search feedback" />
          <input name="year" type="number" defaultValue={params.year} placeholder="Year" aria-label="Year" />
          <button className="button-quiet" type="submit">
            Filter
          </button>
        </form>
      </div>
      <Panel>
        {items.length === 0 ? (
          <None>No feedback yet.</None>
        ) : (
          <div className="rows">
            {items.map((item) => (
              <Row
                key={item.id}
                lead={<IconTile name={item.published ? 'check' : 'file'} alt={!item.published} />}
                title={`“${item.quote}”`}
                sub={`${item.studentName} · ${item.year}`}
                end={
                  <>
                    <Pill tone={item.published ? 'good' : 'off'}>{item.published ? 'Published' : 'Draft'}</Pill>
                    {can('update') && (
                      <ActionButton
                        action={setFeedbackPublished.bind(null, { id: item.id, studentName: item.studentName, year: item.year, quote: item.quote, published: item.published })}
                        label={item.published ? 'Unpublish' : 'Publish'}
                        className={item.published ? 'button-quiet button-sm' : 'button button-sm'}
                      />
                    )}
                    {can('delete') && (
                      <ModalForm label="Delete" buttonClassName="button-danger button-sm" title="Delete this feedback?" action={deleteFeedback.bind(null, item.id)} submitLabel="Delete" submitClassName="button-danger" />
                    )}
                  </>
                }
              />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
