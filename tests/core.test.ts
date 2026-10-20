import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseWorkbook, parseDate, parseTime } from '../src/lib/excelParser';
import { identifyRoles } from '../src/lib/roles';
import { filterEvents, isTimelineEvent, positionEvents } from '../src/lib/calendar';
import { foldICS, generateICS, googleCalendarLink } from '../src/lib/export';
import type { CalendarEvent, ViewState } from '../src/types';

const ref = '2026-10-19';
function workbook(rows: unknown[][], name = '시장-부시장 주간행사', merges: XLSX.Range[] = []) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows); ws['!merges'] = merges;
  XLSX.utils.book_append_sheet(wb, ws, name);
  return wb;
}
function event(id: string, startTime = '09:00', endTime = '10:00'): CalendarEvent {
  return { id, date: ref, endDate: ref, startTime, endTime, title: '현안보고; 회의, 검토', location: '대회의실', attendees: '시장', category: 'MAYOR', roles: ['시장'], targetRole: '시장', department: '교통정책과', notes: '첫 줄\n둘째 줄', allDay: false, timeLabel: `${startTime}–${endTime}`, endEstimated: false };
}
const state: ViewState = { selectedWeek: ref, category: 'ALL', query: '', roles: [], time: 'ALL', view: 'GRID' };

describe('실제 제공 엑셀', () => {
  it('짧은 시트명, 월·일 분리, 비고 참석자와 숫자 시간을 보존한다', () => {
    const wb = XLSX.read(readFileSync(resolve('주간행사계획_20261019_20261025.xlsx')), { type: 'buffer' });
    const result = parseWorkbook(wb, '주간행사계획_20261019_20261025.xlsx');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(ref);
    expect(result[0].events).toHaveLength(28);
    expect(result[0].summaries.map(s => s.count)).toEqual([24, 4]);
    expect(result[0].warnings).toEqual([]);
    const first = result[0].events.find(e => e.title === '제10회 이·통장 한마음 체육대회')!;
    expect(first).toMatchObject({ date: ref, startTime: '10:00', endTime: '11:00', attendees: '시장', targetRole: '시장', endEstimated: true });
    expect(result[0].events.find(e => e.title === '현안공유회의' && e.category === 'MAYOR')).toMatchObject({ targetRole: '부시장', roles: ['부시장'] });
    expect(result[0].events.find(e => e.title === '학부모 진로특강 : 자녀를 위한 N개의 지혜')).toMatchObject({ startTime: '19:05', endTime: '20:05' });
    const directors = result[0].events.filter(e => e.category === 'DIRECTOR');
    expect(directors.every(e => e.attendees === '교통국장')).toBe(true);
    expect(directors[0]).toMatchObject({ department: '교통정책과', notes: '교통정책팀' });
    expect(new Set(result[0].events.map(e => e.id)).size).toBe(28);
  });
});

describe('날짜와 시간 예외', () => {
  it('연도 경계를 주간 기준으로 보정하고 유효하지 않은 날짜는 거부한다', () => {
    expect(parseDate('1/1(금)', '2026-12-28')).toBe('2027-01-01');
    expect(parseDate('12/31', '2027-01-04')).toBe('2026-12-31');
    expect(parseDate('2026년 10월 20일', ref)).toBe('2026-10-20');
    expect(parseDate('21(수)', ref, '10월')).toBe('2026-10-21');
    expect(parseDate('2/30', ref)).toBeNull();
    expect(parseDate(46314, ref)).toBe('2026-10-19');
  });
  it('숫자 시간, 한국어 시간, 시간 미정과 부정확한 시간을 구분한다', () => {
    expect(parseTime(0.3958333333333)).toBe('09:30');
    expect(parseTime('오후 2시 30분')).toBe('14:30');
    expect(parseTime('오전 12:00')).toBe('00:00');
    expect(parseTime('09:61')).toBeNull();
    expect(parseTime('오전 중')).toBeNull();
    expect(parseTime('종일')).toBeNull();
    expect(parseTime('0930')).toBe('09:30');
  });
  it('병합 날짜와 가로 병합 헤더를 복원하고 같은 행사 중복은 제거한다', () => {
    const wb = workbook([
      ['날짜', '시작시간', '종료시간', '행사명', '', '행사장소', '주재자'],
      ['10/19', '09:00', '10:00', '업무보고', '', '상황실', '시장'],
      ['', '10:00', '', '현장점검', '', '현장', '제1부시장'],
      ['', '10:00', '', '현장점검', '', '현장', '제1부시장'],
      ['', '', '', '', '', '', ''],
    ], '시장-부시장', [{ s: { r: 0, c: 3 }, e: { r: 0, c: 4 } }, { s: { r: 1, c: 0 }, e: { r: 3, c: 0 } }]);
    const [week] = parseWorkbook(wb, '20261019.xlsx');
    expect(week.events).toHaveLength(2);
    expect(week.events[1]).toMatchObject({ date: ref, endTime: '11:00', endEstimated: true, targetRole: '제1부시장' });
    expect(week.warnings[0]).toContain('교통국장');
  });
  it('시작·종료 범위, 통합 일시, 자정 경과와 미정 일정을 파싱한다', () => {
    const wb = workbook([
      ['날짜', '시간', '행사내용'],
      ['10/19', '09:30-11:00', '범위'], ['10/19', '23:30', '자정'], ['10/19', '오전 중', '미정'],
    ]);
    const [week] = parseWorkbook(wb, '20261019.xlsx');
    expect(week.events.find(e => e.title === '범위')).toMatchObject({ startTime: '09:30', endTime: '11:00', endEstimated: false });
    expect(week.events.find(e => e.title === '자정')).toMatchObject({ startTime: '23:30', endTime: '00:30', endDate: '2026-10-20' });
    expect(week.events.find(e => e.title === '미정')).toMatchObject({ allDay: true, startTime: null, endTime: null });
    const [combined] = parseWorkbook(workbook([['일시', '회의명'], ['2026-10-19 09:00', '통합일시']]), '회의.xlsx');
    expect(combined.events[0]).toMatchObject({ date: ref, startTime: '09:00', endTime: '10:00' });
  });
  it('여러 주차를 분리하고 날짜 오류를 사용자에게 알린다', () => {
    const [a, b] = parseWorkbook(workbook([
      ['행사일자', '시작시각', '회의명'], ['10/19', '09:00', '첫주'], ['10/26', '09:00', '둘째주'], ['10/99', '09:00', '잘못된날짜'],
    ]), '20261019.xlsx');
    expect([a.id, b.id]).toEqual(['2026-10-19', '2026-10-26']);
    expect(a.warnings.some(w => w.includes('잘못된날짜'))).toBe(true);
    expect(a.events).toHaveLength(1); expect(b.events).toHaveLength(1);
  });
  it('헤더 동의어와 한 글자 오타를 인식하며 모르는 시트는 거부한다', () => {
    const [week] = parseWorkbook(workbook([['날짜', '시간', '행사넴', '회의실', '담당부서'], ['10/19', '09:00', '테스트', '애민방', '교통과']]), '20261019.xlsx');
    expect(week.events[0]).toMatchObject({ title: '테스트', location: '애민방', department: '교통과' });
    expect(() => parseWorkbook(workbook([['무관']], '기타시트'), 'test.xlsx')).toThrow('시트');
  });
});

