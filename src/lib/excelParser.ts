import * as XLSX from 'xlsx';
import type { CalendarEvent, Category, WeekDataset } from '../types';
import { addDate, clock, minutes, mondayOf, todayInSeoul, validDate, weekLabel } from './dates';
import { identifyRoles } from './roles';

type Field = 'date' | 'month' | 'day' | 'startTime' | 'endTime' | 'title' | 'location' | 'attendees' | 'department' | 'notes';
type Cell = string | number | boolean | Date | null | undefined;
const aliases: Record<Field, string[]> = {
  date: ['날짜', '일자', '행사일자', '행사일', '일시', '일정일자'],
  month: ['월'], day: ['일', '일요일', '일별'],
  startTime: ['시간', '시각', '시작시간', '시작시각', '행사시간'],
  endTime: ['종료시간', '종료시각', '끝시간'],
  title: ['행사명', '행사내용', '회의명', '일정명', '일정내용', '행사', '내용'],
  location: ['장소', '행사장소', '회의실', '개최장소'],
  attendees: ['참석자', '주재', '주재자', '참석대상', '참석', '참석인원'],
  department: ['주관부서', '주관', '담당부서', '주최부서', '소관부서'],
  notes: ['비고', '세부내용', '참고사항', '특이사항'],
};
const clean = (v: Cell) => String(v ?? '').replace(/\s+/g, ' ').trim();
const normalize = (v: Cell) => clean(v).replace(/[\s\-·ㆍ_()（）\[\]:：]/g, '');

function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (Math.min(a.length, b.length) < 3) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
  }
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

function findHeader(rows: Cell[][]) {
  const candidates = rows.slice(0, 12).map((row, rowIndex) => {
    const map: Partial<Record<Field, number>> = {};
    row.forEach((value, index) => {
      const key = normalize(value);
      if (!key) return;
      const exact = (Object.keys(aliases) as Field[]).find(field => aliases[field].includes(key));
      if (exact) { if (map[exact] === undefined) map[exact] = index; return; }
      let best: Field | undefined;
      let score = 0.65;
      for (const field of Object.keys(aliases) as Field[]) {
        if (map[field] !== undefined) continue;
        const match = Math.max(...aliases[field].map(alias => similarity(key, alias)));
        if (match > score) { best = field; score = match; }
      }
      if (best && map[best] === undefined) map[best] = index;
    });
    const usable = map.title !== undefined && (map.date !== undefined || map.day !== undefined);
    return { rowIndex, map, score: usable ? Object.keys(map).length + (rowIndex < 3 ? 0.25 : 0) : 0 };
  });
  return candidates.sort((a, b) => b.score - a.score)[0];
}

function expandedRows(sheet: XLSX.WorkSheet) {
  const rows = XLSX.utils.sheet_to_json<Cell[]>(sheet, { header: 1, defval: '', raw: true, blankrows: true });
  for (const merge of sheet['!merges'] ?? []) {
    const value = rows[merge.s.r]?.[merge.s.c];
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      rows[r] ??= [];
      for (let c = merge.s.c; c <= merge.e.c; c++) if (!clean(rows[r][c])) rows[r][c] = value;
    }
  }
  return rows;
}

function sheetCategory(name: string): Category | null {
  const n = normalize(name);
  if (n.includes('교통국장')) return 'DIRECTOR';
  if (n.includes('시장') && (n.includes('부시장') || n.includes('주간'))) return 'MAYOR';
  return null;
}

