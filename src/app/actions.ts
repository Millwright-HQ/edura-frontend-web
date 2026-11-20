'use server';

import { checkCaptcha } from '@/lib/captcha';
import type { DemoProfile, LoginResult, MfaEnabledDto, MfaSetupDto, TokenPair } from '@edura/contracts';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACCESS_COOKIE, MFA_COOKIE, REFRESH_COOKIE } from '@/lib/cookies';
import type { FormState } from '@/lib/action-form';
import { safeNext } from '@/lib/routing';
import { callService, errorMessage, storeSession } from '@/lib/server';

const text = (data: FormData, name: string) => String(data.get(name) ?? '');
const requestHost = async () => (await headers()).get('host') ?? '';

export async function login(_: FormState, data: FormData): Promise<FormState> {
  const result = await callService<LoginResult>('identity', '/auth/login', {
    method: 'POST',
    body: {
      host: await requestHost(),
      email: text(data, 'email'),
      password: text(data, 'password'),
      keepSignedIn: data.get('keepSignedIn') === 'on',
    },
  });
  if (!result.ok) {
    if (result.status === 429) return { error: errorMessage(result, 'Too many attempts. Please wait a moment.') };
    return { error: result.status >= 500 ? 'Something went wrong. Please try again.' : 'Invalid email or password' };
  }
  if ('mfaToken' in result.data) {
    // The password was right but a second step is needed. The pass lives in a short-lived cookie.
    (await cookies()).set(MFA_COOKIE, JSON.stringify({ token: result.data.mfaToken, next: safeNext(text(data, 'next')) }), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 5 * 60,
      secure: process.env.NODE_ENV === 'production',
    });
    redirect(result.data.mfaEnrolRequired ? '/login/setup' : '/login/verify');
  }
  await storeSession(result.data);
  redirect(safeNext(text(data, 'next')));
}

async function readChallenge(): Promise<{ token: string; next: string } | null> {
  const raw = (await cookies()).get(MFA_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { token?: string; next?: string };
    return parsed.token ? { token: parsed.token, next: safeNext(parsed.next ?? '/') } : null;
  } catch {
    return null;
  }
}

/** Second step of sign-in: a code from the authenticator app, or a recovery code. */
export async function verifyMfa(_: FormState, data: FormData): Promise<FormState> {
  const pass = await readChallenge();
  if (!pass) redirect('/login');
  const result = await callService<TokenPair>('identity', '/auth/mfa/verify', {
    method: 'POST',
    body: { mfaToken: pass.token, code: text(data, 'code').trim() },
  });
  if (!result.ok) {
    if (result.status === 429) return { error: errorMessage(result, 'Too many attempts. Please wait a moment.') };
    // A rejected pass (expired or tampered with) means starting again; a wrong code just retries.
    if (result.status === 401 && errorMessage(result, '') !== 'Invalid code') redirect('/login');
    return { error: 'That code is not right. Try the newest code in your app, or a recovery code.' };
  }
  (await cookies()).delete(MFA_COOKIE);
  await storeSession(result.data);
  redirect(pass.next);
}

/** First-time setup for people whose academy requires it. Shows the key to type into the app. */
export async function startMfaSetup(): Promise<MfaSetupDto | null> {
  const pass = await readChallenge();
  if (!pass) return null;
  const result = await callService<MfaSetupDto>('identity', '/auth/mfa/enrol/start', {
    method: 'POST',
    body: { mfaToken: pass.token },
  });
  return result.ok ? result.data : null;
}

export async function confirmMfaSetup(_: FormState, data: FormData): Promise<FormState> {
  const pass = await readChallenge();
  if (!pass) redirect('/login');
  const result = await callService<MfaEnabledDto>('identity', '/auth/mfa/enrol/confirm', {
    method: 'POST',
    body: { mfaToken: pass.token, code: text(data, 'code').trim() },
  });
  if (!result.ok || !result.data.tokens) {
    return { error: 'That code is not right. Check the app and try the newest one.' };
  }
  (await cookies()).delete(MFA_COOKIE);
  await storeSession(result.data.tokens);
  // Recovery codes are shown once, here, and never stored by the web app.
  return { success: `Two-step sign-in is on. Save these recovery codes somewhere safe: ${result.data.recoveryCodes.join('  ')}` };
}

