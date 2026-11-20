import { Captcha } from '@/lib/captcha-widget';
import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/lib/action-form';
import { glyphFor, posterClass } from '@/lib/poster';
import { getPublicSite, publicImageUrl } from '@/lib/site';
import { Field, Icon, Panel, SiteLayout, TextArea } from '@/lib/ui';
import { submitEnquiry } from '../tenant/v1-actions';

/** Shown when the academy has not written its own reasons yet, so the page never looks empty. */
const DEFAULT_HIGHLIGHTS = [
  { title: 'Live online classes', description: 'Small, taught-live lessons you join from home, with the tutor and your classmates.' },
  { title: 'Every lesson recorded', description: 'Missed a class or want to revise? Watch the recording any time.' },
  { title: 'Notes and worksheets', description: 'Materials for every week sit alongside the lesson, organised by chapter.' },
  { title: 'Parents stay in the loop', description: 'Parents see progress, attendance and invoices in one place.' },
];

const STEPS = [
  { title: 'Send an enrolment request', description: 'Tell us who is joining. It takes a couple of minutes.' },
  { title: 'Get your login', description: 'We email each student, and each parent, their own login.' },
  { title: 'Join your classes', description: 'Open the schedule, join the live class, and find recordings and notes afterwards.' },
];

/** The website a signed-out visitor sees at an academy's address. */
export default async function PublicSitePage() {
  const [site, requestHeaders] = await Promise.all([getPublicSite(), headers()]);
  if (!site) notFound();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '';
  const name = site.displayName || host.split('.')[0]!;
  const tiles = site.programs.slice(0, 2);
  const tutorPhotos = await Promise.all(site.tutors.map((tutor) => publicImageUrl(tutor.imageId)));

  return (
    <SiteLayout brand={name} ctaHref="/join" ctaLabel="Enrol" footer={`${name} · Powered by Edura`} color={site.primaryColor}>
      <section className="landing">
        <div className="landing-text">
          <span className="landing-tag">Now enrolling</span>
          <h1>{site.tagline || name}</h1>
          {site.about && <p className="landing-lead prose">{site.about}</p>}
          <div className="actions">
            <Link className="button button-lg" href="/join">
              Enrol now
            </Link>
            <Link className="button-quiet button-lg" href="/login">
              Sign in
            </Link>
          </div>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="landing-feature">
            <span className="hero-pill">Live online classes</span>
            <strong>{name}</strong>
            <span>Recordings and notes for every lesson</span>
          </div>
          {tiles.map((program, index) => (
            <div className={`landing-tile ${posterClass(index + 1)}`} key={program.title}>
              <span>{glyphFor(program.title)}</span>
              <strong>{program.title}</strong>
            </div>
          ))}
        </div>
      </section>

      {site.stats.length > 0 && (
        <section className="stat-strip" aria-label="The academy in numbers">
          {site.stats.map((stat) => (
            <div key={`${stat.value}${stat.label}`}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </section>
      )}

      <section className="site-section">
        <h2>Why choose {name}</h2>
        <div className="card-grid">
          {(site.highlights.length > 0 ? site.highlights : DEFAULT_HIGHLIGHTS).map((item, index) => (
            <article className="feature" key={item.title}>
              <span className={`icon-tile${index % 2 ? ' icon-tile-alt' : ''}`}>
                <Icon name={['video', 'file', 'check', 'users'][index % 4] as 'video'} size={24} />
              </span>
              <strong>{item.title}</strong>
              <p className="prose">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="site-section">
        <h2>How it works</h2>
        <ol className="steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="step-number">{index + 1}</span>
              <strong>{step.title}</strong>
              <p className="prose">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      {site.programs.length > 0 && (
        <section className="site-section">
          <h2>Programs</h2>
          <div className="card-grid">
            {site.programs.map((program, index) => (
              <article className="feature" key={program.title}>
                <span className={`icon-tile${index % 2 ? ' icon-tile-alt' : ''}`}>
                  <Icon name={index % 2 ? 'file' : 'video'} size={24} />
                </span>
                <strong>{program.title}</strong>
                <p className="prose">{program.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {site.tutors.length > 0 && (
        <section className="site-section">
          <h2>Our tutors</h2>
          <div className="card-grid">
            {site.tutors.map((tutor, index) => (
              <article className="feature" key={`${tutor.name}-${index}`}>
                {tutorPhotos[index] ? (
                  <img className="tutor-photo" src={tutorPhotos[index]} alt={tutor.name} />
                ) : (
                  <span className="icon-tile">
                    <Icon name="users" size={24} />
                  </span>
                )}
                <strong>{tutor.name}</strong>
                {tutor.subject && <span className="muted">{tutor.subject}</span>}
                {tutor.bio && <p className="prose">{tutor.bio}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {site.testimonials.length > 0 && (
        <section className="site-section">
          <h2>What students say</h2>
          <div className="card-grid">
            {site.testimonials.map((item) => (
              <figure className="quote" key={`${item.studentName}${item.quote}`}>
                <blockquote>{item.quote}</blockquote>
                <figcaption>
                  {item.studentName}, {item.year}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <div className="cols">
        {site.faqs.length > 0 && (
          <Panel title="Common questions">
            <div>
              {site.faqs.map((faq) => (
                <div className="faq" key={faq.question}>
                  <strong>{faq.question}</strong>
                  <p className="prose">{faq.answer}</p>
                </div>
              ))}
            </div>
          </Panel>
        )}
        <Panel title="Contact us">
          {(site.contactEmail || site.contactPhone || site.address || site.openingHours) && (
            <ul className="contact-list">
              {site.contactPhone && <li><strong>Phone</strong> {site.contactPhone}</li>}
              {site.contactEmail && <li><strong>Email</strong> {site.contactEmail}</li>}
              {site.address && <li><strong>Address</strong> {site.address}</li>}
              {site.openingHours && <li><strong>Hours</strong> {site.openingHours}</li>}
            </ul>
          )}
          <ActionForm action={submitEnquiry.bind(null, host)} submitLabel="Send" submitClassName="button">
            <div className="form-grid">
              <Field label="Your name" name="name" autoComplete="name" />
              <Field label="Email" name="email" type="email" autoComplete="email" />
            </div>
            <TextArea label="Message" name="message" maxLength={2000} />
            <div className="visually-hidden" aria-hidden="true">
              <label>
                Website
                <input name="website" type="text" tabIndex={-1} autoComplete="off" />
              </label>
          <Captcha />
            </div>
          </ActionForm>
        </Panel>
      </div>
      <section className="cta-band">
        <h2>Ready to join {name}?</h2>
        <p>Send an enrolment request and we will set you up with a login.</p>
        <div className="actions">
          <Link className="button button-lg" href="/join">
            Enrol now
          </Link>
          <Link className="button-quiet button-lg" href="/login">
            Sign in
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
