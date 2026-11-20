import { describe, expect, it } from 'vitest';
import { money, monthIn, utcToZonedInput, zonedToUtc } from './format';

describe('time zones', () => {
  it('converts an academy-local time to UTC', () => {
    expect(zonedToUtc('2027-03-01T17:30', 'Asia/Colombo')).toBe('2027-03-01T12:00:00.000Z');
  });

  it('respects daylight saving', () => {
    expect(zonedToUtc('2027-01-15T09:00', 'Australia/Melbourne')).toBe('2027-01-14T22:00:00.000Z');
    expect(zonedToUtc('2027-07-15T09:00', 'Australia/Melbourne')).toBe('2027-07-14T23:00:00.000Z');
  });

  it('round-trips for the edit form', () => {
    expect(utcToZonedInput(zonedToUtc('2027-07-15T09:00', 'Australia/Melbourne'), 'Australia/Melbourne')).toBe('2027-07-15T09:00');
  });

  it('finds the current month in the academy’s zone, not the server’s', () => {
    expect(monthIn('Australia/Melbourne', new Date('2027-01-31T20:00:00Z'))).toBe('2027-02');
  });
});

it('formats money from cents', () => {
  expect(money(150050, 'AUD')).toBe('AUD 1,500.50');
});
