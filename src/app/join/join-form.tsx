'use client';

import { Captcha } from '@/lib/captcha-widget';
import { useState } from 'react';
import { submitEnrolmentRequest } from '@/app/actions';
import { ActionForm } from '@/lib/action-form';

const MAX_STUDENTS = 10;

function Input({ label, name, type = 'text', required = true, hint }: { label: string; name: string; type?: string; required?: boolean; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} required={required} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function JoinForm() {
  const [students, setStudents] = useState(1);
  return (
    <ActionForm action={submitEnrolmentRequest} submitLabel="Send request">
      {Array.from({ length: students }, (_, i) => (
        <section className="form-section" key={i}>
          <h3>Student{students > 1 ? ` ${i + 1}` : ''}</h3>
          <div className="form-grid">
            <Input label="First name" name={`studentFirstName${i}`} />
            <Input label="Last name" name={`studentLastName${i}`} />
          </div>
          <div className="form-grid">
            <Input label="Student’s email" name={`studentEmail${i}`} type="email" hint="Every student has their own login." />
            <Input label="Student’s phone (optional)" name={`studentPhone${i}`} type="tel" required={false} hint="So the academy can call if needed." />
          </div>
        </section>
      ))}
      {students < MAX_STUDENTS && (
        <button className="button-quiet" type="button" onClick={() => setStudents((n) => n + 1)}>
          Add another student
        </button>
      )}

      <section className="form-section">
        <h3>Parent or guardian (optional)</h3>
        <p>Add a parent now, or the academy can add one later.</p>
        <div className="form-grid">
          <Input label="First name" name="parentFirstName" required={false} />
          <Input label="Last name" name="parentLastName" required={false} />
          <Input label="Email" name="parentEmail" type="email" required={false} />
          <Input label="Phone (optional)" name="parentPhone" type="tel" required={false} hint="So the academy can call you." />
        </div>
      </section>

      <section className="form-section">
        <label className="field">
          <span>Anything we should know? (optional)</span>
          <textarea name="message" rows={3} maxLength={1000} />
        </label>
      </section>

      {/* Hidden from people. Automated form-fillers complete it and are discarded. */}
      <div className="visually-hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
          <Captcha />
      </div>
    </ActionForm>
  );
}
