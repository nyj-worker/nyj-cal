import { CalendarCheck2, ChevronRight, Clock3, MapPin, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { CalendarEvent } from '../types';
import { eventColorClass } from '../lib/eventColors';
import Modal from './Modal';

export default function TodayEventsModal({ date, events, onSelect, onClose }: {
  date: string;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  onClose: () => void;
}) {
  const todayEvents = events.filter(event => event.date === date).sort((a, b) =>
    (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title, 'ko'),
  );
  return <Modal title="오늘의 일정" onClose={onClose} wide>
    <div className="today-summary">
      <span><CalendarCheck2 size={18} />{format(parseISO(date), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}</span>
      <strong>{todayEvents.length}건</strong>
    </div>
    <p className="today-list-help">선택한 주차의 오늘 일정 전체입니다. 행사를 누르면 상세 정보를 볼 수 있습니다.</p>
    {todayEvents.length ? <div className="today-event-list">{todayEvents.map(event =>
      <button type="button" key={event.id} className={`event-card today-event-row ${eventColorClass(event)}`} onClick={() => onSelect(event)} aria-label={`${event.timeLabel} ${event.title}, 상세보기`}>
        <span className="today-event-heading"><span className="event-time"><Clock3 size={13} />{event.timeLabel}{event.endEstimated && ' *'}</span><ChevronRight size={16} /></span>
        <strong className="today-event-title">{event.title}</strong>
        <span className="today-event-meta"><span><MapPin size={13} />{event.location || '장소 미기재'}</span><span><Users size={13} />{event.attendees || '참석자 미기재'}</span></span>
        {event.department && <span className="today-event-department">{event.department}</span>}
      </button>,
    )}</div> : <div className="today-empty"><CalendarCheck2 size={34} /><strong>오늘 등록된 일정이 없습니다</strong><p>현재 선택한 주차에 오늘 날짜의 행사가 없습니다.</p></div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>닫기</button></div>
  </Modal>;
}
