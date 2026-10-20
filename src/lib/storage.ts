import type { ViewState, WeekDataset } from '../types';

const DATABASE = 'weekly-governance-v1';
const STORE = 'weeks';
const VIEW_KEY = 'weekly-governance-view-v1';
let pending: Promise<IDBDatabase> | undefined;
function database() {
  pending ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('이 브라우저에서 로컬 저장소를 사용할 수 없습니다.')); return; }
    const req = indexedDB.open(DATABASE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => { req.result.onversionchange = () => { req.result.close(); pending = undefined; }; resolve(req.result); };
    req.onerror = () => { pending = undefined; reject(req.error); };
    req.onblocked = () => { pending = undefined; reject(new Error('다른 창이 저장소 갱신을 막고 있습니다. 다른 창을 닫아 주세요.')); };
  });
  return pending;
}

export async function loadWeeks(): Promise<WeekDataset[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    tx.oncomplete = () => resolve(req.result as WeekDataset[]);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// One transaction: replacing several weeks either succeeds entirely or keeps all old data.
export async function saveWeeks(weeks: WeekDataset[]): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    for (const week of weeks) tx.objectStore(STORE).put(week);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function readView(): ViewState {
  const defaultState: ViewState = { selectedWeek: '', category: 'ALL', query: '', roles: [], time: 'ALL', view: 'GRID' };
  try {
    const raw = JSON.parse(localStorage.getItem(VIEW_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return defaultState;
    return {
      selectedWeek: typeof raw.selectedWeek === 'string' ? raw.selectedWeek : '',
      category: ['ALL', 'MAYOR', 'DIRECTOR'].includes(raw.category) ? raw.category : 'ALL',
      query: typeof raw.query === 'string' ? raw.query : '',
      roles: Array.isArray(raw.roles) ? raw.roles.filter((r: unknown) => ['시장', '부시장', '교통국장'].includes(String(r))) : [],
      time: ['ALL', 'AM', 'PM', 'OTHER'].includes(raw.time) ? raw.time : 'ALL',
      view: raw.view === 'LIST' ? 'LIST' : 'GRID',
    };
  } catch { return defaultState; }
}
export function saveView(state: ViewState) { localStorage.setItem(VIEW_KEY, JSON.stringify(state)); }
