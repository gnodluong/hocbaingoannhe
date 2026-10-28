/**
 * web-smoke.mjs — Kiểm thử đầu-cuối bản WEB bằng một trình duyệt Chromium thật.
 *
 *   node tools/web-smoke.mjs
 *
 * Cách làm: dựng máy chủ tĩnh, mở trang bằng Electron (Chromium) với
 * nodeIntegration TẮT — đúng môi trường như người dùng mở bằng Chrome/Edge —
 * rồi chạy kịch bản kiểm thử trong trang (tools/smoke-app/main.cjs).
 *
 * Chạy HAI pha:
 *   1. "full"    — máy chủ bật: kiểm tra toàn bộ tính năng.
 *   2. "offline" — TẮT máy chủ rồi mở lại đúng địa chỉ đó: chứng minh service
 *                  worker đã lưu đủ để app chạy khi không có mạng.
 *
 * Đặt TN_SHOTS=<thư mục> để chụp ảnh các màn hình chính trong pha 1.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, ROOT } from './serve.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Hồ sơ trình duyệt riêng cho lần chạy này: dữ liệu thật của người dùng không bị
// đụng tới, và kết quả kiểm thử không phụ thuộc những lần chạy trước.
const PROFILE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tn-web-smoke-'));

function findElectron() {
  const candidates = [
    path.join(ROOT, '..', 'electron-app', 'node_modules', 'electron', 'dist', 'electron.exe'),
    path.join(ROOT, 'node_modules', 'electron', 'dist', 'electron.exe'),
    process.env.TN_ELECTRON || '',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return 'electron';
}

/** Mở địa chỉ bằng Chromium và chạy một pha kiểm thử. */
function runPhase(electron, url, phase) {
  return new Promise((resolve) => {
    const env = { ...process.env, ELECTRON_ENABLE_LOGGING: '0', TN_SMOKE_PHASE: phase, TN_PROFILE_DIR: PROFILE_DIR };
    // Máy nào đang đặt ELECTRON_RUN_AS_NODE=1 thì phải bỏ biến đó, nếu không
    // Electron sẽ chạy như Node thuần và không mở được cửa sổ trình duyệt.
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.ELECTRON_NO_ATTACH_CONSOLE;

    const child = spawn(electron, [path.join('tools', 'smoke-app'), url], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('exit', (code) => {
      const line = stdout.split('\n').find((l) => l.startsWith('SMOKE_RESULT '));
      const fatal = stdout.split('\n').find((l) => l.startsWith('SMOKE_FATAL '));
      const shots = stdout
        .split('\n')
        .filter((l) => l.startsWith('SHOT '))
        .map((l) => l.slice('SHOT '.length));
      resolve({ code, stdout, stderr, line, fatal, shots });
    });
  });
}

function report(phase, outcome) {
  const title =
    phase === 'offline'
      ? 'KIỂM THỬ KHÔNG CÓ MẠNG'
      : phase === 'mobile'
        ? 'KIỂM THỬ BỐ CỤC ĐIỆN THOẠI (390×844)'
        : 'KIỂM THỬ BẢN WEB';
  console.log(`\n=============== ${title} ===============`);
  if (outcome.line) {
    const result = JSON.parse(outcome.line.slice('SMOKE_RESULT '.length));
    result.results.forEach((r) => {
      console.log(`${r.pass ? '✓' : '✗'} ${r.name}${r.extra ? '  (' + r.extra + ')' : ''}`);
    });
    console.log('------------------------------------------------');
    console.log(`ĐẠT ${result.passed}/${result.total}`);
    if (result.failed.length) {
      console.log('MỤC CHƯA ĐẠT:');
      result.failed.forEach((r) => console.log('  ✗ ' + r.name + '  ' + r.extra));
    }
    if (result.consoleErrors && result.consoleErrors.length) {
      console.log('LỖI CONSOLE (' + result.consoleErrors.length + '):');
      result.consoleErrors.slice(0, 10).forEach((m) => console.log('  ! ' + m));
    }
    console.log('================================================');
    return result.failed.length ? 1 : 0;
  }
  if (outcome.fatal) {
    console.log('LỖI NGHIÊM TRỌNG:', outcome.fatal.slice('SMOKE_FATAL '.length));
  } else {
    console.log('Không nhận được kết quả. exit=' + outcome.code);
    console.log('--- stdout ---\n' + outcome.stdout.slice(-2000));
    console.log('--- stderr ---\n' + outcome.stderr.slice(-2000));
  }
  return 1;
}

const electron = findElectron();
if (electron === 'electron') {
  console.error('Không tìm thấy Electron. Đặt TN_ELECTRON trỏ tới electron.exe để chạy kiểm thử.');
  process.exit(1);
}
console.log('Trình duyệt thử:', electron);

// Cổng cố định để pha offline mở lại ĐÚNG địa chỉ đã lưu trong service worker.
const PORT = Number(process.env.TN_SMOKE_PORT || 5180);
const server = createServer();
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(PORT, '127.0.0.1', resolve);
});
const url = `http://127.0.0.1:${PORT}/`;
console.log('Máy chủ thử:', url);

const phaseOne = await runPhase(electron, url, 'full');
const codeOne = report('full', phaseOne);
if (phaseOne.shots.length) {
  console.log(`Đã chụp ${phaseOne.shots.length} ảnh vào ${path.dirname(phaseOne.shots[0])}`);
}

const phaseMobile = await runPhase(electron, url, 'mobile');
const codeMobile = report('mobile', phaseMobile);

await new Promise((resolve) => server.close(resolve));
console.log('\nĐã TẮT máy chủ — mở lại địa chỉ cũ để chắc chắn app chạy được offline…');
const phaseTwo = await runPhase(electron, url, 'offline');
const codeTwo = report('offline', phaseTwo);

try { fs.rmSync(PROFILE_DIR, { recursive: true, force: true }); } catch (err) { /* Electron có thể còn giữ tệp */ }
process.exit(codeOne || codeMobile || codeTwo ? 1 : 0);
