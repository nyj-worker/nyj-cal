import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Building2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Download, FileJson, FileSpreadsheet, Printer, Plus, Search, X, Users, BusFront, CalendarCheck2, ArrowUpRight, HardDrive, LayoutGrid, List, Check, AlertCircle, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { CalendarEvent, Category, RoleFilter, TimeFilter, ViewState, WeekDataset } from './types';
import { mondayOf, todayInSeoul } from './lib/dates';
import { createSampleWeek } from './lib/sampleData';
import { loadWeeks, readView, saveView, saveWeeks } from './lib/storage';
import { filterEvents } from './lib/calendar';
import { exportWeek } from './lib/export';
import { ROLE_CLASS } from './lib/eventColors';
import WeeklyCalendar from './components/WeeklyCalendar';
import EventDetailModal from './components/EventDetailModal';
import TodayEventsModal from './components/TodayEventsModal';

const UploadModal = lazy(() => import('./components/UploadModal'));

const tabs: { key: Category | 'ALL'; label: string }[] = [
  { key: 'ALL', label: '전체보기' }, { key: 'MAYOR', label: '시장·부시장 주간행사' }, { key: 'DIRECTOR', label: '교통국장 주간행사' },
];
const times: { key: TimeFilter; label: string }[] = [{ key: 'ALL', label: '전체 시간' }, { key: 'AM', label: '오전 09–12' }, { key: 'PM', label: '오후 12–18' }, { key: 'OTHER', label: '야간 / 기타' }];

