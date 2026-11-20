import Link from 'next/link';
import { ICONS, Icon, SiteLayout } from '@/lib/ui';

const FEATURES: { icon: keyof typeof ICONS; title: string; body: string }[] = [
  { icon: 'video', title: 'Live classes and recordings', body: 'Schedule weekly classes on Zoom. Students join from their home page and catch up on recordings.' },
  { icon: 'file', title: 'Courses by the week', body: 'Upload videos, PDFs and links week by week, then assign courses to student groups.' },
  { icon: 'card', title: 'Invoices and receipts', body: 'Send family or group invoices. Parents upload a receipt and you approve it in one click.' },
  { icon: 'users', title: 'A login for every role', body: 'Admins create student and parent logins. Parents are optional and can be added any time.' },
  { icon: 'globe', title: 'Your own website', body: 'Each academy gets its own address with programs, testimonials, enquiries and enrolment.' },
  { icon: 'mega', title: 'Announcements', body: 'Message everyone, a group or a course, and it lands in their notifications.' },
];

/** The website at the main address, for people who run academies. */
export default async function MainSitePage() {
  // The demo is its own site, so its address is configuration (DEMO_URL), never worked out from this one.
  const demoUrl = process.env.DEMO_URL;
  const footerLinks = [
    ...(demoUrl ? [{ href: demoUrl, label: 'Try the demo', external: true }] : []),
    { href: '/start', label: 'Enrol your academy' },
    { href: '/login', label: 'Platform login' },
  ];
  return (
    <SiteLayout
      brand="Edura"
      signInHref={null}
      ctaHref="/start"
      ctaLabel="Enrol your academy"
      footer="Edura · Online academies, simply run"
      footerLinks={footerLinks}
    >
      <section className="landing">
        <div className="landing-text">
          <span className="landing-tag">For tuition centres and academies</span>
          <h1>Your academy, all in one place.</h1>
          <p className="landing-lead">
            Live classes, recordings, worksheets, enrolments and invoices. Students, parents and staff each get their own space on your academy’s own address.
          </p>
          <div className="actions">
            <Link className="button button-lg" href="/start">
              Enrol your academy
            </Link>
            {demoUrl ? (
              <a className="button-quiet button-lg" href={demoUrl}>
                Try the demo
              </a>
            ) : (
              <span className="landing-note">Live demo opening soon</span>
            )}
          </div>
        </div>
        <div className="landing-art" aria-hidden="true">
          <div className="landing-feature">
            <span className="hero-pill">Live class in 12 min</span>
            <strong>Quadratics: the quadratic formula</strong>
            <span>Year 10 Maths · Week 5</span>
          </div>
          <div className="landing-tile p1">
            <span>x²</span>
            <strong>Year 10 Maths</strong>
          </div>
          <div className="landing-tile p2">
            <span>Aa</span>
            <strong>Year 10 English</strong>
          </div>
        </div>
      </section>
      <section className="site-section">
        <h2>Everything a tuition centre runs on</h2>
        <div className="card-grid">
          {FEATURES.map((feature, index) => (
            <article className="feature" key={feature.title}>
              <span className={`icon-tile${index % 2 ? ' icon-tile-alt' : ''}`}>
                <Icon name={feature.icon} size={24} />
              </span>
              <strong>{feature.title}</strong>
              <p>{feature.body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="cta">
        <div className="cta-text">
          <h2>Bring your academy online</h2>
          <p>Tell us about your centre and we’ll set up your space.</p>
        </div>
        <Link className="button-accent button-lg" href="/start">
          Enrol your academy
        </Link>
      </section>
    </SiteLayout>
  );
}
