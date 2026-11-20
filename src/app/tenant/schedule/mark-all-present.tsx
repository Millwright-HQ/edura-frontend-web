'use client';

/** Sets every student in the attendance sheet to Present. Nothing is saved until Save attendance is pressed. */
export function MarkAllPresent() {
  return (
    <button
      type="button"
      className="button-quiet button-sm"
      onClick={(event) => {
        const form = event.currentTarget.closest('form');
        form?.querySelectorAll<HTMLSelectElement>('select[name^="status_"]').forEach((select) => {
          select.value = 'present';
        });
      }}
    >
      Mark everyone present
    </button>
  );
}
