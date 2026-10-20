import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { IncomingMessage, ServerResponse } from 'node:http';

function eventManagerPlugin(): Plugin {
  const eventDir = path.resolve(process.cwd(), 'event');

  function getEventFiles() {
    if (!fs.existsSync(eventDir)) {
      fs.mkdirSync(eventDir, { recursive: true });
    }
    const files = fs.readdirSync(eventDir, { withFileTypes: true });
    return files
      .filter(f => f.isFile() && (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) && !f.name.startsWith('~$'))
      .map(f => {
        const stats = fs.statSync(path.join(eventDir, f.name));
        return {
          name: f.name,
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        };
      });
  }

  function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => resolve(data));
      req.on('error', reject);
    });
  }

  function setupMiddleware(middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }) {
    middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const url = req.url || '';

      // 1. GET /api/event-files
      if (url === '/api/event-files' && req.method === 'GET') {
        try {
          const files = getEventFiles();
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, files }));
        } catch (err: unknown) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : '파일 목록을 읽는 중 오류가 발생했습니다.' }));
        }
        return;
      }

      // 2. POST /api/check-file
      if (url === '/api/check-file' && req.method === 'POST') {
        try {
          const bodyStr = await readBody(req);
          const body = JSON.parse(bodyStr || '{}') as { filename?: string };
          const rawName = String(body.filename || '');
          const safeName = path.basename(rawName).trim();
          if (!safeName) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: '파일명이 제공되지 않았습니다.' }));
            return;
          }
          const targetPath = path.join(eventDir, safeName);
          const exists = fs.existsSync(targetPath);
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, exists, filename: safeName }));
        } catch (err: unknown) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : '파일 확인 중 오류가 발생했습니다.' }));
        }
        return;
      }

      // 3. POST /api/upload-event
      if (url === '/api/upload-event' && req.method === 'POST') {
        try {
          const bodyStr = await readBody(req);
          const body = JSON.parse(bodyStr || '{}') as { filename?: string; contentBase64?: string; overwrite?: boolean };
          const rawName = String(body.filename || '');
          let safeName = path.basename(rawName).trim();
          const contentBase64 = String(body.contentBase64 || '');
          const overwrite = Boolean(body.overwrite);

          if (!safeName) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: '파일명이 필요합니다.' }));
            return;
          }
          if (!safeName.toLowerCase().endsWith('.xlsx') && !safeName.toLowerCase().endsWith('.xls')) {
            safeName += '.xlsx';
          }
          if (!contentBase64) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, error: '파일 내용 데이터가 없습니다.' }));
            return;
          }

          if (!fs.existsSync(eventDir)) {
            fs.mkdirSync(eventDir, { recursive: true });
          }

          const targetPath = path.join(eventDir, safeName);
          const alreadyExists = fs.existsSync(targetPath);

          if (alreadyExists && !overwrite) {
            res.statusCode = 409;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({
              success: false,
              code: 'EXISTS',
              error: '동일한 이름의 파일이 이미 존재합니다. 기존 파일 교체(덮어쓰기) 또는 파일명 수정을 선택해 주세요.',
              filename: safeName,
            }));
            return;
          }

          // 로컬 event 폴더에 파일 쓰기
          const buffer = Buffer.from(contentBase64, 'base64');
          fs.writeFileSync(targetPath, buffer);

          // Git 커밋 & 푸시
          let gitPushed = false;
          let gitMessage = '';
          try {
            execFileSync('git', ['add', `event/${safeName}`], { cwd: process.cwd(), encoding: 'utf-8' });
            const status = execFileSync('git', ['status', '--porcelain', `event/${safeName}`], { cwd: process.cwd(), encoding: 'utf-8' });
            if (status.trim()) {
              execFileSync('git', ['commit', '-m', `feat(event): 주간행사 파일 업로드 (${safeName})`], { cwd: process.cwd(), encoding: 'utf-8' });
            }
            execFileSync('git', ['push', 'origin', 'main'], { cwd: process.cwd(), encoding: 'utf-8' });
            gitPushed = true;
            gitMessage = 'GitHub(main/event)에 성공적으로 푸시되었습니다.';
          } catch (gitErr: unknown) {
            console.error('[eventManagerPlugin] Git commit/push warning:', gitErr instanceof Error ? gitErr.message : gitErr);
            gitPushed = false;
            gitMessage = `로컬 event 폴더에는 저장되었으나 GitHub 동기화 중 안내: ${gitErr instanceof Error ? gitErr.message : String(gitErr)}`;
          }

          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: true,
            filename: safeName,
            alreadyExisted: alreadyExists,
            overwritten: alreadyExists && overwrite,
            savedPath: targetPath,
            gitPushed,
            gitMessage,
          }));
        } catch (err: unknown) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : '파일 저장 중 서버 오류가 발생했습니다.' }));
        }
        return;
      }

      next();
    });
  }

  return {
    name: 'event-file-manager',
    configureServer(server) {
      setupMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      setupMiddleware(server.middlewares);
    },
    closeBundle() {
      const distEventDir = path.resolve(process.cwd(), 'dist', 'event');
      if (fs.existsSync(eventDir)) {
        fs.mkdirSync(distEventDir, { recursive: true });
        const files = fs.readdirSync(eventDir);
        for (const file of files) {
          const src = path.join(eventDir, file);
          const dest = path.join(distEventDir, file);
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest);
          }
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), eventManagerPlugin()],
  base: './',
  build: { chunkSizeWarningLimit: 700 },
});

