/* DevSuite Pro — core utilities */
(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const tools = [];
  const toolMap = new Map();

  const CATEGORIES = [
    { id: 'api', name: 'API и сеть', icon: '⇄', desc: 'HTTP, AI, Telegram, WebSocket, DNS' },
    { id: 'data', name: 'Данные', icon: '⌗', desc: 'JSON, YAML, XML, CSV, JWT, diff' },
    { id: 'code', name: 'Кодирование', icon: '⌘', desc: 'Base64, hash, AES, URL, Unicode' },
    { id: 'gen', name: 'Генераторы', icon: '✦', desc: 'UUID, пароли, QR, данные' },
    { id: 'text', name: 'Текст', icon: '¶', desc: 'Форматирование, цвета, время' },
    { id: 'system', name: 'Система', icon: '⚙', desc: 'Инфо, настройки, справка' }
  ];

  const isDesktop = !!window.devsuite;
  const isAndroid = !isDesktop && (/Android/i.test(navigator.userAgent) || !!window.Android);

  function registerTools(list) {
    for (const t of list) {
      if (toolMap.has(t.id)) continue;
      t.catName = (CATEGORIES.find((c) => c.id === t.cat) || {}).name || 'Прочее';
      tools.push(t);
      toolMap.set(t.id, t);
    }
  }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uniq = (arr) => Array.from(new Set(arr));

  function toast(message, type = '') {
    const box = document.getElementById('toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<span class="t-ico">${type === 'err' ? '⚠' : type === 'ok' ? '✓' : 'ℹ'}</span><span>${esc(message)}</span>`;
    box.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .2s'; setTimeout(() => el.remove(), 220); }, 2600);
  }

  async function clipboardWrite(text) {
    text = String(text ?? '');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try { if (window.devsuite) { await window.devsuite.clipboardWrite(text); return true; } } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      return true;
    } catch (_) { return false; }
  }

  async function clipboardRead() {
    try { if (navigator.clipboard && navigator.clipboard.readText) return await navigator.clipboard.readText(); } catch (_) {}
    try { if (window.devsuite) return await window.devsuite.clipboardRead(); } catch (_) {}
    return '';
  }

  async function copy(text, label = 'Скопировано') {
    const ok = await clipboardWrite(text);
    toast(ok ? label : 'Не удалось скопировать', ok ? 'ok' : 'err');
    return ok;
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');

  function utf8(s) { return enc.encode(String(s)); }
  function bytesToHex(bytes) {
    let h = '';
    for (let i = 0; i < bytes.length; i++) h += bytes[i].toString(16).padStart(2, '0');
    return h;
  }
  function hexToBytes(hex) {
    const clean = String(hex).replace(/[^0-9a-f]/gi, '');
    const out = new Uint8Array(clean.length >> 1);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
    return out;
  }
  function bytesToB64(bytes) {
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return btoa(bin);
  }
  function b64ToBytes(b64) {
    const bin = atob(String(b64).replace(/\s/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function base64EncodeText(s) { return bytesToB64(utf8(s)); }
  function base64DecodeText(b64) { return dec.decode(b64ToBytes(b64)); }
  function b64urlEncode(bytes) { return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
  function b64urlDecode(str) {
    str = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return b64ToBytes(str);
  }
  function b64urlText(str) { try { return dec.decode(b64urlDecode(str)); } catch (_) { return ''; } }

  function fmtBytes(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(n < 10240 ? 2 : 1) + ' KB';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
    return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
  }
  function fmtMs(ms) { return ms < 1000 ? Math.round(ms) + ' мс' : (ms / 1000).toFixed(2) + ' с'; }
  function fmtNum(n) { return Number(n || 0).toLocaleString('ru-RU'); }
  function fmtDate(d, opts) {
    try { return new Date(d).toLocaleString('ru-RU', opts || { dateStyle: 'medium', timeStyle: 'medium' }); }
    catch (_) { return String(d); }
  }
  function timeAgo(ts) {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return 'только что';
    if (s < 3600) return Math.floor(s / 60) + ' мин назад';
    if (s < 86400) return Math.floor(s / 3600) + ' ч назад';
    return Math.floor(s / 86400) + ' дн назад';
  }

  function debounce(fn, wait = 250) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
  }

  function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function saveBase64(filename, mime, b64) {
    if (window.devsuite) {
      try {
        const res = await window.devsuite.saveFile({ defaultName: filename, dataBase64: b64, mime });
        if (res && res.saved) { toast('Сохранено: ' + res.path, 'ok'); return true; }
        return false;
      } catch (e) { toast('Ошибка сохранения: ' + e.message, 'err'); return false; }
    }
    if (window.Android && typeof window.Android.saveFile === 'function') {
      try { window.Android.saveFile(filename, mime || 'application/octet-stream', b64); toast('Файл сохранён в Downloads', 'ok'); return true; }
      catch (e) { toast('Ошибка сохранения: ' + e, 'err'); return false; }
    }
    try {
      const bytes = b64ToBytes(b64);
      downloadBlob(filename, new Blob([bytes], { type: mime || 'application/octet-stream' }));
      return true;
    } catch (e) { toast('Не удалось сохранить файл', 'err'); return false; }
  }

  async function saveBlob(filename, blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    return saveBase64(filename, blob.type || 'application/octet-stream', bytesToB64(buf));
  }

  function saveText(filename, text, mime = 'text/plain;charset=utf-8') {
    return saveBlob(filename, new Blob([text], { type: mime }));
  }

  function readFile(file, as = 'text') {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      if (as === 'text') r.readAsText(file, 'utf-8');
      else if (as === 'arrayBuffer') r.readAsArrayBuffer(file);
      else if (as === 'dataURL') r.readAsDataURL(file);
    });
  }

  /* ---------------- storage ---------------- */
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('ds.' + key); return v === null ? fallback : JSON.parse(v); } catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('ds.' + key, JSON.stringify(value)); return true; } catch (_) { return false; }
    },
    del(key) { try { localStorage.removeItem('ds.' + key); } catch (_) {} },
    keys() { try { return Object.keys(localStorage).filter((k) => k.startsWith('ds.')).map((k) => k.slice(3)); } catch (_) { return []; } },
    all() { const o = {}; for (const k of this.keys()) { try { o[k] = JSON.parse(localStorage.getItem('ds.' + k)); } catch (_) {} } return o; },
    clear() { for (const k of this.keys()) this.del(k); }
  };

  /* ---------------- crypto ---------------- */
  const MD5_S = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  const MD5_K = (() => { const k = new Uint32Array(64); for (let i = 0; i < 64; i++) k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0; return k; })();

  function md5Bytes(bytes) {
    const len = bytes.length;
    const paddedLen = (((len + 8) >> 6) + 1) * 64;
    const buf = new Uint8Array(paddedLen);
    buf.set(bytes); buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    const bitLen = len * 8;
    dv.setUint32(paddedLen - 8, bitLen >>> 0, true);
    dv.setUint32(paddedLen - 4, Math.floor(bitLen / 4294967296), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    const M = new Uint32Array(16);
    for (let off = 0; off < paddedLen; off += 64) {
      for (let j = 0; j < 16; j++) M[j] = dv.getUint32(off + j * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + MD5_K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        const sh = MD5_S[i];
        B = (B + ((F << sh) | (F >>> (32 - sh)))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16);
    const odv = new DataView(out.buffer);
    odv.setUint32(0, a0, true); odv.setUint32(4, b0, true); odv.setUint32(8, c0, true); odv.setUint32(12, d0, true);
    return out;
  }

  async function digest(algo, bytes) {
    if (algo === 'MD5') return md5Bytes(bytes);
    if (!window.crypto || !crypto.subtle) throw new Error('WebCrypto недоступен в этом окружении');
    const buf = await crypto.subtle.digest(algo.replace('-', ''), bytes);
    return new Uint8Array(buf);
  }

  async function hashText(algo, text) {
    const bytes = typeof text === 'string' ? utf8(text) : text;
    return bytesToHex(await digest(algo, bytes));
  }

  async function hmac(algo, key, message) {
    if (!crypto.subtle) throw new Error('WebCrypto недоступен');
    const keyBuf = await crypto.subtle.importKey('raw', utf8(key), { name: 'HMAC', hash: algo.replace('-', '') }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', keyBuf, utf8(message));
    return bytesToHex(new Uint8Array(sig));
  }

  async function pbkdf2Key(password, salt, iterations = 150000) {
    const base = await crypto.subtle.importKey('raw', utf8(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  }

  async function aesEncrypt(text, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await pbkdf2Key(password, salt);
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(text)));
    const out = new Uint8Array(16 + 12 + cipher.length);
    out.set(salt, 0); out.set(iv, 16); out.set(cipher, 28);
    return 'DS1.' + bytesToB64(out);
  }

  async function aesDecrypt(payload, password) {
    payload = String(payload).trim();
    if (payload.startsWith('DS1.')) payload = payload.slice(4);
    const bytes = b64ToBytes(payload);
    if (bytes.length < 29) throw new Error('Повреждённые данные');
    const salt = bytes.slice(0, 16), iv = bytes.slice(16, 28), data = bytes.slice(28);
    const key = await pbkdf2Key(password, salt);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return dec.decode(plain);
  }

  function randomBytes(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
  function randomInt(max) {
    max = Math.floor(Number(max) || 0);
    if (max <= 1) return 0;
    if (max > 4294967296) {
      // 53-bit uniform value for ranges beyond 32 bits (dates, large ids)
      const buf = new Uint32Array(2);
      crypto.getRandomValues(buf);
      const v = buf[0] * 2097152 + (buf[1] >>> 11);
      return Math.floor((v / 9007199254740992) * max);
    }
    const limit = Math.floor(4294967296 / max) * max;
    const arr = new Uint32Array(1);
    do { crypto.getRandomValues(arr); } while (arr[0] >= limit);
    return arr[0] % max;
  }
  function randomChoice(arr) { return arr[randomInt(arr.length)]; }

  function uuidV4() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = bytesToHex(b);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  function uuidV7() {
    const now = Date.now();
    const b = new Uint8Array(16);
    for (let i = 5; i >= 0; i--) { b[i] = now % 256; }
    const r = randomBytes(10);
    b.set(r, 6);
    b[6] = (b[6] & 0x0f) | 0x70;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = bytesToHex(b);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  const ULID_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function ulid() {
    let time = Date.now();
    let t = '';
    for (let i = 0; i < 10; i++) { t = ULID_CHARS[time % 32] + t; time = Math.floor(time / 32); }
    let rand = '';
    for (let i = 0; i < 16; i++) rand += ULID_CHARS[randomInt(32)];
    return t + rand;
  }

  function nanoid(size = 21, alphabet = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict') {
    let id = '';
    const bytes = randomBytes(size);
    for (let i = 0; i < size; i++) id += alphabet[bytes[i] % alphabet.length];
    return id;
  }

  function password(options) {
    const opt = Object.assign({ length: 20, lower: true, upper: true, digits: true, symbols: true, noAmbiguous: false }, options);
    let lower = 'abcdefghijkmnopqrstuvwxyz', upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ', digits = '23456789', symbols = '!@#$%^&*()-_=+[]{};:,.?/';
    if (!opt.noAmbiguous) { lower = 'abcdefghijklmnopqrstuvwxyz'; upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; digits = '0123456789'; }
    let pool = '';
    if (opt.lower) pool += lower;
    if (opt.upper) pool += upper;
    if (opt.digits) pool += digits;
    if (opt.symbols) pool += symbols;
    if (!pool) pool = lower;
    const guarantee = [];
    if (opt.lower) guarantee.push(randomChoice(lower));
    if (opt.upper) guarantee.push(randomChoice(upper));
    if (opt.digits) guarantee.push(randomChoice(digits));
    if (opt.symbols) guarantee.push(randomChoice(symbols));
    const chars = guarantee.slice(0, opt.length);
    while (chars.length < opt.length) chars.push(randomChoice(pool));
    for (let i = chars.length - 1; i > 0; i--) { const j = randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
    return { value: chars.join(''), entropy: Math.round(opt.length * Math.log2(pool.length)) };
  }

  /* ---------------- helpers ---------------- */
  function parseJSON(text) { return JSON.parse(text); }
  function prettyJSON(value) { return JSON.stringify(typeof value === 'string' ? JSON.parse(value) : value, null, 2); }
  function tryPrettyJSON(text) { try { return JSON.stringify(JSON.parse(text), null, 2); } catch (_) { return text; } }
  function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function titleCase(s) { return String(s).replace(/\p{L}[\p{L}\p{N}'’]*/gu, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()); }
  function words(s) { return String(s).match(/[A-Za-zА-Яа-яЁё0-9]+/g) || []; }
  function slugify(s) {
    const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
    return String(s).toLowerCase().split('').map((c) => map[c] !== undefined ? map[c] : c).join('').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function toCamel(s) { return words(s).map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join(''); }
  function toPascal(s) { return words(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(''); }
  function toSnake(s) { return words(s).map((w) => w.toLowerCase()).join('_'); }
  function toKebab(s) { return words(s).map((w) => w.toLowerCase()).join('-'); }
  function toConstant(s) { return toSnake(s).toUpperCase(); }

  function sanitizeHtml(html) {
    const t = document.createElement('div');
    t.innerHTML = String(html);
    t.querySelectorAll('script,style,iframe,object,embed,link,meta,form,input,button').forEach((n) => n.remove());
    t.querySelectorAll('*').forEach((n) => {
      for (const a of Array.from(n.attributes)) {
        if (/^on/i.test(a.name)) n.removeAttribute(a.name);
        if ((a.name === 'href' || a.name === 'src' || a.name === 'xlink:href') && /^\s*(javascript|data:text\/html|vbscript):/i.test(a.value)) n.removeAttribute(a.name);
      }
    });
    return t.innerHTML;
  }

  function renderMarkdown(text) {
    if (window.marked && marked.parse) {
      try {
        marked.setOptions({ gfm: true, breaks: true });
        return sanitizeHtml(marked.parse(String(text)));
      } catch (_) {}
    }
    return `<pre>${esc(text)}</pre>`;
  }

  function makeSSEParser(onEvent) {
    let buffer = '';
    return {
      feed(chunk) {
        buffer += String(chunk).replace(/\r\n/g, '\n');
        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!block.trim()) continue;
          let event = 'message', data = [];
          for (const line of block.split('\n')) {
            if (line.startsWith(':')) continue;
            const colon = line.indexOf(':');
            const field = colon === -1 ? line : line.slice(0, colon);
            let value = colon === -1 ? '' : line.slice(colon + 1);
            if (value.startsWith(' ')) value = value.slice(1);
            if (field === 'event') event = value;
            else if (field === 'data') data.push(value);
          }
          if (data.length) onEvent({ event, data: data.join('\n') });
        }
      }
    };
  }

  /* ---------------- transport ---------------- */
  const androidHttpHandlers = new Map();
  const androidHttpPending = new Map();
  window.__dsAndroidHttp = function (json) {
    let ev;
    try { ev = JSON.parse(json); } catch (_) { return; }
    if (!ev || !ev.id) return;
    const handler = androidHttpHandlers.get(ev.id);
    if (handler) { handler(ev); return; }
    const buffered = androidHttpPending.get(ev.id) || [];
    if (buffered.length < 8) buffered.push(ev);
    androidHttpPending.set(ev.id, buffered);
    if (buffered.length === 1) setTimeout(() => androidHttpPending.delete(ev.id), 4000);
  };

  function requestStream(opts, handlers = {}) {
    const method = String(opts.method || 'GET').toUpperCase();
    const headers = Object.assign({}, opts.headers || {});
    const timeout = Math.max(1000, Number(opts.timeout) || 60000);
    const startedAt = Date.now();
    const decoder = new TextDecoder('utf-8');
    let text = '';
    let bytes = 0;
    let meta = { status: 0, headers: {}, url: opts.url, statusText: '' };
    let finished = false;
    let aborted = false;
    let controller = null;
    let timer = null;
    let offEvents = null;
    let requestId = null;
    let pending = [];

    function cleanup() {
      if (timer) clearTimeout(timer);
      if (requestId && androidHttpHandlers.has(requestId)) androidHttpHandlers.delete(requestId);
      if (requestId && androidHttpPending.has(requestId)) androidHttpPending.delete(requestId);
      if (offEvents) { try { offEvents(); } catch (_) {} offEvents = null; }
    }
    function emitEnd(extra) {
      if (finished) return;
      finished = true;
      try { text += decoder.decode(); } catch (_) {}
      cleanup();
      if (handlers.onEnd) handlers.onEnd(Object.assign({ status: meta.status, headers: meta.headers, url: meta.url, statusText: meta.statusText, text, bytes, time: Date.now() - startedAt, aborted }, extra || {}));
    }
    function fail(message, wasAbort) {
      if (finished) return;
      finished = true;
      cleanup();
      if (handlers.onError) handlers.onError({ message: message || 'Ошибка запроса', aborted: !!wasAbort, status: meta.status, time: Date.now() - startedAt });
    }
    function feedData(chunk) {
      if (!chunk || !chunk.length) return;
      bytes += chunk.length;
      if (handlers.onBytes) handlers.onBytes(chunk);
      let piece = '';
      try { piece = decoder.decode(chunk, { stream: true }); } catch (_) {}
      if (piece) {
        text += piece;
        if (handlers.onText) handlers.onText(piece, chunk);
      }
    }
    function handleDesktopEvent(ev) {
      if (finished) return;
      if (!requestId) { pending.push(ev); return; }
      if (ev.id !== requestId) return;
      if (ev.type === 'response') {
        meta = { status: ev.status, statusText: ev.statusText, headers: ev.headers || {}, url: ev.url, redirected: ev.redirected };
        if (handlers.onResponse) handlers.onResponse(meta);
      } else if (ev.type === 'chunk') {
        feedData(b64ToBytes(ev.b64));
      } else if (ev.type === 'end') {
        meta.status = meta.status || 200;
        emitEnd({ time: ev.time || (Date.now() - startedAt) });
      } else if (ev.type === 'error') {
        fail(ev.message, ev.aborted);
      }
    }

    function startDesktop() {
      offEvents = window.devsuite.onHttpEvent(handleDesktopEvent);
      window.devsuite.httpStart({
        method, url: opts.url, headers, body: opts.body, bodyBase64: opts.bodyBase64,
        timeout, ignoreTls: !!opts.ignoreTls
      }).then((res) => {
        requestId = res.id;
        const list = pending; pending = [];
        list.forEach(handleDesktopEvent);
      }).catch((e) => fail(e.message || String(e)));
    }

    function startFetch() {
      controller = new AbortController();
      timer = setTimeout(() => { aborted = true; try { controller.abort(); } catch (_) {} fail('Таймаут запроса (' + timeout + ' мс)', true); }, timeout);
      const fetchOpts = { method, headers, signal: controller.signal, redirect: 'follow' };
      if (opts.body != null && method !== 'GET' && method !== 'HEAD') fetchOpts.body = opts.body;
      fetch(opts.url, fetchOpts).then(async (res) => {
        const h = {};
        res.headers.forEach((v, k) => { h[k] = v; });
        meta = { status: res.status, statusText: res.statusText, headers: h, url: res.url };
        if (handlers.onResponse) handlers.onResponse(meta);
        if (res.body && res.body.getReader) {
          const reader = res.body.getReader();
          while (true) {
            const r = await reader.read();
            if (r.done) break;
            if (r.value) feedData(r.value);
          }
        } else {
          feedData(new Uint8Array(await res.arrayBuffer()));
        }
        emitEnd({ time: Date.now() - startedAt });
      }).catch((e) => {
        if (aborted) return;
        let msg = e.message || String(e);
        if (/Failed to fetch/i.test(msg)) msg = 'Сетевая ошибка или CORS. В EXE/APK запросы идут напрямую, в браузере CORS может блокировать ответ.';
        fail(msg);
      });
    }

    function startAndroid() {
      timer = setTimeout(() => { aborted = true; try { window.Android.httpAbort(requestId || ''); } catch (_) {} fail('Превышено время ожидания (' + timeout + ' мс)', true); }, timeout);
      let bodyB64 = opts.bodyBase64 || '';
      if (!bodyB64 && opts.body != null && method !== 'GET' && method !== 'HEAD') {
        try { bodyB64 = bytesToB64(new TextEncoder().encode(String(opts.body))); } catch (_) {}
      }
      try {
        requestId = String(window.Android.httpStart(JSON.stringify({
          method, url: opts.url, headers, bodyB64, timeout, ignoreTls: !!opts.ignoreTls
        })));
      } catch (e) {
        fail(e && e.message ? e.message : String(e));
        return;
      }
      androidHttpHandlers.set(requestId, handleDesktopEvent);
      const buffered = androidHttpPending.get(requestId);
      if (buffered) {
        androidHttpPending.delete(requestId);
        buffered.forEach(handleDesktopEvent);
      }
    }

    if (window.devsuite) startDesktop();
    else if (window.Android && typeof window.Android.httpStart === 'function') startAndroid();
    else startFetch();

    return {
      abort() {
        if (finished) return;
        aborted = true;
        if (window.devsuite) {
          if (requestId) window.devsuite.httpAbort(requestId).then(() => fail('Запрос отменён', true));
          else fail('Запрос отменён', true);
        } else if (window.Android && typeof window.Android.httpAbort === 'function') {
          try { if (requestId) window.Android.httpAbort(requestId); } catch (_) {}
          fail('Запрос отменён', true);
        } else {
          try { controller.abort(); } catch (_) {}
          fail('Запрос отменён', true);
        }
      },
      get text() { return text; },
      get meta() { return meta; },
      get finished() { return finished; }
    };
  }

  function http(opts) {
    return new Promise((resolve, reject) => {
      let responseMeta = { status: 0, headers: {}, url: opts.url };
      const chunks = [];
      requestStream(opts, {
        onResponse(m) { responseMeta = m; },
        onBytes(b) { chunks.push(b); },
        onEnd(m) {
          const total = chunks.reduce((n, b) => n + b.length, 0);
          const body = new Uint8Array(total);
          let off = 0;
          for (const b of chunks) { body.set(b, off); off += b.length; }
          resolve({ status: m.status, statusText: m.statusText, headers: m.headers, url: m.url, text: m.text, bytes: m.bytes, time: m.time, body });
        },
        onError(e) { reject(e); }
      });
    });
  }

  /* ---------------- DOM helpers ---------------- */
  function bindTabs(scope) {
    // Delegated handler in init() covers dynamically added tabs.
    return scope;
  }

  function kvEditor(container, initial, options = {}) {
    if (!container) return { getRows: () => [], setRows: () => {} };
    container.classList.add('kv');
    let rows = [];

    function makeRow(row = {}) {
      const el = document.createElement('div');
      el.className = 'kv-row';
      el.innerHTML = `
        <input type="checkbox" ${row.enabled === false ? '' : 'checked'} title="Включить">
        <input type="text" class="k" placeholder="${esc(options.keyPlaceholder || 'Ключ')}" value="${esc(row.key || '')}">
        <input type="text" class="v" placeholder="${esc(options.valuePlaceholder || 'Значение')}" value="${esc(row.value || '')}">
        <button type="button" class="del" title="Удалить">✕</button>`;
      const dow = (e) => { e.preventDefault(); el.remove(); rows = rows.filter((r) => r !== el); };
      el.querySelector('.del').addEventListener('click', dow);
      container.insertBefore(el, addBtn);
      rows.push(el);
      return el;
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'btn btn-ghost btn-sm kv-add';
    addBtn.textContent = '+ добавить';
    addBtn.addEventListener('click', () => { const el = makeRow(); el.querySelector('.k').focus(); });

    container.innerHTML = '';
    if (options.headers !== false) {
      const head = document.createElement('div');
      head.className = 'kv-head';
      head.innerHTML = '<span></span><span>Ключ</span><span>Значение</span><span></span>';
      container.appendChild(head);
    }
    container.appendChild(addBtn);
    if (initial && initial.length) initial.forEach((r) => makeRow(r));
    else if (options.autoAdd !== false) makeRow();

    return {
      getRows(onlyEnabled = true) {
        return rows.map((el) => ({
          enabled: el.querySelector('input[type=checkbox]').checked,
          key: el.querySelector('.k').value.trim(),
          value: el.querySelector('.v').value
        })).filter((r) => r.key && (!onlyEnabled || r.enabled));
      },
      setRows(list) {
        rows.forEach((r) => r.remove());
        rows = [];
        (list || []).forEach((r) => makeRow(r));
        if (!rows.length) makeRow();
      },
      addRow: makeRow
    };
  }

  /* ---------------- global listeners ---------------- */
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab[data-tab]');
    if (tab) {
      const group = tab.closest('[data-tabgroup]');
      if (group) {
        const name = tab.dataset.tab;
        $$('.tab[data-tab]', group).forEach((t) => t.classList.toggle('is-active', t === tab));
        $$('[data-pane]', group).forEach((p) => p.classList.toggle('is-active', p.dataset.pane === name));
      }
    }
    const cp = e.target.closest('[data-copy-target]');
    if (cp) {
      const target = $(cp.dataset.copyTarget);
      if (target) {
        const val = ('value' in target && target.tagName !== 'DIV' && target.tagName !== 'PRE') ? target.value : target.textContent;
        copy(val, cp.dataset.copyLabel || 'Скопировано');
      }
    }
    const cpv = e.target.closest('[data-copy]');
    if (cpv) copy(cpv.dataset.copy, 'Скопировано');
  });

  // Ctrl/Cmd+K is handled by the app shell; expose a hook.
  window.DS = {
    $, $$, esc, uniq, toast, copy, clipboardWrite, clipboardRead,
    isDesktop, isAndroid, platformLabel: isDesktop ? 'Desktop · Electron' : isAndroid ? 'Android · WebView' : 'Web',
    CATEGORIES, tools, toolMap, registerTools,
    store, saveText, saveBlob, saveBase64, downloadBlob, readFile,
    fmtBytes, fmtMs, fmtNum, fmtDate, timeAgo, debounce,
    utf8, bytesToHex, hexToBytes, bytesToB64, b64ToBytes, base64EncodeText, base64DecodeText,
    b64urlEncode, b64urlDecode, b64urlText,
    md5Bytes, digest, hashText, hmac, aesEncrypt, aesDecrypt,
    randomBytes, randomInt, randomChoice, uuidV4, uuidV7, ulid, nanoid, password,
    parseJSON, prettyJSON, tryPrettyJSON, escapeRegExp, titleCase, words, slugify,
    toCamel, toPascal, toSnake, toKebab, toConstant,
    sanitizeHtml, renderMarkdown, makeSSEParser,
    requestStream, http, kvEditor, bindTabs
  };
})();