describe('역할·필터·겹침 배치', () => {
  it('부시장을 시장으로 오인하지 않고 공동 참석자 모두를 필터링한다', () => {
    expect(identifyRoles('부시장', 'MAYOR')).toEqual({ roles: ['부시장'], targetRole: '부시장' });
    expect(identifyRoles('시장·제1부시장·교통국장', 'MAYOR')).toEqual({ roles: ['부시장', '시장', '교통국장'], targetRole: '공동' });
    expect(identifyRoles('제1부시장·제2부시장', 'MAYOR')).toEqual({ roles: ['부시장'], targetRole: '공동' });
  });
  it('검색, 참석자 OR, 카테고리, 시간대를 함께 적용한다', () => {
    const events: CalendarEvent[] = [event('a'), { ...event('b', '14:00', '15:00'), category: 'DIRECTOR', roles: ['교통국장'] }, { ...event('c'), startTime: null, endTime: null, allDay: true }];
    expect(filterEvents(events, { ...state, query: '교통정책' })).toHaveLength(3);
    expect(filterEvents(events, { ...state, roles: ['시장', '교통국장'], time: 'PM' }).map(e => e.id)).toEqual(['b']);
    expect(filterEvents(events, { ...state, time: 'OTHER' }).map(e => e.id)).toEqual(['c']);
    expect(filterEvents(events, { ...state, category: 'DIRECTOR', time: 'AM' })).toEqual([]);
  });
  it('연쇄 겹침은 병렬 배치하고 경계가 맞닿은 일정은 분리한다', () => {
    const placed = positionEvents([event('a', '09:00', '10:30'), event('b', '10:00', '11:00'), event('c', '10:30', '11:30'), event('d', '11:30', '12:00')]);
    expect(placed.map(e => [e.event.id, e.lane, e.lanes])).toEqual([['a', 0, 2], ['b', 1, 2], ['c', 0, 2], ['d', 0, 1]]);
    expect(isTimelineEvent(event('night', '18:00', '19:00'))).toBe(false);
    expect(isTimelineEvent(event('end', '17:00', '18:00'))).toBe(true);
    expect(isTimelineEvent({ ...event('cross'), endDate: '2026-10-20' })).toBe(false);
  });
});

describe('iCalendar 표준 출력', () => {
  it('한국 시간, 미정 종일, 종료일 배타 처리와 줄바꿈 이스케이프를 적용한다', () => {
    const e = event('a');
    const ics = generateICS([e, { ...event('b'), allDay: true, startTime: null, endTime: null }], '주간행사');
    expect(ics).toContain('DTSTART;TZID=Asia/Seoul:20261019T090000');
    expect(ics).toContain('DTEND;VALUE=DATE:20261020');
    expect(ics).toContain('SUMMARY:현안보고\\; 회의\\, 검토');
    expect(ics.replace(/\r\n /g, '')).toContain('첫 줄\\n둘째 줄');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(googleCalendarLink(e)).toContain('ctz=Asia%2FSeoul');
  });
  it('긴 한글 텍스트를 UTF-8 75바이트 이내로 안전하게 접는다', () => {
    const input = `SUMMARY:${'한글🙂'.repeat(80)}`;
    const folded = foldICS(input);
    expect(folded.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75)).toBe(true);
    expect(folded.replaceAll('\r\n ', '')).toBe(input);
  });
});
