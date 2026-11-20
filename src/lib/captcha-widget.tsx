'use client';

import { useEffect } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Shows the Turnstile box inside a form. It adds the answer to the form itself. Absent without a site key. */
export function Captcha() {
  useEffect(() => {
    if (!SITE_KEY || document.querySelector('script[data-turnstile]')) return;
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    script.async = true;
    script.dataset.turnstile = 'true';
    document.head.appendChild(script);
  }, []);
  if (!SITE_KEY) return null;
  return <div className="cf-turnstile" data-sitekey={SITE_KEY} />;
}