export function parseDate(value: Cell, reference: string, monthValue?: Cell, date1904 = false): string | null {
  if (value instanceof Date && !Number.isNaN(+value)) return validDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  if (typeof value === 'number' && value > 31) {
    const d = XLSX.SSF.parse_date_code(value, { date1904 });
    return d ? validDate(d.y, d.m, d.d) : null;
  }
  const text = clean(value);
  const full = text.match(/(20\d{2}|19\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  if (full) return validDate(+full[1], +full[2], +full[3]);
  const shortYear = text.match(/^(\d{2})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\D|$)/);
  if (shortYear) return validDate(2000 + +shortYear[1], +shortYear[2], +shortYear[3]);
  const partial = text.match(/(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/);
  const month = partial ? +partial[1] : Number(clean(monthValue).match(/\d{1,2}/)?.[0]);
  const day = partial ? +partial[2] : Number(text.match(/^(\d{1,2})(?:\D|$)/)?.[1]);
  if (!month || !day) return null;
  const refYear = +reference.slice(0, 4);
  const candidates = [refYear - 1, refYear, refYear + 1].map(y => validDate(y, month, day)).filter((d): d is string => !!d);
  return candidates.sort((a, b) => Math.abs(Date.parse(a) - Date.parse(reference)) - Math.abs(Date.parse(b) - Date.parse(reference)))[0] ?? null;
}

export function parseTime(value: Cell): string | null {
  if (value instanceof Date && !Number.isNaN(+value)) return clock(value.getHours() * 60 + value.getMinutes());
  if (typeof value === 'number') {
    if (value >= 0 && value < 1) return clock(Math.round(value * 1440) % 1440);
    if (value >= 100 && value <= 2359 && Number.isInteger(value)) {
      const h = Math.floor(value / 100), m = value % 100;
      return h < 24 && m < 60 ? clock(h * 60 + m) : null;
    }
    return null;
  }
  const text = clean(value);
  if (!text || /종일|미정|오전\s*중|오후\s*중|추후|시간미정/.test(text)) return null;
  const match = text.match(/(?:^|[^\d])(\d{1,2})\s*[:：시]\s*(\d{1,2})?(?:\s*분)?/);
  const compact = !match ? text.match(/^(\d{2})(\d{2})$/) : null;
  const korean = !match && !compact ? text.match(/^(오전|오후)\s*(\d{1,2})(?:\s*시)?$/) : null;
  if (!match && !compact && !korean) return null;
  let h = +(match?.[1] ?? compact?.[1] ?? korean?.[2] ?? 0);
  const m = +(match?.[2] ?? compact?.[2] ?? 0);
  if (/오후/.test(text) && h < 12) h += 12;
  if (/오전/.test(text) && h === 12) h = 0;
  if (h === 24 && m === 0) return '24:00';
  return h >= 0 && h < 24 && m >= 0 && m < 60 ? clock(h * 60 + m) : null;
}

function referenceDate(workbook: XLSX.WorkBook, fileName: string) {
  const fileDate = fileName.match(/(20\d{2})(\d{2})(\d{2})/);
  if (fileDate) {
    const d = validDate(+fileDate[1], +fileDate[2], +fileDate[3]);
    if (d) return { date: d, assumed: false };
  }
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[name], { header: 1, raw: true });
    for (const row of rows.slice(0, 30)) for (const value of row) {
      if (typeof value === 'number' && value > 30000 && value < 110000) {
        const d = parseDate(value, todayInSeoul(), undefined, !!workbook.Workbook?.WBProps?.date1904);
        if (d) return { date: d, assumed: false };
      }
      if (typeof value === 'string' && /(?:19|20)\d{2}\s*[.\-/년]\s*\d{1,2}\s*[.\-/월]\s*\d{1,2}/.test(value)) {
        const d = parseDate(value, todayInSeoul());
        if (d) return { date: d, assumed: false };
      }
    }
  }
  return { date: todayInSeoul(), assumed: true };
}