export default function App() {
  const [weeks, setWeeks] = useState<WeekDataset[]>([]);
  const [state, setState] = useState<ViewState>(readView);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [todayOpen, setTodayOpen] = useState(false);
  const [samplePreview, setSamplePreview] = useState<WeekDataset | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    async function initialize() {
      let loaded: WeekDataset[] = [];
      try {
        loaded = await loadWeeks();
        if (!loaded.length) { loaded = [createSampleWeek()]; await saveWeeks(loaded); }
      } catch { if (active) setStorageError('브라우저에 데이터를 저장할 수 없습니다. 현재 화면은 임시로 표시됩니다. 저장 공간과 사이트 권한을 확인해 주세요.'); if (!loaded.length) loaded = [createSampleWeek()]; }
      if (!active) return;
      loaded.sort((a, b) => a.startDate.localeCompare(b.startDate));
      setWeeks(loaded);
      setState(previous => ({ ...previous, selectedWeek: loaded.some(w => w.id === previous.selectedWeek) ? previous.selectedWeek : loaded.at(-1)!.id }));
      setLoading(false);
    }
    void initialize();
    return () => { active = false; };
  }, []);
  useEffect(() => { if (!loading) { try { saveView(state); } catch { setStorageError('조회 상태를 저장하지 못했습니다. 브라우저 저장 권한을 확인해 주세요.'); } } }, [state, loading]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!exportOpen) return;
    const click = (e: PointerEvent) => { if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setExportOpen(false); };
    document.addEventListener('pointerdown', click); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', click); document.removeEventListener('keydown', escape); };
  }, [exportOpen]);
  const save = useCallback(async (incoming: WeekDataset[], customToast?: string) => {
    await saveWeeks(incoming);
    setWeeks(previous => [...previous.filter(w => !incoming.some(n => n.id === w.id)), ...incoming].sort((a, b) => a.id.localeCompare(b.id)));
    setState(previous => ({ ...previous, selectedWeek: incoming.at(-1)!.id, category: 'ALL', query: '', roles: [], time: 'ALL' }));
    setSamplePreview(null); setStorageError('');
    setToast(customToast || `${incoming.length}개 주차, ${incoming.reduce((sum, w) => sum + w.events.length, 0)}건의 일정을 저장했습니다.`);
  }, []);
  const update = (patch: Partial<ViewState>) => setState(previous => ({ ...previous, ...patch }));
  const clearFilters = () => update({ category: 'ALL', query: '', roles: [], time: 'ALL' });
  const week = samplePreview ?? weeks.find(w => w.id === state.selectedWeek) ?? weeks.at(-1);
  const index = weeks.findIndex(w => w.id === week?.id);
  const events = week ? filterEvents(week.events, state) : [];
  const today = todayInSeoul();
  function switchWeek(id: string) { setSamplePreview(null); update({ selectedWeek: id }); }
  function thisWeek() { const id = mondayOf(today); if (weeks.some(w => w.id === id)) switchWeek(id); else setToast('이번 주에 저장된 일정이 없습니다. 이번 주 엑셀 파일을 업로드해 주세요.'); }
  function toggleRole(role: RoleFilter) { update({ roles: state.roles.includes(role) ? state.roles.filter(r => r !== role) : [...state.roles, role] }); }
  function exportData(kind: 'ics' | 'json') { if (week) { exportWeek(week, kind); setExportOpen(false); setToast(`선택 주차의 전체 일정 ${week.events.length}건을 ${kind.toUpperCase()} 파일로 내보냈습니다.`); } }
  if (loading || !week) return <div className="loading-screen"><Building2 size={32} /><strong>주간행사 종합상황판</strong><span>저장된 일정을 불러오는 중입니다…</span></div>;
  const hasFilters = !!state.query || state.roles.length > 0 || state.time !== 'ALL' || state.category !== 'ALL';
  const stats = [
    { label: '주간 전체 일정', count: week.events.length, icon: CalendarDays, color: 'navy', sub: '월요일부터 일요일까지' },
    { label: '시장·부시장', count: week.events.filter(e => e.category === 'MAYOR').length, icon: Users, color: 'blue', sub: '시정 주요행사 및 회의' },
    { label: '교통국장', count: week.events.filter(e => e.category === 'DIRECTOR').length, icon: BusFront, color: 'green', sub: '교통 현안 및 현장 일정' },
    { label: '오늘의 일정', count: week.events.filter(e => e.date === today).length, icon: CalendarCheck2, color: 'amber', sub: `${format(parseISO(today), 'M월 d일')} · 선택 주차 기준`, onClick: () => setTodayOpen(true) },
  ];
  return <>
    <header className="app-header"><div className="header-inner"><div className="brand"><span className="brand-symbol"><Building2 size={25} strokeWidth={1.7} /></span><div><span className="brand-caption">SMART GOVERNANCE</span><h1>주간 주요행사 종합상황판</h1></div><span className="service-badge">주간 업무지원</span></div><div className="header-actions"><span className={`save-status ${storageError ? 'failed' : ''}`} title={storageError || '이 브라우저에 주간 일정이 저장됩니다'}><HardDrive size={14} />{storageError ? '저장 확인 필요' : samplePreview ? '샘플 체험 중' : '브라우저에 저장됨'}{!storageError && !samplePreview && <Check size={12} />}</span><div className="export-wrap" ref={exportRef}><button type="button" className="button secondary" onClick={() => setExportOpen(!exportOpen)} aria-expanded={exportOpen} aria-controls="export-options"><Download size={16} />내보내기<ChevronDown size={14} /></button>{exportOpen && <div id="export-options" className="export-dropdown"><div>현재 주차 전체 일정 · {week.events.length}건</div><button type="button" onClick={() => exportData('ics')}><CalendarDays size={16} /><span>캘린더 파일 (.ics)<small>구글·아웃룩 캘린더 가져오기</small></span></button><button type="button" onClick={() => exportData('json')}><FileJson size={16} /><span>JSON 다운로드<small>정규화된 주간 데이터</small></span></button><button type="button" onClick={() => { setExportOpen(false); window.print(); }}><Printer size={16} /><span>인쇄 / PDF 저장<small>A4 가로 · 현재 검색·필터 적용</small></span></button></div>}</div><button type="button" className="button primary" onClick={() => setUploadOpen(true)}><Plus size={18} />엑셀 파일 업로드</button></div></div></header>
    <main className="main-content">
      {storageError && <div className="notice error" role="alert"><AlertCircle size={18} /><span>{storageError}</span></div>}
      {samplePreview && <div className="sample-preview-banner"><span>샘플 데이터를 체험하고 있습니다. 저장된 일정은 주차 선택으로 다시 조회할 수 있습니다.</span><button type="button" onClick={() => setSamplePreview(null)}>체험 종료<X size={14} /></button></div>}
      <section className="page-intro"><div><div className="eyebrow"><span />WEEKLY SCHEDULE</div><h2>한 주의 일정을 한눈에.</h2><p>시정 주요행사와 교통국 일정을 함께 확인하세요.</p></div><div className="intro-meta"><span className="meta-caption">조회 기간</span><strong>{format(parseISO(week.startDate), 'yyyy.MM.dd')} <span>—</span> {format(parseISO(week.endDate), 'MM.dd')}</strong><span className="source-info"><FileSpreadsheet size={13} />{week.sourceName}{week.isSample && <b>샘플</b>}</span></div></section>
      <section className="stats-grid" aria-label="선택 주차 일정 요약">{stats.map(({ label, count, icon: Icon, color, sub, onClick }) => {
        const content = <><div><span className="stat-label">{label}</span><div className="stat-value">{count}<small>건</small></div><p>{sub}</p></div><span className="stat-icon"><Icon size={22} strokeWidth={1.7} /></span></>;
        return onClick
          ? <button type="button" className={`stat-card ${color} stat-card-action`} key={label} onClick={onClick} aria-label={`${label} ${count}건 보기`} aria-haspopup="dialog">{content}</button>
          : <article className={`stat-card ${color}`} key={label}>{content}</article>;
      })}</section>
      <section className="calendar-panel" aria-label="주간 일정 조회">
        <div className="calendar-toolbar"><div className="week-navigation"><span className="section-icon"><CalendarDays size={19} /></span><h2>주간 일정</h2><div className="nav-buttons"><button type="button" className="icon-button" aria-label="이전 저장 주차" disabled={samplePreview !== null || index <= 0} onClick={() => switchWeek(weeks[index - 1].id)}><ChevronLeft size={17} /></button><button type="button" className="icon-button" aria-label="다음 저장 주차" disabled={samplePreview !== null || index >= weeks.length - 1} onClick={() => switchWeek(weeks[index + 1].id)}><ChevronRight size={17} /></button></div><div className="week-select"><select aria-label="조회 주차 선택" value={samplePreview ? '__sample' : week.id} onChange={e => switchWeek(e.target.value)}>{samplePreview && <option value="__sample">{samplePreview.label} · 체험</option>}{[...weeks].reverse().map(w => <option key={w.id} value={w.id}>{w.label}{w.isSample ? ' · 샘플' : ''}</option>)}</select><ChevronDown size={15} /></div><button type="button" className="this-week-button" onClick={thisWeek}>이번 주</button></div><div className="calendar-toolbar-right"><span className="history-count">보관 중인 주차 <b>{weeks.length}</b></span><div className="view-toggle" aria-label="캘린더 보기 방식"><button type="button" aria-label="시간표 보기" aria-pressed={state.view === 'GRID'} className={state.view === 'GRID' ? 'active' : ''} onClick={() => update({ view: 'GRID' })}><LayoutGrid size={16} /></button><button type="button" aria-label="목록 보기" aria-pressed={state.view === 'LIST'} className={state.view === 'LIST' ? 'active' : ''} onClick={() => update({ view: 'LIST' })}><List size={18} /></button></div></div></div>
        <div className="category-tabs" role="tablist" aria-label="행사 구분">{tabs.map(tab => <button type="button" role="tab" id={`tab-${tab.key}`} aria-controls="schedule-content" aria-selected={state.category === tab.key} key={tab.key} className={`${state.category === tab.key ? 'active' : ''} ${tab.key === 'DIRECTOR' ? 'director-tab' : ''}`} onClick={() => update({ category: tab.key })}>{tab.key !== 'ALL' && <i className={`legend-dot ${tab.key === 'MAYOR' ? 'blue' : 'green'}`} />}{tab.label}<span>{week.events.filter(e => tab.key === 'ALL' || e.category === tab.key).length}</span></button>)}</div>
        <div className="filters"><div className="search-input"><Search size={18} /><input aria-label="행사명, 장소, 주관부서 검색" placeholder="행사명, 장소, 주관부서 검색" value={state.query} onChange={e => update({ query: e.target.value })} />{state.query && <button type="button" aria-label="검색어 지우기" onClick={() => update({ query: '' })}><X size={15} /></button>}<kbd>검색</kbd></div><div className="role-filters" role="group" aria-label="참석자 다중 선택"><span><Users size={14} />참석자</span><button type="button" aria-pressed={!state.roles.length} className={!state.roles.length ? 'selected' : ''} onClick={() => update({ roles: [] })}>전체</button>{(['시장', '부시장', '교통국장'] as RoleFilter[]).map(role => <button type="button" aria-pressed={state.roles.includes(role)} className={`${ROLE_CLASS[role]} ${state.roles.includes(role) ? 'selected' : ''}`} key={role} onClick={() => toggleRole(role)}>{state.roles.includes(role) && <Check size={12} />}{role}</button>)}</div><div className="time-filter"><SlidersHorizontal size={14} /><select aria-label="시간대 필터" value={state.time} onChange={e => update({ time: e.target.value as TimeFilter })}>{times.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}</select></div></div>
        <div className="result-info"><span>{hasFilters ? <><b>{events.length}건</b>의 검색 결과 <small>/ 전체 {week.events.length}건</small></> : <>총 <b>{events.length}건</b>의 일정이 있습니다.</>}{hasFilters && <button type="button" onClick={clearFilters}><RotateCcw size={12} />필터 초기화</button>}</span><span className="calendar-tip">일정을 클릭하면 상세 내용을 확인할 수 있습니다<ArrowUpRight size={13} /></span></div>
        <div id="schedule-content" role="tabpanel" aria-labelledby={`tab-${state.category}`}><WeeklyCalendar week={week} events={events} query={state.query} onSelect={setSelectedEvent} view={state.view} /></div>
      </section>
      <footer className="app-footer"><span><Building2 size={14} />주간 주요행사 종합상황판<span className="footer-separator" />시정의 흐름을 연결합니다.</span><span>엑셀 업로드 · 주차별 보관 · 캘린더 내보내기</span></footer>
    </main>
    <Suspense fallback={<div role="status" className="toast">엑셀 가져오기를 준비하고 있습니다…</div>}>{uploadOpen && <UploadModal existingWeeks={weeks} onSave={save} onClose={() => setUploadOpen(false)} onSample={() => { setSamplePreview(createSampleWeek()); clearFilters(); setUploadOpen(false); }} />}</Suspense>
    {todayOpen && !selectedEvent && <TodayEventsModal date={today} events={week.events} onSelect={setSelectedEvent} onClose={() => setTodayOpen(false)} />}
    {selectedEvent && <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}
    {toast && <div role="status" className="toast"><Check size={16} />{toast}<button type="button" aria-label="알림 닫기" onClick={() => setToast('')}><X size={14} /></button></div>}
  </>;
}
