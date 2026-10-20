import { MapPin } from 'lucide-react';
import type { CalendarEvent } from '../types';
import type { CSSProperties } from 'react';
import { eventColorClass } from '../lib/eventColors';

export function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const lower = text.toLocaleLowerCase(), search = needle.toLocaleLowerCase();
  const parts = [];
  let offset = 0, index = lower.indexOf(search);
  while (index !== -1) {
    parts.push(text.slice(offset, index), <mark key={index}>{text.slice(index, index + needle.length)}</mark>);
    offset = index + needle.length; index = lower.indexOf(search, offset);
  }
  parts.push(text.slice(offset));
  return <>{parts}</>;
}

export default function EventCard({ event, onSelect, query, compact = false, style }: { event: CalendarEvent; onSelect: (e: CalendarEvent) => void; query: string; compact?: boolean; style?: CSSProperties }) {
  return <button type="button" className={`event-card ${event.category === 'MAYOR' ? 'mayor' : 'director'} ${eventColorClass(event)} ${compact ? 'compact' : ''}`} style={style} onClick={() => onSelect(event)} aria-label={`${event.date} ${event.timeLabel} ${event.title}, 상세보기`} title={`${event.timeLabel} ${event.title}\n${event.location}\n${event.attendees}`}>
    <span className="event-time">{event.timeLabel}{event.endEstimated && <span aria-label="종료 시간 자동 설정"> *</span>}</span>
    <span className="event-title"><Highlight text={event.title} query={query} /></span>
    {!compact && <span className="event-location"><MapPin size={11} /><span><Highlight text={event.location || '장소 미기재'} query={query} /></span></span>}
    {query.trim() && event.department.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) && <span className="event-department"><Highlight text={event.department} query={query} /></span>}
    {!compact && <span className="event-role">{event.attendees || '참석자 미기재'}</span>}
  </button>;
}
