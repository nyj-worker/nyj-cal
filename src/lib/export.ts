import type { CalendarEvent, WeekDataset } from '../types';
import { addDate } from './dates';
import { CATEGORY_LABEL } from '../types';

export function downloadBlob(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export const eventText = (event: CalendarEvent) => [
  event.title, `${event.date} ${event.timeLabel}${event.endDate !== event.date ? ` (종료 ${event.endDate})` : ''}`,
  `구분: ${CATEGORY_LABEL[event.category]}`, `장소: ${event.location || '미기재'}`,
  `참석: ${event.attendees || '미기재'}`, `주관: ${event.department || '미기재'}`,
  event.notes ? `비고: ${event.notes}` : '', event.endEstimated ? '종료 시간은 시작 1시간 후로 자동 설정됨' : '',
].filter(Boolean).join('\n');

const escapeICS = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
const basicDate = (date: string) => date.replaceAll('-', '');
const dateTime = (date: string, time: string) => `${basicDate(date)}T${time.replace(':', '')}00`;

// RFC 5545 limits physical content lines to 75 octets, including continuation spaces.
export function foldICS(line: string) {
  const encoder = new TextEncoder();
  const lines: string[] = [];
  let current = '', bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) { lines.push(current); current = ' '; bytes = 1; }
    current += character; bytes += length;
  }
  lines.push(current);
  return lines.join('\r\n');
}

export function generateICS(events: CalendarEvent[], label: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Weekly Governance//KO', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', `X-WR-CALNAME:${escapeICS(label)}`, 'X-WR-TIMEZONE:Asia/Seoul',
    'BEGIN:VTIMEZONE', 'TZID:Asia/Seoul', 'BEGIN:STANDARD', 'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900', 'TZOFFSETTO:+0900', 'TZNAME:KST', 'END:STANDARD', 'END:VTIMEZONE',
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.id}@weekly-governance.local`, `DTSTAMP:${stamp}`);
    if (e.allDay || !e.startTime || !e.endTime) {
      lines.push(`DTSTART;VALUE=DATE:${basicDate(e.date)}`, `DTEND;VALUE=DATE:${basicDate(addDate(e.date, 1))}`);
    } else lines.push(`DTSTART;TZID=Asia/Seoul:${dateTime(e.date, e.startTime)}`, `DTEND;TZID=Asia/Seoul:${dateTime(e.endDate, e.endTime)}`);
    lines.push(`SUMMARY:${escapeICS(e.title)}`, `LOCATION:${escapeICS(e.location)}`,
      `DESCRIPTION:${escapeICS(eventText(e))}`, `CATEGORIES:${CATEGORY_LABEL[e.category]}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldICS).join('\r\n') + '\r\n';
}
export function exportWeek(week: WeekDataset, kind: 'ics' | 'json') {
  const name = `주간행사_${basicDate(week.startDate)}_${basicDate(week.endDate)}`;
  if (kind === 'ics') downloadBlob(generateICS(week.events, week.label), `${name}.ics`, 'text/calendar;charset=utf-8');
  else downloadBlob(JSON.stringify(week, null, 2), `${name}.json`, 'application/json;charset=utf-8');
}
export function googleCalendarLink(event: CalendarEvent) {
  const dates = event.allDay || !event.startTime || !event.endTime
    ? `${basicDate(event.date)}/${basicDate(addDate(event.date, 1))}`
    : `${dateTime(event.date, event.startTime)}/${dateTime(event.endDate, event.endTime)}`;
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates, ctz: 'Asia/Seoul', location: event.location, details: eventText(event) })}`;
}
