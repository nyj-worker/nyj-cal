import { useState } from 'react';
import { CalendarDays, Clock3, Copy, Check, ExternalLink, MapPin, Users, Building2, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { CalendarEvent } from '../types';
import { CATEGORY_LABEL } from '../types';
import { eventText, googleCalendarLink } from '../lib/export';
import Modal from './Modal';

export default function EventDetailModal({ event, onClose }: { event: CalendarEvent; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  async function copy() {
    try { await navigator.clipboard.writeText(eventText(event)); setCopied(true); setError(''); }
    catch { setError('복사하지 못했습니다. 아래 일정 정보를 선택해 직접 복사해 주세요.'); }
  }
  const details = [
    { icon: CalendarDays, label: '행사 일자', text: format(parseISO(event.date), 'yyyy년 M월 d일 (EEEE)', { locale: ko }) },
    { icon: Clock3, label: '행사 시간', text: `${event.timeLabel}${event.endDate !== event.date ? ` (종료 ${event.endDate})` : ''}${event.endEstimated ? ' · 종료 시간 자동 설정' : ''}` },
    { icon: MapPin, label: '장소', text: event.location || '미기재' },
    { icon: Users, label: '참석 대상', text: event.attendees || '미기재' },
    { icon: Building2, label: '주관 부서', text: event.department || '미기재' },
    { icon: FileText, label: '비고', text: event.notes || '없음' },
  ];
  return <Modal title="일정 상세 정보" onClose={onClose}>
    <div className="detail-content"><span className={`category-badge ${event.category === 'MAYOR' ? 'mayor' : 'director'}`}>{CATEGORY_LABEL[event.category]} 주간행사</span><h3>{event.title}</h3><dl>{details.map(({ icon: Icon, label, text }) => <div key={label}><dt><Icon size={17} />{label}</dt><dd>{text}</dd></div>)}</dl></div>
    {error && <div className="notice error" role="alert">{error}<textarea readOnly value={eventText(event)} aria-label="복사할 일정 정보" /></div>}
    <div className="modal-actions"><button type="button" className="button secondary" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? '복사 완료' : '일정 정보 복사'}</button><a className="button primary" href={googleCalendarLink(event)} target="_blank" rel="noopener noreferrer">구글 캘린더 추가<ExternalLink size={15} /></a></div>
  </Modal>;
}
