'use client';

import { useEffect, useState } from 'react';
import { setPassword } from '@/app/actions';
import { ActionForm } from '@/lib/action-form';
import { PasswordInput } from '@/lib/client-ui';

const passwordHint = '8 or more characters, with upper and lower case, a number and a symbol.';

export function SetPasswordForm() {
  // undefined until the browser has read the link; the fragment never reaches the server.
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const found = /token=([^&]+)/.exec(window.location.hash)?.[1] ?? null;
    // React may run this twice in development; the second run finds the address already cleaned.
    setToken((current) => current ?? found);
    // Keeps the secret out of the address bar and browser history.
    if (found) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  if (token === undefined) return null;
  if (token === null) {
    return (
      <p className="notice notice-error" role="alert">
        This link is incomplete. Please open it again from your email.
      </p>
    );
  }
  return (
    <ActionForm action={setPassword} submitLabel="Set password">
      <input type="hidden" name="token" value={token} />
      <label className="field">
        <span>New password</span>
        <PasswordInput name="newPassword" autoComplete="new-password" />
        <small>{passwordHint}</small>
      </label>
      <label className="field">
        <span>Confirm new password</span>
        <PasswordInput name="confirmPassword" autoComplete="new-password" />
      </label>
    </ActionForm>
  );
}
