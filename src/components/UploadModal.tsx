import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, ArrowRight, LoaderCircle, FlaskConical } from 'lucide-react';
import type { WeekDataset } from '../types';
import { CATEGORY_LABEL } from '../types';
import { downloadTemplate, parseExcelFile } from '../lib/excelParser';
import Modal from './Modal';

export default function UploadModal({ existingWeeks, onSave, onClose, onSample }: { existingWeeks: WeekDataset[]; onSave: (weeks: WeekDataset[]) => Promise<void>; onClose: () => void; onSample: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [weeks, setWeeks] = useState<WeekDataset[]>([]);
  const [batchWarnings, setBatchWarnings] = useState<string[]>([]);
  const [replace, setReplace] = useState(false);
  const conflicts = weeks.filter(w => existingWeeks.some(e => e.id === w.id));
  async function readFiles(files: File[]) {
    const token = ++generation.current;
    setBusy(true); setError(''); setWeeks([]); setReplace(false); setBatchWarnings([]);
    try {
      const parsed = (await Promise.all(files.map(parseExcelFile))).flat();
      if (token !== generation.current) return;
      const unique = new Map<string, WeekDataset>();
      const duplicates: string[] = [];
      for (const week of parsed) {
        if (unique.has(week.id)) duplicates.push(`${week.label}: 선택한 파일끼리 주차가 겹칩니다. 마지막 선택 파일(${week.sourceName})을 사용합니다.`);
        unique.set(week.id, week);
      }
      setWeeks([...unique.values()].sort((a, b) => a.id.localeCompare(b.id))); setBatchWarnings(duplicates);
    } catch (err) { if (token === generation.current) setError(err instanceof Error ? err.message : '파일을 읽는 중 오류가 발생했습니다.'); }
    finally { if (token === generation.current) setBusy(false); }
  }
  function drop(event: DragEvent) { event.preventDefault(); setDragging(false); if (!saving) void readFiles([...event.dataTransfer.files]); }
  function choose(event: ChangeEvent<HTMLInputElement>) { if (event.target.files?.length) void readFiles([...event.target.files]); event.target.value = ''; }
  async function save() {
    if (!weeks.length || conflicts.length && !replace) return;
    setSaving(true); setError('');
    try { await onSave(weeks); onClose(); }
    catch { setError('저장하지 못했습니다. 브라우저 저장 공간과 사이트 권한을 확인해 주세요. 기존 데이터는 유지됩니다.'); }
    finally { setSaving(false); }
  }
  return <Modal title="주간행사 엑셀 가져오기" onClose={() => { if (!saving) { generation.current++; onClose(); } }} wide>
    <p className="modal-intro">엑셀 한 장으로 한 주의 일정을 정리하세요.<br />파일은 이 브라우저에서만 처리하고 저장합니다.</p>
    <input ref={input} type="file" accept=".xlsx,.xls" multiple onChange={choose} className="sr-only" aria-label="주간행사 엑셀 파일 선택" />
    <div className={`drop-zone ${dragging ? 'dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop}>
      <div className="upload-symbol">{busy ? <LoaderCircle className="spin" size={29} /> : <UploadCloud size={29} />}</div>
      <strong>{busy ? '일정 데이터를 읽고 있습니다' : '엑셀 파일을 여기에 놓아주세요'}</strong><span>.xlsx, .xls · 파일당 최대 20MB · 여러 파일 선택 가능</span>
      <button type="button" className="button secondary" disabled={busy || saving} onClick={() => input.current?.click()}><FileSpreadsheet size={16} />파일 선택하기</button>
    </div>
    {error && <div className="notice error" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}
    {weeks.length > 0 && <div className="parse-results" aria-live="polite"><div className="parse-heading"><CheckCircle2 size={19} /><strong>{weeks.length}개 주차 · {weeks.reduce((sum, w) => sum + w.events.length, 0)}건 인식 완료</strong></div>{weeks.map(week => <div key={week.id} className="parsed-week"><strong>{week.label}</strong><small>{week.sourceName}</small>{week.summaries.map((s, i) => <div key={`${s.name}-${i}`}><span className={`legend-dot ${s.category === 'MAYOR' ? 'blue' : 'green'}`} /><span>{CATEGORY_LABEL[s.category]} <small>({s.name})</small></span><b>{s.count}건</b></div>)}</div>)}</div>}
    {[...new Set([...batchWarnings, ...weeks.flatMap(w => w.warnings)])].map(warning => <div key={warning} className="notice warning"><AlertTriangle size={17} /><span>{warning}</span></div>)}
    {conflicts.length > 0 && <div className="replace-confirm"><strong><AlertTriangle size={17} />이미 저장된 주차가 있습니다</strong>{conflicts.map(w => <p key={w.id}>{w.label}<br /><span>기존 {existingWeeks.find(e => e.id === w.id)!.events.length}건 → 새 파일 {w.events.length}건</span></p>)}<label><input type="checkbox" checked={replace} onChange={event => setReplace(event.target.checked)} disabled={saving} />기존 주차의 전체 일정을 새 파일로 교체합니다.</label></div>}
    <div className="upload-helpers"><button type="button" onClick={downloadTemplate}><Download size={15} />샘플 엑셀 서식 다운로드</button><button type="button" disabled={saving} onClick={onSample}><FlaskConical size={15} />샘플 데이터로 체험하기</button></div>
    <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={onClose}>취소</button><button type="button" className="button primary" disabled={!weeks.length || busy || saving || !!conflicts.length && !replace} onClick={save}>{saving ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}{saving ? '저장 중…' : conflicts.length ? '확인한 주차 교체 및 저장' : '주간 일정 저장하기'}</button></div>
  </Modal>;
}
