'use client';

import { useState } from 'react';

type Kind = 'tenant' | 'course' | 'group';
interface Option {
  value: string;
  label: string;
}

/**
 * Who should see an announcement. Everyone is the default and needs nothing more. Choosing courses or
 * groups reveals just that list, so the form never shows choices that do not apply.
 */
export function AudiencePicker({ courses, groups }: { courses: Option[]; groups: Option[] }) {
  const [kind, setKind] = useState<Kind>('tenant');
  const [picked, setPicked] = useState<string[]>([]);
  const options = kind === 'course' ? courses : groups;
  const noun = kind === 'course' ? 'courses' : 'groups';

  const choose = (next: Kind) => {
    setKind(next);
    setPicked([]);
  };
  const toggle = (value: string) =>
    setPicked((now) => (now.includes(value) ? now.filter((id) => id !== value) : [...now, value]));

  return (
    <>
      <label className="field">
        <span>Who should see this?</span>
        <select name="audience" value={kind} onChange={(event) => choose(event.target.value as Kind)}>
          <option value="tenant">Everyone</option>
          <option value="course">Students in selected courses</option>
          <option value="group">Students in selected groups</option>
        </select>
      </label>
      {kind !== 'tenant' && (
        <fieldset className="field">
          <legend className="check-label">
            Which {noun}?{' '}
            {options.length > 0 && (
              <button
                type="button"
                className="link-button"
                onClick={() => setPicked(picked.length === options.length ? [] : options.map((option) => option.value))}
              >
                {picked.length === options.length ? 'Clear all' : 'Select all'}
              </button>
            )}
          </legend>
          {options.length === 0 ? (
            <small>There are no {noun} yet.</small>
          ) : (
            <div className="check-grid">
              {options.map((option) => (
                <label className="check" key={option.value}>
                  <input
                    type="checkbox"
                    name={`${kind}Ids`}
                    value={option.value}
                    checked={picked.includes(option.value)}
                    onChange={() => toggle(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          )}
          <small>
            {picked.length === 0 ? `Choose at least one ${kind}.` : `${picked.length} ${picked.length === 1 ? kind : noun} chosen.`}
          </small>
        </fieldset>
      )}
    </>
  );
}
