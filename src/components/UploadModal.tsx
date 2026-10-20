import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, Download, ArrowRight, LoaderCircle, FlaskConical, FolderGit2, Edit3, RefreshCw } from 'lucide-react';
import type { WeekDataset } from '../types';
import { CATEGORY_LABEL } from '../types';
import { downloadTemplate, parseExcelFile } from '../lib/excelParser';
import Modal from './Modal';

function isServerApiAvailable(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') {
      return false;
    }
    return (
      typeof window !== 'undefined' &&
      Boolean(window.location?.origin) &&
      window.location.origin !== 'null' &&
      !window.location.origin.startsWith('about:')
    );
  } catch {
    return false;
  }
}

function suggestNewFileName(name: string): string {
  const ext = name.toLowerCase().endsWith('.xls') ? '.xls' : '.xlsx';
  const base = name.replace(/\.xlsx?$/i, '');
  const match = base.match(/_v(\d+)$/);
  if (match) {
    const nextVer = parseInt(match[1], 10) + 1;
    return `${base.slice(0, match.index)}_v${nextVer}${ext}`;
  }
  return `${base}_v2${ext}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadModal({
  existingWeeks,
  onSave,
  onClose,
  onSample,
}: {
  existingWeeks: WeekDataset[];
  onSave: (weeks: WeekDataset[], customToast?: string) => Promise<void>;
  onClose: () => void;
  onSample: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStep, setSaveStep] = useState('');
  const [error, setError] = useState('');
  const [weeks, setWeeks] = useState<WeekDataset[]>([]);
  const [batchWarnings, setBatchWarnings] = useState<string[]>([]);
  const [replace, setReplace] = useState(false);
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [fileConflict, setFileConflict] = useState(false);
  const [fileResolveMode, setFileResolveMode] = useState<'replace' | 'rename'>('replace');
  const [customFileName, setCustomFileName] = useState('');

  const conflicts = weeks.filter(w => existingWeeks.some(e => e.id === w.id));

  async function checkServerFile(filename: string): Promise<boolean> {
    if (!isServerApiAvailable()) return false;
    try {
      const res = await fetch('/api/check-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { exists?: boolean };
      return Boolean(data.exists);
    } catch {
      return false;
    }
  }

  async function readFiles(files: File[]) {
    const token = ++generation.current;
    setBusy(true);
    setError('');
    setWeeks([]);
    setReplace(false);
    setBatchWarnings([]);
    setRawFiles(files);
    setFileConflict(false);

    try {
      const parsed = (await Promise.all(files.map(parseExcelFile))).flat();
      if (token !== generation.current) return;

      const unique = new Map<string, WeekDataset>();
      const duplicates: string[] = [];
      for (const week of parsed) {
        if (unique.has(week.id)) {
          duplicates.push(`${week.label}: 선택한 파일끼리 주차가 겹칩니다. 마지막 선택 파일(${week.sourceName})을 사용합니다.`);
        }
        unique.set(week.id, week);
      }
      setWeeks([...unique.values()].sort((a, b) => a.id.localeCompare(b.id)));
      setBatchWarnings(duplicates);

      // 서버의 event 폴더 내 동일 파일명 존재 여부 확인
      if (files.length > 0) {
        const existsOnServer = await checkServerFile(files[0].name);
        if (token === generation.current && existsOnServer) {
          setFileConflict(true);
          setFileResolveMode('replace');
          setCustomFileName(suggestNewFileName(files[0].name));
          setReplace(true);
        }
      }
    } catch (err: unknown) {
      if (token === generation.current) {
        setError(err instanceof Error ? err.message : '파일을 읽는 중 오류가 발생했습니다.');
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!saving) void readFiles([...event.dataTransfer.files]);
  }

  function choose(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) void readFiles([...event.target.files]);
    event.target.value = '';
  }

  async function save() {
    if (!weeks.length || (conflicts.length && !replace)) return;
    if (fileConflict && fileResolveMode === 'rename' && !customFileName.trim()) {
      setError('수정할 파일명을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError('');
    setSaveStep('event 폴더 저장 및 GitHub 업로드 중…');

    let toastMsg = '';
    const rawFile = rawFiles[0];

    // 1. 서버 API가 사용 가능한 환경(브라우저 개발 서버 등)인 경우 event 폴더 저장 및 GitHub 업로드 실행
    if (rawFile && isServerApiAvailable()) {
      try {
        const finalName = (fileConflict && fileResolveMode === 'rename')
          ? customFileName.trim()
          : rawFile.name;
        const base64 = await fileToBase64(rawFile);

        const res = await fetch('/api/upload-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: finalName,
            contentBase64: base64,
            overwrite: fileResolveMode === 'replace',
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as { success?: boolean; filename?: string; gitPushed?: boolean; gitMessage?: string };
          if (data.gitPushed) {
            toastMsg = `event/${data.filename} 파일이 저장되고 GitHub(main/event)에 성공적으로 업로드되었습니다.`;
          } else if (data.gitMessage) {
            toastMsg = `event/${data.filename} 저장 완료 (${data.gitMessage})`;
          }
        } else {
          const errData = (await res.json().catch(() => null)) as { code?: string; error?: string } | null;
          if (errData?.code === 'EXISTS') {
            setError(errData.error || '동일한 파일이 이미 존재합니다.');
            setSaving(false);
            return;
          }
        }
      } catch (err: unknown) {
        console.warn('Backend upload skipped or error:', err);
      }
    }

    // 2. 브라우저 로컬 데이터베이스(IndexedDB)에 주간 일정 저장 및 대시보드 반영
    try {
      await onSave(weeks, toastMsg || undefined);
      onClose();
    } catch {
      setError('저장하지 못했습니다. 브라우저 저장 공간과 사이트 권한을 확인해 주세요. 기존 데이터는 유지됩니다.');
    } finally {
      setSaving(false);
      setSaveStep('');
    }
  }

  const primaryButtonDisabled =
    !weeks.length ||
    busy ||
    saving ||
    (Boolean(conflicts.length) && !replace) ||
    (fileConflict && fileResolveMode === 'rename' && !customFileName.trim());

  return (
    <Modal
      title="주간행사 엑셀 가져오기 및 저장"
      onClose={() => {
        if (!saving) {
          generation.current++;
          onClose();
        }
      }}
      wide
    >
      <p className="modal-intro">
        엑셀 한 장으로 한 주의 일정을 정리하세요.
        <br />
        업로드 시 로컬 <code>event</code> 폴더에 보관되고 GitHub(main/event)에 자동으로 동기화됩니다.
      </p>

      <div className="sync-target-info">
        <FolderGit2 size={14} />
        <span>
          저장 위치: <b>event/</b> 폴더 · 저장소:{' '}
          <a href="https://github.com/nyj-worker/nyj-cal/tree/main/event" target="_blank" rel="noreferrer">
            github.com/nyj-worker/nyj-cal/tree/main/event
          </a>
        </span>
      </div>

      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls"
        multiple
        onChange={choose}
        className="sr-only"
        aria-label="주간행사 엑셀 파일 선택"
      />

      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={event => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
      >
        <div className="upload-symbol">
          {busy ? <LoaderCircle className="spin" size={29} /> : <UploadCloud size={29} />}
        </div>
        <strong>{busy ? '일정 데이터를 읽고 있습니다' : '엑셀 파일을 여기에 놓아주세요'}</strong>
        <span>.xlsx, .xls · 파일당 최대 20MB · 여러 파일 선택 가능</span>
        <button
          type="button"
          className="button secondary"
          disabled={busy || saving}
          onClick={() => input.current?.click()}
        >
          <FileSpreadsheet size={16} />
          파일 선택하기
        </button>
      </div>

      {error && (
        <div className="notice error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {weeks.length > 0 && (
        <div className="parse-results" aria-live="polite">
          <div className="parse-heading">
            <CheckCircle2 size={19} />
            <strong>
              {weeks.length}개 주차 · {weeks.reduce((sum, w) => sum + w.events.length, 0)}건 인식 완료
            </strong>
          </div>
          {weeks.map(week => (
            <div key={week.id} className="parsed-week">
              <strong>{week.label}</strong>
              <small>{week.sourceName}</small>
              {week.summaries.map((s, i) => (
                <div key={`${s.name}-${i}`}>
                  <span className={`legend-dot ${s.category === 'MAYOR' ? 'blue' : 'green'}`} />
                  <span>
                    {CATEGORY_LABEL[s.category]} <small>({s.name})</small>
                  </span>
                  <b>{s.count}건</b>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* 파일명 중복 해결 UI */}
      {fileConflict && rawFiles.length > 0 && (
        <div className="file-conflict-card" role="region" aria-label="파일명 중복 안내">
          <div className="file-conflict-header">
            <AlertTriangle size={17} />
            <strong>동일한 파일이 event 폴더에 이미 존재합니다</strong>
          </div>
          <p className="file-conflict-desc">
            <code>{rawFiles[0].name}</code> 파일이 이미 저장소에 보관되어 있습니다. 어떻게 처리할지 선택해 주세요.
          </p>

          <div className="conflict-options-group">
            <label className={`conflict-option-item ${fileResolveMode === 'replace' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="fileResolveMode"
                value="replace"
                checked={fileResolveMode === 'replace'}
                onChange={() => {
                  setFileResolveMode('replace');
                  setReplace(true);
                }}
                disabled={saving}
              />
              <div className="conflict-option-content">
                <strong><RefreshCw size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />기존 파일 교체 (덮어쓰기)</strong>
                <span>기존 동일 이름의 파일을 새로운 파일 내용으로 덮어쓰고 GitHub에 업데이트합니다.</span>
              </div>
            </label>

            <label className={`conflict-option-item ${fileResolveMode === 'rename' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="fileResolveMode"
                value="rename"
                checked={fileResolveMode === 'rename'}
                onChange={() => setFileResolveMode('rename')}
                disabled={saving}
              />
              <div className="conflict-option-content">
                <strong><Edit3 size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />기존 파일명을 수정하여 저장</strong>
                <span>기존 파일은 그대로 보존하고, 새 파일명으로 복사 저장하여 GitHub에 업로드합니다.</span>
                {fileResolveMode === 'rename' && (
                  <div className="rename-input-box">
                    <input
                      type="text"
                      value={customFileName}
                      onChange={e => setCustomFileName(e.target.value)}
                      placeholder="새 파일명 입력 (예: 주간행사계획_..._v2.xlsx)"
                      disabled={saving}
                      aria-label="새 파일명 입력"
                    />
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>
      )}

      {[...new Set([...batchWarnings, ...weeks.flatMap(w => w.warnings)])].map(warning => (
        <div key={warning} className="notice warning">
          <AlertTriangle size={17} />
          <span>{warning}</span>
        </div>
      ))}

      {conflicts.length > 0 && (
        <div className="replace-confirm">
          <strong>
            <AlertTriangle size={17} />
            이미 저장된 주차가 있습니다
          </strong>
          {conflicts.map(w => (
            <p key={w.id}>
              {w.label}
              <br />
              <span>
                기존 {existingWeeks.find(e => e.id === w.id)!.events.length}건 → 새 파일 {w.events.length}건
              </span>
            </p>
          ))}
          <label>
            <input
              type="checkbox"
              checked={replace}
              onChange={event => setReplace(event.target.checked)}
              disabled={saving}
            />
            기존 주차의 전체 일정을 새 파일로 교체합니다.
          </label>
        </div>
      )}

      <div className="upload-helpers">
        <button type="button" onClick={downloadTemplate}>
          <Download size={15} />
          샘플 엑셀 서식 다운로드
        </button>
        <button type="button" disabled={saving} onClick={onSample}>
          <FlaskConical size={15} />
          샘플 데이터로 체험하기
        </button>
      </div>

      <div className="modal-actions">
        <button type="button" className="button secondary" disabled={saving} onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="button primary"
          disabled={primaryButtonDisabled}
          onClick={save}
        >
          {saving ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <ArrowRight size={16} />
          )}
          {saving
            ? saveStep || '저장 중…'
            : conflicts.length
              ? '확인한 주차 교체 및 저장'
              : fileConflict && fileResolveMode === 'rename'
                ? '새 파일명으로 저장 및 GitHub 업로드'
                : '주간 일정 저장하기'}
        </button>
      </div>
    </Modal>
  );
}
