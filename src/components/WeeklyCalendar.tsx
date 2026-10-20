import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { CalendarEvent, WeekDataset } from '../types';
import { CATEGORY_LABEL } from '../types';
import { addDate, minutes, todayInSeoul } from '../lib/dates';
import { isTimelineEvent, positionEvents } from '../lib/calendar';
import EventCard, { Highlight } from './EventCard';
import { eventColorClass } from '../lib/eventColors';

const weekdays = ['월', '화', '수', '목', '금', '토', '일'];
export default function WeeklyCalendar({ week, events, query, onSelect, view }: { week: WeekDataset; events: CalendarEvent[]; query: string; onSelect: (e: CalendarEvent) => void; view: 'GRID' | 'LIST' }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(id); }, []);
  const today = todayInSeoul();
  const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  const nowMinutes = minutes(nowTime);
  const days = Array.from({ length: 7 }, (_, i) => addDate(week.startDate, i));
  const dayEvents = (day: string) => events.filter(e => e.date === day);
  return <>
    <div className="screen-calendar">
      {events.length === 0 ? <div className="empty-state"><CalendarDays size={38} /><h3>표시할 일정이 없습니다</h3><p>검색어나 필터를 변경하거나 다른 주차를 선택해 주세요.</p></div> : view === 'LIST' ?
        <div className="agenda">{days.map((day, i) => <section key={day} className="agenda-day"><div className={`agenda-date ${day === today ? 'today' : ''}`}><strong>{format(parseISO(day), 'dd')}</strong><span>{weekdays[i]}요일</span><small>{dayEvents(day).length}건</small></div><div className="agenda-events">{dayEvents(day).length ? dayEvents(day).map(e => <button type="button" key={e.id} className={`agenda-event ${e.category === 'MAYOR' ? 'mayor' : 'director'} ${eventColorClass(e)}`} onClick={() => onSelect(e)}><span className="agenda-time">{e.timeLabel}</span><span className="agenda-title"><strong><Highlight text={e.title} query={query} /></strong><span><MapPin size={13} /><Highlight text={e.location || '장소 미기재'} query={query} /><Users size={13} />{e.attendees || '참석자 미기재'}</span>{query && <small><Highlight text={e.department} query={query} /></small>}</span><span className="category-badge">{CATEGORY_LABEL[e.category]}</span></button>) : <span className="no-agenda">등록된 일정이 없습니다</span>}</div></section>)}</div>
        : <div className="calendar-scroll" tabIndex={0} role="region" aria-label="월요일부터 일요일 주간 시간표. 좁은 화면에서는 가로로 스크롤할 수 있습니다.">
          <div className="time-grid">
            <div className="day-headers"><div className="timezone-label">GMT+9</div>{days.map((day, i) => <div className={`day-header ${i > 4 ? 'weekend' : ''} ${day === today ? 'today' : ''}`} key={day}><div><span>{weekdays[i]}요일</span><small>{dayEvents(day).length}건</small></div><strong>{format(parseISO(day), 'dd')}<small>{day === today ? '오늘' : format(parseISO(day), 'M월')}</small></strong></div>)}</div>
            <div className="all-day-row"><div className="all-day-label"><Clock3 size={14} /><span>종일 / 기타</span></div>{days.map(day => <div key={day} className="all-day-cell">{dayEvents(day).filter(e => !isTimelineEvent(e)).map(event => <EventCard key={event.id} event={event} onSelect={onSelect} query={query} compact />)}</div>)}</div>
            <div className="timeline"><div className="time-axis">{Array.from({ length: 10 }, (_, i) => <span key={i} style={{ top: `${i / 9 * 100}%` }}>{String(i + 9).padStart(2, '0')}:00</span>)}</div>{days.map(day => <div className={`day-column ${day === today ? 'is-today' : ''}`} key={day}>{positionEvents(dayEvents(day)).map(({ event, lane, lanes }) => <EventCard key={event.id} event={event} onSelect={onSelect} query={query} style={{ top: `${(minutes(event.startTime!) - 540) / 540 * 100}%`, height: `${(minutes(event.endTime!) - minutes(event.startTime!)) / 540 * 100}%`, left: `calc(${lane / lanes * 100}% + 4px)`, width: `calc(${100 / lanes}% - 8px)` }} />)}{day === today && nowMinutes >= 540 && nowMinutes <= 1080 && <div className="now-line" style={{ top: `${(nowMinutes - 540) / 540 * 100}%` }}><span /> <time>{nowTime}</time></div>}</div>)}</div>
          </div>
        </div>}
      <div className="calendar-footnote"><span className="role-legend"><i className="legend-dot blue" />시장 <i className="legend-dot purple" />부시장 <i className="legend-dot green" />교통국장 <i className="legend-dot gold" />공동 참석</span><span>* 종료 시간 미기재 시 1시간 자동 설정 · 대한민국 표준시 (KST)</span></div>
    </div>
    <div className="print-calendar"><h1>주간 주요행사 종합상황판</h1><p>{week.label} · {events.length}건{week.isSample ? ' · 샘플 데이터' : ''}</p><table><thead><tr>{days.map((day, i) => <th key={day}>{format(parseISO(day), 'M/d')} ({weekdays[i]})</th>)}</tr></thead><tbody><tr>{days.map(day => <td key={day}>{dayEvents(day).map(e => <article key={e.id} className={`${e.category === 'MAYOR' ? 'mayor' : 'director'} ${eventColorClass(e)}`}><strong>{e.timeLabel}{e.endEstimated ? '*' : ''}</strong><b>{e.title}</b><span>{e.location || '장소 미기재'}</span><small>{e.attendees || CATEGORY_LABEL[e.category]}{e.department ? ` · ${e.department}` : ''}</small></article>)}</td>)}</tr></tbody></table><footer>* 종료 시간 미기재 시 시작 1시간 후로 설정 · 현재 검색·필터가 적용된 주간표입니다.</footer></div>
  </>;
}
