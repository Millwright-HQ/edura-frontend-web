import type { PaymentDetailsDto, SiteSettingsInput, ZoomConnectionDto } from '@edura/contracts';
import { ModalForm } from '@/lib/action-form';
import { callAsUser, getMe } from '@/lib/server';
import { Field, Forbidden, FormSection, IconTile, PageHead, Panel, Pill, Row, TextArea } from '@/lib/ui';
import { ImagePicker } from '@/lib/image-picker';
import { publicImageUrl } from '@/lib/site';
import { addTutor, connectZoom, disconnectZoom, removeTutor, savePayment, saveSite, updateTutor } from '../v1-actions';

const lines = (rows: Record<string, string>[], a: string, b: string) =>
  rows.map((row) => `${row[a]} | ${row[b]}`).join('\n');

/** What a visitor sees depends on what the academy has filled in, so show what is still missing. */
function ProfileChecklist({ site, hasLogo }: { site: SiteSettingsInput; hasLogo: boolean }) {
  const items: [string, boolean][] = [
    ['Tagline', Boolean(site.tagline)],
    ['About the academy', Boolean(site.about)],
    ['Logo', hasLogo],
    ['Contact details', Boolean(site.contactEmail || site.contactPhone)],
    ['Address and opening hours', Boolean(site.address || site.openingHours)],
    ['Key numbers', site.stats.length > 0],
    ['Why families choose you', site.highlights.length > 0],
    ['Programs', site.programs.length > 0],
    ['Tutors', site.tutors.length > 0],
    ['Common questions', site.faqs.length > 0],
  ];
  const done = items.filter(([, ok]) => ok).length;
  if (done === items.length) return null;
  return (
    <Panel title={`Your public page: ${done} of ${items.length} filled in`}>
      <p className="muted small">Your website at your academy address shows what you add here. Fill in the missing parts under “Academy and website”, “Tutors” and “Feedback”.</p>
      <div className="checklist">
        {items.map(([label, ok]) => (
          <Pill key={label} tone={ok ? 'good' : 'off'}>
            {ok ? '✓ ' : ''}
            {label}
          </Pill>
        ))}
      </div>
    </Panel>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ zoom?: string }> }) {
  const [me, params] = await Promise.all([getMe(), searchParams]);
  const can = (permission: string) => me.permissions.includes(permission);
  const [site, payment, zoom] = await Promise.all([
    can('tenant.settings.read') ? callAsUser<SiteSettingsInput>('comms', '/settings/site') : null,
    can('tenant.payment_details.read') ? callAsUser<PaymentDetailsDto | null>('billing', '/settings/payment') : null,
    can('tenant.settings.read') ? callAsUser<ZoomConnectionDto>('zoom', '/zoom/connection') : null,
  ]);
  if (!site && !payment) return <Forbidden what="settings" />;
  const pay = payment?.ok ? payment.data : null;
  const logoUrl = site?.ok ? await publicImageUrl(site.data.logoImageId) : undefined;
  const tutorPhotos = site?.ok ? await Promise.all(site.data.tutors.map((tutor) => publicImageUrl(tutor.imageId))) : [];
  const connected = zoom?.ok && zoom.data.connected;

  return (
    <>
      <PageHead title="Settings" />
      {site?.ok && can('tenant.settings.update') && <ProfileChecklist site={site.data} hasLogo={Boolean(logoUrl)} />}
      {params.zoom === 'connected' && <p className="notice notice-success">Zoom is connected.</p>}
      {params.zoom === 'failed' && <p className="notice notice-error">Zoom could not be connected. Please try again.</p>}
      <Panel>
        <div className="rows">
          {zoom?.ok &&
            zoom.data.accounts.map((account) => (
              <Row
                key={account.accountId}
                lead={<IconTile name="video" />}
                title={`Zoom: ${account.displayName}`}
                sub={
                  <>
                    Connected by {account.ownerEmail || 'unknown'}. Each class says which account hosts it.
                    {account.appId && (
                      <>
                        <br />
                        Webhook address for this Zoom app:{' '}
                        <code>{`${zoom.data.webhookBase || 'https://<your public address>'}/webhooks/zoom/${account.appId}`}</code>
                        {!account.hasWebhookSecret && ' (no secret token saved, so attendance and recordings cannot arrive)'}
                      </>
                    )}
                  </>
                }
                end={
                  <>
                    <Pill>Connected</Pill>
                    {can('tenant.zoom.disconnect') && (
                      <ModalForm
                        label="Disconnect"
                        buttonClassName="button-danger button-sm"
                        title={`Disconnect ${account.displayName}?`}
                        description="Classes already scheduled on this account can no longer be changed or started until it is connected again."
                        action={disconnectZoom.bind(null, account.accountId)}
                        submitLabel="Disconnect Zoom"
                        submitClassName="button-danger"
                      />
                    )}
                  </>
                }
              />
            ))}
          {zoom?.ok && can('tenant.zoom.connect') && (
            <Row
              lead={<IconTile name="video" alt />}
              title={connected ? 'Connect another Zoom account' : 'Zoom'}
              sub={connected ? 'For example a second teacher with their own Zoom plan.' : 'Connect a Zoom account so classes can be scheduled.'}
              end={
                <ModalForm
                  label="Connect Zoom"
                  buttonClassName="button button-sm"
                  title="Connect a Zoom account"
                  description={
                    <>
                      Create an OAuth app in the Zoom App Marketplace, add <code>{zoom.data.redirectUri}</code> as its redirect URL, then paste its
                      details here. They are stored encrypted and are never shown again. You will then be sent to Zoom to approve access.
                    </>
                  }
                  action={connectZoom}
                  submitLabel="Continue to Zoom"
                >
                  <Field label="Client ID" name="clientId" />
                  <Field label="Client secret" name="clientSecret" type="password" />
                  <Field
                    label="Secret token for webhooks (optional now)"
                    name="webhookSecret"
                    type="password"
                    required={false}
                    hint="From the app's Event Subscriptions. Needed for attendance and recordings. After connecting, this page shows the webhook address to give Zoom."
                  />
                </ModalForm>
              }
            />
          )}
          {payment && can('tenant.payment_details.update') && (
            <Row
              lead={<IconTile name="card" alt />}
              title="Payment details"
              sub={pay ? `${pay.accountName} · ${pay.bankName}` : 'What parents see on their invoices. Needed before invoicing.'}
              end={
                <ModalForm label="Edit" buttonClassName="button-quiet button-sm" title="Payment details" description="Parents see these on their invoices page. Every change is recorded." action={savePayment} submitLabel="Save payment details">
                  <div className="form-grid">
                    <Field label="Account name" name="accountName" defaultValue={pay?.accountName} />
                    <Field label="Bank" name="bankName" defaultValue={pay?.bankName} />
                    <Field label="BSB / branch" name="bsb" defaultValue={pay?.bsb} />
                    <Field label="Account number" name="accountNumber" defaultValue={pay?.accountNumber} />
                    <Field label="Currency (e.g. AUD, LKR)" name="currency" defaultValue={pay?.currency ?? 'AUD'} />
                  </div>
                  <TextArea label="Extra instructions (optional)" name="instructions" rows={2} maxLength={500} defaultValue={pay?.instructions} required={false} />
                </ModalForm>
              }
            />
          )}
          {site?.ok && can('tenant.settings.update') && (
            <Row
              lead={<IconTile name="globe" />}
              title="Academy and website"
              sub={site.data.displayName || 'Name, colour, time zone and public page'}
              end={
                <ModalForm label="Edit" buttonClassName="button-quiet button-sm" title="Academy and website" action={saveSite} submitLabel="Save" wide>
                  <ImagePicker name="logoImageId" purpose="logo" label="Logo" current={site.data.logoImageId} currentUrl={logoUrl} />
                  <div className="form-grid">
                    <Field label="Academy name" name="displayName" defaultValue={site.data.displayName} />
                    <Field label="Tagline" name="tagline" defaultValue={site.data.tagline} required={false} />
                    <Field label="Brand colour" name="primaryColor" type="color" defaultValue={site.data.primaryColor} />
                    <Field label="Time zone" name="timezone" defaultValue={site.data.timezone} />
                    <Field label="Contact email" name="contactEmail" type="email" defaultValue={site.data.contactEmail} required={false} />
                    <Field label="Contact phone" name="contactPhone" defaultValue={site.data.contactPhone} required={false} />
                    <Field label="Address" name="address" defaultValue={site.data.address} required={false} />
                    <Field label="Opening hours" name="openingHours" defaultValue={site.data.openingHours} required={false} />
                  </div>
                  <FormSection title="Public website">
                    <TextArea label="About" name="about" maxLength={3000} defaultValue={site.data.about} required={false} />
                    <TextArea label="Key numbers (one per line: Number | Label, for example 12 | Years teaching)" name="stats" rows={3} defaultValue={lines(site.data.stats, 'value', 'label')} required={false} />
                    <TextArea label="Why families choose you (one per line: Title | Description)" name="highlights" rows={4} defaultValue={lines(site.data.highlights, 'title', 'description')} required={false} />
                    <TextArea label="Programs (one per line: Title | Description)" name="programs" defaultValue={lines(site.data.programs, 'title', 'description')} required={false} />
                    <TextArea label="Common questions (one per line: Question | Answer)" name="faqs" defaultValue={lines(site.data.faqs, 'question', 'answer')} required={false} />
                  </FormSection>
                </ModalForm>
              }
            />
          )}
        </div>
      </Panel>
      {site?.ok && can('tenant.settings.update') && (
        <Panel
          title="Tutors"
          action={
            <ModalForm label="Add tutor" buttonClassName="button-quiet button-sm" title="Add a tutor" description="Shown on your public page." action={addTutor} submitLabel="Add tutor">
              <TutorFields />
            </ModalForm>
          }
        >
          {site.data.tutors.length === 0 ? (
            <p className="muted">No tutors yet. Add the people who teach, with a photo and a short introduction.</p>
          ) : (
            <div className="rows">
              {site.data.tutors.map((tutor, index) => (
                <Row
                  key={`${tutor.name}-${index}`}
                  lead={<IconTile name="users" />}
                  title={tutor.name}
                  sub={tutor.subject}
                  end={
                    <>
                      <ModalForm label="Edit" buttonClassName="button-quiet button-sm" title={`Edit ${tutor.name}`} action={updateTutor.bind(null, index)} submitLabel="Save">
                        <TutorFields tutor={tutor} photoUrl={tutorPhotos[index]} />
                      </ModalForm>
                      <ModalForm label="Remove" buttonClassName="button-danger button-sm" title={`Remove ${tutor.name}?`} description="They disappear from your public page." action={removeTutor.bind(null, index)} submitLabel="Remove" submitClassName="button-danger" />
                    </>
                  }
                />
              ))}
            </div>
          )}
        </Panel>
      )}
    </>
  );
}

function TutorFields({ tutor, photoUrl }: { tutor?: { name: string; subject: string; bio: string; imageId: string }; photoUrl?: string | undefined }) {
  return (
    <>
      <ImagePicker name="imageId" purpose="tutor" label="Photo" current={tutor?.imageId} currentUrl={photoUrl} />
      <div className="form-grid">
        <Field label="Name" name="name" defaultValue={tutor?.name} />
        <Field label="Subject (optional)" name="subject" defaultValue={tutor?.subject} required={false} />
      </div>
      <TextArea label="About them (optional)" name="bio" rows={3} maxLength={800} defaultValue={tutor?.bio} required={false} />
    </>
  );
}
