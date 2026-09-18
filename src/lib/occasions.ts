// What day it was.
//
// "You were 40m apart on June 4th" is a fact. "You were 40m apart on your birthday" is a story.
// The date already knows most of this, so nothing here needs storing or fetching: holidays are
// computed from the date itself, and birthdays come from the two profiles.
//
// Deliberately narrow. Only days most people mark, plus the two birthdays, because a chip that
// fires on every near miss stops meaning anything. Religious and national days that vary by
// person or place are left out rather than guessed at from someone's coordinates.

export type Occasion = {
  /** Short enough for a chip. */
  label: string;
  /** Louder than the usual chips: this is the reason the near miss is interesting. */
  loud: boolean;
};

type Birthdays = {
  /** ISO date, or MM-DD. Either is fine; only month and day are read. */
  mine?: string | null;
  theirs?: string | null;
  theirName?: string | null;
};

/** Month and day from a date string, ignoring the year and any timezone suffix. */
function monthDay(value?: string | null): { m: number; d: number } | null {
  if (!value) return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { m: Number(iso[2]), d: Number(iso[3]) };
  const md = value.match(/^(\d{2})-(\d{2})$/);
  if (md) return { m: Number(md[1]), d: Number(md[2]) };
  return null;
}

/** Nth weekday of a month, e.g. the fourth Thursday in November. */
function nthWeekday(year: number, month: number, weekday: number, n: number) {
  const first = new Date(year, month - 1, 1).getDay();
  const offset = (weekday - first + 7) % 7;
  return 1 + offset + (n - 1) * 7;
}

/** Last given weekday of a month, e.g. the last Monday in May. */
function lastWeekday(year: number, month: number, weekday: number) {
  const days = new Date(year, month, 0).getDate();
  const last = new Date(year, month - 1, days).getDay();
  return days - ((last - weekday + 7) % 7);
}

/**
 * The occasion for a near miss, or null on an ordinary day.
 *
 * `when` is read in the phone's own timezone, which is the right one: the question is what day
 * it was for the person looking, not what day it was in UTC.
 */
export function occasionFor(when: string | Date, people: Birthdays = {}): Occasion | null {
  const d = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(d.getTime())) return null;

  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const is = (mm: number, dd: number) => m === mm && day === dd;

  // Birthdays first: they beat a shared holiday, because they are about the two of you.
  const mine = monthDay(people.mine);
  if (mine && mine.m === m && mine.d === day) return { label: 'On your birthday', loud: true };

  const theirs = monthDay(people.theirs);
  if (theirs && theirs.m === m && theirs.d === day) {
    const who = people.theirName?.split(' ')[0];
    return { label: who ? `On ${who}'s birthday` : "On their birthday", loud: true };
  }

  if (is(1, 1)) return { label: "On New Year's Day", loud: true };
  if (is(12, 31)) return { label: "On New Year's Eve", loud: true };
  if (is(12, 25)) return { label: 'On Christmas Day', loud: true };
  if (is(12, 24)) return { label: 'On Christmas Eve', loud: false };
  if (is(10, 31)) return { label: 'On Halloween', loud: true };
  if (is(2, 14)) return { label: "On Valentine's Day", loud: true };
  if (is(7, 4)) return { label: 'On the 4th of July', loud: true };
  if (is(1, 6)) return null;

  if (m === 11 && day === nthWeekday(y, 11, 4, 4)) return { label: 'On Thanksgiving', loud: true };
  if (m === 5 && day === lastWeekday(y, 5, 1)) return { label: 'On Memorial Day', loud: false };
  if (m === 9 && day === nthWeekday(y, 9, 1, 1)) return { label: 'On Labor Day', loud: false };
  if (m === 5 && day === nthWeekday(y, 5, 0, 2)) return { label: "On Mother's Day", loud: false };
  if (m === 6 && day === nthWeekday(y, 6, 0, 3)) return { label: "On Father's Day", loud: false };

  return null;
}
