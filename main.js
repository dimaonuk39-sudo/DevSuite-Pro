const { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const dns = require('dns');
const os = require('os');
const crypto = require('crypto');

app.setAppUserModelId('pro.devsuite.app');

let mainWindow = null;
const activeRequests = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#0b0d14',
    title: 'DevSuite Pro',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });
}

const template = [
  {
    label: 'Файл',
    submenu: [
      { label: 'Перезагрузить', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.reload() },
      { label: 'DevTools', accelerator: 'F12', click: () => mainWindow && mainWindow.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: 'Выход', accelerator: 'Alt+F4', role: 'quit' }
    ]
  },
  {
    label: 'Правка',
    submenu: [
      { role: 'undo', label: 'Отменить' }, { role: 'redo', label: 'Повторить' }, { type: 'separator' },
      { role: 'cut', label: 'Вырезать' }, { role: 'copy', label: 'Копировать' }, { role: 'paste', label: 'Вставить' },
      { role: 'selectAll', label: 'Выделить всё' }
    ]
  },
  {
    label: 'Вид',
    submenu: [
      { role: 'resetZoom', label: 'Масштаб 100%' },
      { role: 'zoomIn', label: 'Увеличить' },
      { role: 'zoomOut', label: 'Уменьшить' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'На весь экран' }
    ]
  },
  {
    label: 'Справка',
    submenu: [
      { label: 'О программе', click: () => mainWindow && mainWindow.webContents.executeJavaScript("window.DS && DS.openTool && DS.openTool('about')") }
    ]
  }
];

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => {
  for (const req of activeRequests.values()) { try { req.destroy(); } catch (_) {} }
});

/* ----------------------------- HTTP proxy ----------------------------- */

function decompressor(encoding) {
  const enc = String(encoding || '').toLowerCase().trim();
  if (enc === 'gzip' || enc === 'x-gzip') return zlib.createGunzip();
  if (enc === 'deflate') return zlib.createInflate();
  if (enc === 'br') return zlib.createBrotliDecompress();
  if (enc === 'zstd' && typeof zlib.createZstdDecompress === 'function') return zlib.createZstdDecompress();
  return null;
}

function doRequest(opts, sender, id, redirectCount = 0) {
  return new Promise((resolve) => {
    let target;
    try { target = new URL(opts.url); } catch (e) {
      sender.send('http:error', { id, message: 'Некорректный URL: ' + opts.url });
      return resolve();
    }
    if (!/^https?:$/.test(target.protocol)) {
      sender.send('http:error', { id, message: 'Поддерживаются только http:// и https://' });
      return resolve();
    }

    const lib = target.protocol === 'https:' ? https : http;
    const headers = Object.assign({ 'User-Agent': 'DevSuite-Pro/1.0', 'Accept-Encoding': 'gzip, deflate, br' }, opts.headers || {});
    const bodyBuf = opts.bodyBase64 ? Buffer.from(opts.bodyBase64, 'base64')
      : (opts.body != null ? Buffer.from(String(opts.body), 'utf8') : null);
    if (bodyBuf) headers['Content-Length'] = bodyBuf.length;
    else if (opts.method !== 'GET' && opts.method !== 'HEAD') headers['Content-Length'] = 0;

    const requestOptions = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      path: target.pathname + target.search,
      method: (opts.method || 'GET').toUpperCase(),
      headers,
      timeout: Math.max(1000, Math.min(Number(opts.timeout) || 60000, 600000)),
      rejectUnauthorized: opts.ignoreTls ? false : true
    };

    const started = Date.now();
    let req;
    try { req = lib.request(requestOptions); } catch (e) {
      sender.send('http:error', { id, message: e.message });
      return resolve();
    }
    activeRequests.set(id, req);
    let responded = false;

    req.on('response', (res) => {
      responded = true;
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status) && res.headers.location && redirectCount < 10) {
        const next = new URL(res.headers.location, target).toString();
        res.resume();
        activeRequests.delete(id);
        const nextMethod = (status === 301 || status === 302 || status === 303) && requestOptions.method !== 'HEAD' ? 'GET' : requestOptions.method;
        const nextOpts = Object.assign({}, opts, { url: next, method: nextMethod });
        if (nextMethod === 'GET') { delete nextOpts.body; delete nextOpts.bodyBase64; }
        resolve(doRequest(nextOpts, sender, id, redirectCount + 1));
        return;
      }

      const rawHeaders = {};
      for (const [k, v] of Object.entries(res.headers)) {
        rawHeaders[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      }
      sender.send('http:response', {
        id, status, statusText: res.statusMessage || '', headers: rawHeaders, url: target.toString(), redirected: redirectCount > 0
      });

      let stream = res;
      const dec = decompressor(res.headers['content-encoding']);
      if (dec) {
        stream = res.pipe(dec);
        stream.on('error', (e) => { sender.send('http:error', { id, message: 'Ошибка распаковки: ' + e.message }); });
      }
      let total = 0;
      stream.on('data', (buf) => {
        total += buf.length;
        if (!sender.isDestroyed()) sender.send('http:chunk', { id, b64: buf.toString('base64') });
      });
      stream.on('end', () => {
        activeRequests.delete(id);
        if (!sender.isDestroyed()) sender.send('http:end', { id, time: Date.now() - started, bytes: total });
        resolve();
      });
      stream.on('error', (e) => {
        activeRequests.delete(id);
        if (!sender.isDestroyed()) sender.send('http:error', { id, message: e.message, time: Date.now() - started });
        resolve();
      });
    });

    req.on('timeout', () => {
      activeRequests.delete(id);
      req.destroy(new Error('Таймаут запроса'));
    });
    req.on('error', (e) => {
      activeRequests.delete(id);
      if (!sender.isDestroyed()) {
        let msg = e.message || String(e);
        if (e.code === 'ENOTFOUND') msg = 'Хост не найден (DNS): ' + target.hostname;
        if (e.code === 'ECONNREFUSED') msg = 'Соединение отклонено: ' + target.host;
        if (/certificate/i.test(msg)) msg += ' — возможно, нужен режим «Игнорировать TLS»';
        if (!responded) sender.send('http:error', { id, message: msg, time: Date.now() - started });
      }
      resolve();
    });

    if (bodyBuf && requestOptions.method !== 'GET' && requestOptions.method !== 'HEAD') req.write(bodyBuf);
    req.end();
  });
}

