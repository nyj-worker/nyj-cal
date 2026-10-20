// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import UploadModal from '../src/components/UploadModal';
import { parseWorkbook } from '../src/lib/excelParser';
import { createSampleWeek } from '../src/lib/sampleData';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
afterEach(cleanup);

function actualFile() {
  const buffer = readFileSync(resolve('주간행사계획_20261019_20261025.xlsx'));
  // jsdom and Node have distinct ArrayBuffer realms. Use Uint8Array at the test boundary.
  const data = new Uint8Array(buffer);
  const file = new File([data], '주간행사계획_20261019_20261025.xlsx');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => data });
  return file;
}

describe('실제 파일 업로드 모달 흐름', () => {
  it('실제 엑셀 28건을 미리 보고 동일 주차 확인 후 저장한다', async () => {
    const file = actualFile();
    const [existing] = parseWorkbook(XLSX.read(await file.arrayBuffer(), { type: 'array' }), file.name);
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<UploadModal existingWeeks={[{ ...existing, events: existing.events.slice(0, 5) }]} onSave={onSave} onClose={onClose} onSample={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('주간행사 엑셀 파일 선택'), { target: { files: [file] } });
    await screen.findByText('1개 주차 · 28건 인식 완료');
    expect(screen.getByText('24건')).toBeTruthy(); expect(screen.getByText('4건')).toBeTruthy();
    const save = screen.getByRole('button', { name: '확인한 주차 교체 및 저장' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await userEvent.click(screen.getByRole('checkbox'));
    expect(save.disabled).toBe(false);
    await userEvent.click(save);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0][0].events).toHaveLength(28);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('다른 주차의 일정은 교체 확인 없이 추가하며 저장 실패를 표시한다', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('QuotaExceededError'));
    const onClose = vi.fn();
    const sample = { ...createSampleWeek(), id: '2026-10-12' };
    render(<UploadModal existingWeeks={[sample]} onSave={onSave} onClose={onClose} onSample={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('주간행사 엑셀 파일 선택'), { target: { files: [actualFile()] } });
    await screen.findByText('1개 주차 · 28건 인식 완료');
    expect(screen.queryByRole('checkbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '주간 일정 저장하기' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('기존 데이터는 유지됩니다');
    expect(onClose).not.toHaveBeenCalled();
  });
  it('엑셀 형식이 아닌 파일을 거부한다', async () => {
    render(<UploadModal existingWeeks={[]} onSave={vi.fn()} onClose={vi.fn()} onSample={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('주간행사 엑셀 파일 선택'), { target: { files: [new File(['hello'], 'test.txt')] } });
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('.xlsx 또는 .xls');
  });
});
