'use client';

import { useState, useTransition } from 'react';
import { loadGroupMembers } from '../v1-actions';

interface Member {
  id: string;
  name: string;
}

/**
 * Pick a group and every student in it starts ticked. Untick anyone who should not be billed this time.
 * `billTo` says who pays for each student, so it is clear that brothers and sisters share one invoice.
 */
export function GroupInvoiceFields({
  groups,
  billTo,
}: {
  groups: { value: string; label: string }[];
  billTo: Record<string, string>;
}) {
  const [groupId, setGroupId] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [loading, startLoading] = useTransition();
  const [failed, setFailed] = useState(false);

  const choose = (id: string) => {
    setGroupId(id);
    setMembers([]);
    setTicked([]);
    setFailed(false);
    if (!id) return;
    startLoading(async () => {
      try {
        const found = await loadGroupMembers(id);
        setMembers(found);
        setTicked(found.map((member) => member.id));
      } catch {
        setFailed(true);
      }
    });
  };
  const toggle = (id: string) => setTicked((now) => (now.includes(id) ? now.filter((x) => x !== id) : [...now, id]));
  const all = members.length > 0 && ticked.length === members.length;
  const payers = new Set(members.filter((member) => ticked.includes(member.id)).map((member) => billTo[member.id] ?? member.name)).size;

  return (
    <>
      <label className="field">
        <span>Group</span>
        <select name="groupId" required value={groupId} onChange={(event) => choose(event.target.value)}>
          <option value="">Choose a group…</option>
          {groups.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>
      </label>
      {groupId && (
        <fieldset className="field">
          <legend className="check-label">
            Students to bill{' '}
            {members.length > 0 && (
              <button type="button" className="link-button" onClick={() => setTicked(all ? [] : members.map((member) => member.id))}>
                {all ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </legend>
          {loading ? (
            <small>Loading students…</small>
          ) : failed ? (
            <small role="alert">Could not load this group’s students. Try choosing the group again.</small>
          ) : members.length === 0 ? (
            <small>This group has no students yet.</small>
          ) : (
            <>
              <div className="student-checks">
                {members.map((member) => (
                  <label className="check" key={member.id}>
                    <input type="checkbox" name="studentIds" value={member.id} checked={ticked.includes(member.id)} onChange={() => toggle(member.id)} />
                    <span>
                      {member.name}
                      {billTo[member.id] && <small className="muted"> · billed to {billTo[member.id]}</small>}
                    </span>
                  </label>
                ))}
              </div>
              {all && <input type="hidden" name="everyone" value="1" />}
              <small>
                {ticked.length === 0
                  ? 'Choose at least one student.'
                  : `${ticked.length} of ${members.length} students · ${payers} ${payers === 1 ? 'invoice' : 'invoices'}. Brothers and sisters with the same parent share one invoice.`}
              </small>
            </>
          )}
        </fieldset>
      )}
    </>
  );
}
