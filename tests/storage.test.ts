import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { loadWeeks, saveWeeks } from '../src/lib/storage';
import { createSampleWeek } from '../src/lib/sampleData';

describe('IndexedDB 주차 보관', () => {
  it('다른 주차는 누적하고 동일 ID는 해당 주차만 교체한다', async () => {
    const sample = createSampleWeek();
    const a = { ...sample, id: '2026-10-19', sourceName: '첫 파일' };
    const b = { ...sample, id: '2026-10-26', sourceName: '둘째 파일' };
    await saveWeeks([a]); await saveWeeks([b]);
    expect(await loadWeeks()).toHaveLength(2);
    await saveWeeks([{ ...a, sourceName: '교체 파일', events: a.events.slice(0, 2) }]);
    const result = await loadWeeks();
    expect(result).toHaveLength(2);
    expect(result.find(w => w.id === a.id)).toMatchObject({ sourceName: '교체 파일', events: a.events.slice(0, 2) });
    expect(result.find(w => w.id === b.id)?.sourceName).toBe('둘째 파일');
  });
});