ipcMain.handle('http:start', (event, opts) => {
  const id = crypto.randomUUID();
  doRequest(opts || {}, event.sender, id).catch((e) => {
    if (!event.sender.isDestroyed()) event.sender.send('http:error', { id, message: e.message });
  });
  return { id };
});

ipcMain.handle('http:abort', (_event, id) => {
  const req = activeRequests.get(id);
  if (req) { try { req.destroy(); } catch (_) {} activeRequests.delete(id); return true; }
  return false;
});

/* ----------------------------- System helpers ----------------------------- */

ipcMain.handle('dns:lookup', async (_event, { host, type }) => {
  const t = String(type || 'A').toUpperCase();
  const map = {
    A: () => dns.promises.resolve4(host),
    AAAA: () => dns.promises.resolve6(host),
    MX: () => dns.promises.resolveMx(host).then((r) => r.map((x) => `${x.priority} ${x.exchange}`)),
    TXT: () => dns.promises.resolveTxt(host).then((r) => r.map((x) => x.join(''))),
    CNAME: () => dns.promises.resolveCname(host),
    NS: () => dns.promises.resolveNs(host),
    SOA: () => dns.promises.resolveSoa(host).then((r) => [JSON.stringify(r, null, 2)]),
    SRV: () => dns.promises.resolveSrv(host).then((r) => r.map((x) => `${x.priority} ${x.weight} ${x.port} ${x.name}`))
  };
  if (!map[t]) throw new Error('Неизвестный тип записи');
  const started = Date.now();
  const records = await map[t]();
  return { type: t, records, time: Date.now() - started };
});

ipcMain.handle('system:info', () => {
  const nets = os.networkInterfaces();
  const interfaces = {};
  for (const [name, list] of Object.entries(nets)) {
    interfaces[name] = (list || []).map((n) => ({ address: n.address, family: n.family, mac: n.mac, internal: n.internal }));
  }
  return {
    platform: process.platform,
    arch: process.arch,
    release: os.release(),
    hostname: os.hostname(),
    user: os.userInfo().username,
    cpu: os.cpus().length ? `${os.cpus()[0].model} (${os.cpus().length} ядер)` : '—',
    memoryTotal: os.totalmem(),
    memoryFree: os.freemem(),
    uptime: os.uptime(),
    home: os.homedir(),
    tmp: os.tmpdir(),
    versions: process.versions,
    interfaces,
    locale: app.getLocale(),
    appVersion: app.getVersion(),
    paths: { exe: app.getPath('exe'), userData: app.getPath('userData'), downloads: app.getPath('downloads') }
  };
});

ipcMain.handle('app:openExternal', (_event, url) => {
  if (/^https?:/i.test(url)) return shell.openExternal(url);
  return false;
});

ipcMain.handle('app:saveFile', async (_event, { defaultName, dataBase64 }) => {
  const ext = path.extname(defaultName || '').replace('.', '');
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(app.getPath('downloads'), defaultName || 'devsuite-output.txt'),
    filters: ext ? [{ name: ext.toUpperCase(), extensions: [ext] }, { name: 'Все файлы', extensions: ['*'] }] : [{ name: 'Все файлы', extensions: ['*'] }]
  });
  if (result.canceled || !result.filePath) return { saved: false };
  await fsp.writeFile(result.filePath, Buffer.from(dataBase64 || '', 'base64'));
  return { saved: true, path: result.filePath };
});

ipcMain.handle('app:clipboardWrite', (_e, text) => { clipboard.writeText(String(text ?? '')); return true; });
ipcMain.handle('app:clipboardRead', () => clipboard.readText());
ipcMain.handle('app:showItem', (_e, p) => { shell.showItemInFolder(p); return true; });