export function parseWorkbook(workbook: XLSX.WorkBook, fileName: string): WeekDataset[] {
  const reference = referenceDate(workbook, fileName);
  const warnings: string[] = reference.assumed ? ['파일명과 시트에서 연도를 확인하지 못해 현재 한국 연도를 사용했습니다. 행사 날짜를 확인해 주세요.'] : [];
  const found: { name: string; category: Category; count: number }[] = [];
  const events: CalendarEvent[] = [];
  workbook.SheetNames.forEach((name, sheetIndex) => {
    const category = sheetCategory(name);
    if (!category) return;
    const rows = expandedRows(workbook.Sheets[name]);
    const header = findHeader(rows);
    if (!header?.score) { warnings.push(`${name}: 날짜·행사명 헤더를 찾지 못했습니다.`); return; }
    if (header.rowIndex > 2) warnings.push(`${name}: ${header.rowIndex + 1}행에서 헤더를 찾았습니다.`);
    const summary = { name, category, count: 0 };
    found.push(summary);
    const get = (row: Cell[], key: Field): Cell => header.map[key] === undefined ? '' : row[header.map[key]!];
    let lastDate: string | null = null;
    let month: Cell = '';
    const signatures = new Set<string>();
    rows.slice(header.rowIndex + 1).forEach((row, rowIndex) => {
      if (clean(get(row, 'month'))) month = get(row, 'month');
      const dateValue = get(row, 'date') || get(row, 'day');
      if (clean(dateValue)) lastDate = parseDate(dateValue, reference.date, month, !!workbook.Workbook?.WBProps?.date1904);
      const title = clean(get(row, 'title'));
      if (!title || aliases.title.includes(normalize(title)) || /^(합계|총계|계)\s*[:：]?\s*\d*\s*(건)?$/.test(title)) return;
      if (!lastDate) { warnings.push(`${name} ${header.rowIndex + rowIndex + 2}행: 날짜를 해석하지 못해 “${title}”을 제외했습니다.`); return; }
      const rawTimeValue = get(row, 'startTime');
      let rawTime: Cell = clean(rawTimeValue) ? rawTimeValue : header.map.startTime === undefined ? get(row, 'date') : '';
      if (header.map.startTime === undefined && typeof rawTime === 'number' && rawTime > 31) rawTime = rawTime % 1 > 0.000001 ? rawTime % 1 : '';
      const range = typeof rawTime === 'string' ? rawTime.split(/(?<=\d)\s*[~～–—-]\s*(?=(?:오전|오후)?\s*\d{1,2}[:：시])/) : [];
      let startTime = parseTime(range.length > 1 ? range[0] : rawTime);
      if (startTime === '24:00') startTime = null;
      let endTime = parseTime(get(row, 'endTime')) ?? (range.length > 1 ? parseTime(range[1]) : null);
      let endDate = lastDate;
      let endEstimated = false;
      if (startTime) {
        if (!endTime) {
          endEstimated = true;
          const end = minutes(startTime) + 60;
          endTime = clock(end);
          if (end >= 1440) endDate = addDate(lastDate, 1);
        } else if (minutes(endTime) <= minutes(startTime) || endTime === '24:00') {
          endDate = addDate(lastDate, 1);
          if (endTime === '24:00') endTime = '00:00';
        }
      } else endTime = null;
      const notes = clean(get(row, 'notes'));
      let attendees = clean(get(row, 'attendees'));
      if (!attendees && /시장|교통국장/.test(notes)) attendees = notes;
      if (category === 'DIRECTOR' && (!attendees || /^[oO○◯✓]$/.test(attendees))) attendees = '교통국장';
      const roles = identifyRoles(attendees, category);
      const event: CalendarEvent = {
        id: `${mondayOf(lastDate)}_${sheetIndex}_${rowIndex}`, date: lastDate,
        startTime, endTime, endDate, title, location: clean(get(row, 'location')),
        attendees, department: clean(get(row, 'department')), notes, category, ...roles,
        allDay: !startTime, timeLabel: startTime ? `${startTime}–${endTime}` : clean(rawTime) || '시간 미정', endEstimated,
      };
      const signature = JSON.stringify([event.date, event.startTime, event.endTime, event.title, event.location, event.attendees, event.department, event.notes]);
      if (signatures.has(signature)) return;
      signatures.add(signature);
      events.push(event); summary.count++;
    });
  });
  if (!found.length) throw new Error('행사 시트를 찾지 못했습니다. “시장-부시장 주간행사” 또는 “교통국장 주간행사” 시트와 날짜·행사명 헤더를 확인해 주세요.');
  for (const category of ['MAYOR', 'DIRECTOR'] as Category[]) if (!found.some(s => s.category === category)) warnings.push(`${category === 'MAYOR' ? '시장·부시장' : '교통국장'} 시트가 없습니다. 인식된 시트만 가져옵니다.`);
  if (!events.length) throw new Error('가져올 행사가 없습니다. 행사명과 날짜가 입력되어 있는지 확인해 주세요.');
  const weeks = [...new Set(events.map(e => mondayOf(e.date)))].sort();
  if (weeks.length > 1) warnings.push('여러 주차의 일정이 있어 주차별로 나누어 저장합니다.');
  return weeks.map(startDate => ({
    id: startDate, startDate, endDate: addDate(startDate, 6), label: weekLabel(startDate), sourceName: fileName,
    importedAt: new Date().toISOString(), isSample: false,
    events: events.filter(e => mondayOf(e.date) === startDate).sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    summaries: found.map(s => ({ ...s, count: events.filter(e => mondayOf(e.date) === startDate && e.category === s.category && e.id.split('_')[1] === String(workbook.SheetNames.indexOf(s.name))).length })),
    warnings,
  }));
}

export async function parseExcelFile(file: File): Promise<WeekDataset[]> {
  if (!/\.(xlsx|xls)$/i.test(file.name)) throw new Error('.xlsx 또는 .xls 파일을 선택해 주세요.');
  if (file.size > 20 * 1024 * 1024) throw new Error('20MB 이하의 엑셀 파일을 선택해 주세요.');
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false, cellNF: true });
    return parseWorkbook(workbook, file.name);
  } catch (error) {
    if (error instanceof Error && /시트|행사|파일|날짜/.test(error.message)) throw error;
    throw new Error('엑셀 파일을 읽지 못했습니다. 암호화되지 않은 정상 엑셀 파일인지 확인해 주세요.');
  }
}

export function downloadTemplate() {
  const monday = mondayOf(todayInSeoul());
  const wb = XLSX.utils.book_new();
  const headings = ['날짜', '시작시간', '종료시간', '행사명', '장소', '참석자', '주관부서', '비고'];
  for (const [name, role] of [['시장-부시장 주간행사', '시장'], ['교통국장주간행사', '교통국장']]) {
    const ws = XLSX.utils.aoa_to_sheet([
      [`${name} (${monday} ~ ${addDate(monday, 6)})`], headings,
      [monday, '09:00', '10:00', '주간 업무 보고', '상황실', role, '기획조정과', '예시 일정: 내용을 수정해 사용하세요.'],
      [addDate(monday, 1), '종일', '', '현장 점검', '사업 현장', role, '교통정책과', '시간 미정 예시'],
    ]);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];
    ws['!cols'] = [14, 12, 12, 32, 22, 18, 18, 44].map(wch => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  XLSX.writeFile(wb, `주간행사_입력서식_${monday.replaceAll('-', '')}.xlsx`);
}
