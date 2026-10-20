import type { CalendarEvent, ViewState } from '../types';
import { minutes } from './dates';

export const isTimelineEvent = (e: CalendarEvent) => !e.allDay && e.startTime !== null && e.endTime !== null && e.date === e.endDate && minutes(e.startTime) >= 540 && minutes(e.endTime) <= 1080;
export function filterEvents(events: CalendarEvent[], state: ViewState) {
  const query = state.query.trim().toLocaleLowerCase();
  return events.filter(e => {
    if (state.category !== 'ALL' && e.category !== state.category) return false;
    if (state.roles.length && !state.roles.some(role => e.roles.includes(role))) return false;
    if (query && ![e.title, e.location, e.department].some(value => value.toLocaleLowerCase().includes(query))) return false;
    if (state.time === 'ALL') return true;
    if (state.time === 'OTHER') return e.allDay || !e.startTime || minutes(e.startTime) < 540 || minutes(e.startTime) >= 1080;
    if (!e.startTime) return false;
    const m = minutes(e.startTime);
    return state.time === 'AM' ? m >= 540 && m < 720 : m >= 720 && m < 1080;
  });
}

export interface PositionedEvent { event: CalendarEvent; lane: number; lanes: number }
export function positionEvents(events: CalendarEvent[]): PositionedEvent[] {
  const sorted = events.filter(isTimelineEvent).sort((a, b) => minutes(a.startTime!) - minutes(b.startTime!) || minutes(b.endTime!) - minutes(a.endTime!));
  const output: PositionedEvent[] = [];
  let group: PositionedEvent[] = [];
  let ends: number[] = [];
  let groupEnd = -1;
  const flush = () => { group.forEach(e => { e.lanes = ends.length; }); output.push(...group); group = []; ends = []; };
  for (const event of sorted) {
    const start = minutes(event.startTime!);
    if (group.length && start >= groupEnd) { flush(); groupEnd = -1; }
    let lane = ends.findIndex(end => end <= start);
    if (lane === -1) lane = ends.length;
    ends[lane] = minutes(event.endTime!);
    groupEnd = Math.max(groupEnd, ends[lane]);
    group.push({ event, lane, lanes: 1 });
  }
  flush();
  return output;
}