/** Demo academy only: the identity service refuses this everywhere else. */
export async function switchProfile(profile: DemoProfile): Promise<void> {
  const result = await callService<TokenPair>('identity', '/auth/demo-session', {
    method: 'POST',
    body: { host: await requestHost(), profile },
  });
  if (!result.ok) redirect('/login');
  await storeSession(result.data);
  redirect('/');
}

export async function forgotPassword(_: FormState, data: FormData): Promise<FormState> {
  const result = await callService('identity', '/auth/password/forgot', {
    method: 'POST',
    body: { host: await requestHost(), email: text(data, 'email') },
  });
  if (result.status === 400) return { error: 'Enter a valid email address' };
  return { success: 'If that email has an account, a link to reset the password is on its way.' };
}

export async function setPassword(_: FormState, data: FormData): Promise<FormState> {
  const newPassword = text(data, 'newPassword');
  if (newPassword !== text(data, 'confirmPassword')) {
    return { error: 'The two passwords do not match' };
  }
  const result = await callService('identity', '/auth/password/reset', {
    method: 'POST',
    body: { token: text(data, 'token'), newPassword },
  });
  if (!result.ok) return { error: errorMessage(result, 'This link is invalid or has expired') };
  redirect('/login?passwordSet=1');
}

export async function submitEnrolmentRequest(_: FormState, data: FormData): Promise<FormState> {
  const robot = await checkCaptcha(data);
  if (robot) return { error: robot };
  const students = [];
  for (let i = 0; data.has(`studentEmail${i}`); i++) {
    const studentPhone = text(data, `studentPhone${i}`).trim();
    students.push({
      firstName: text(data, `studentFirstName${i}`).trim(),
      lastName: text(data, `studentLastName${i}`).trim(),
      email: text(data, `studentEmail${i}`),
      ...(studentPhone ? { phone: studentPhone } : {}),
    });
  }
  const phone = text(data, 'parentPhone').trim();
  const message = text(data, 'message').trim();
  const website = text(data, 'website');
  const parentEmail = text(data, 'parentEmail').trim();
  const parentFirstName = text(data, 'parentFirstName').trim();
  const parentLastName = text(data, 'parentLastName').trim();
  if ((parentEmail || parentFirstName || parentLastName) && !(parentEmail && parentFirstName && parentLastName)) {
    return { error: 'Enter the parent’s first name, last name and email, or leave all three empty' };
  }
  const result = await callService('identity', '/public/enrolment-requests', {
    method: 'POST',
    body: {
      host: await requestHost(),
      ...(parentEmail
        ? {
            parent: {
              firstName: parentFirstName,
              lastName: parentLastName,
              email: parentEmail,
              ...(phone ? { phone } : {}),
            },
          }
        : {}),
      students,
      ...(message ? { message } : {}),
      ...(website ? { website } : {}),
    },
  });
  if (!result.ok) return { error: errorMessage(result, 'Something went wrong. Please try again.') };
  redirect('/join?sent=1');
}

export async function submitAcademyRequest(_: FormState, data: FormData): Promise<FormState> {
  const robot = await checkCaptcha(data);
  if (robot) return { error: robot };
  const website = text(data, 'website');
  const result = await callService('tenants', '/public/academy-requests', {
    method: 'POST',
    body: {
      name: text(data, 'name').trim(),
      slug: text(data, 'slug').trim().toLowerCase(),
      firstName: text(data, 'firstName').trim(),
      lastName: text(data, 'lastName').trim(),
      email: text(data, 'email'),
      ...(website ? { website } : {}),
    },
  });
  if (!result.ok) return { error: errorMessage(result, 'Something went wrong. Please try again.') };
  redirect('/start?sent=1');
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await callService('identity', '/auth/logout', { method: 'POST', body: { refreshToken } });
  }
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  redirect('/login');
}
