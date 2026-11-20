/** The big letters on a course poster. Falls back to the course's initials. */
const SUBJECTS: [RegExp, string][] = [
  [/math|algebra|calculus|geometry/i, 'x²'],
  [/english|literature|writing|essay/i, 'Aa'],
  [/science|chemistry|biology/i, 'H₂O'],
  [/physics/i, 'Ω'],
  [/history/i, '1914'],
  [/geography/i, '40°N'],
  [/revision|exam/i, '∑'],
];

export function glyphFor(name: string): string {
  const match = SUBJECTS.find(([pattern]) => pattern.test(name));
  if (match) return match[1];
  return name
    .split(/\s+/)
    .filter((word) => /^[a-z]/i.test(word))
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
}

export const posterClass = (index: number) => `p${index % 4}`;

export function minutesLeft(position: number, duration: number): string {
  const minutes = Math.max(1, Math.round((duration - position) / 60));
  return `${minutes} min left`;
}
