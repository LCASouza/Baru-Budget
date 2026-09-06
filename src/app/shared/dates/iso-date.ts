// Financial dates travel as `yyyy-MM-dd` strings and are interpreted in the local
// time zone, so a date never shifts by one day when converted to or from Date.
export type IsoDate = string;

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIsoDate(value: IsoDate): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function todayIso(now: Date = new Date()): IsoDate {
  return toIsoDate(now);
}
