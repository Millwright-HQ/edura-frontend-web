import 'server-only';

/**
 * Checks the Cloudflare Turnstile answer that the widget put in the form. Off until
 * TURNSTILE_SECRET is set, so local development needs no account. Checked here, in the web app,
 * because only the web app faces the internet; the services behind it are never public.
 * Returns a message to show the visitor, or null when they may continue.
 */
export async function checkCaptcha(data: FormData, address?: string): Promise<string | null> {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return null;
  const answer = String(data.get('cf-turnstile-response') ?? '');
  if (!answer) return 'Please confirm you are not a robot and try again.';
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: answer, ...(address ? { remoteip: address } : {}) }),
    });
    const body = (await response.json()) as { success?: boolean };
    return body.success ? null : 'We could not confirm you are not a robot. Please try again.';
  } catch {
    // Failing closed: an outage at Cloudflare must not open the forms to bots.
    return 'We could not check that you are not a robot. Please try again in a moment.';
  }
}
