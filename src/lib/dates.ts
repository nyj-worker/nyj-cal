import { addDays, format, parseISO, startOfWeek } from 'date-fns';

export const isoDate = (date: Date) => format(date, 'yyyy-MM-dd');
export const addDate = (date: string, amount: number) => isoDate(addDays(parseISO(date), amount));
export const mondayOf = (date: string) => isoDate(startOfWeek(parseISO(date), { weekStartsOn: 1 }));
export function todayInSeoul() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function weekLabel(start: string) {
  const d = parseISO(start);
  const ordinal = Math.floor((d.getDate() - 1) / 7) + 1;
  return `${format(d, 'yyyy년 M월')} ${ordinal}주차 (${format(d, 'MM.dd')} ~ ${format(parseISO(addDate(start, 6)), 'MM.dd')})`;
}
export const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const clock = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export function validDate(y: number, m: number, d: number) {
  if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? isoDate(date) : null;
}
