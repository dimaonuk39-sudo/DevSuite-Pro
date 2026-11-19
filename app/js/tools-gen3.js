/* DevSuite Pro — generators part 3 & references */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, saveText } = D;

  function hexToRgb(hex) {
    let h = String(hex).trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error('Неверный HEX');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }
  function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    const hue = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const q = l < .5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue(p, q, h + 1 / 3); g = hue(p, q, h); b = hue(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0; const s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return { h: Math.round(h), s: Math.round(s * 100), v: Math.round(v * 100) };
  }
  function rgbToCmyk(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const k = 1 - Math.max(r, g, b);
    if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
    return { c: Math.round((1 - r - k) / (1 - k) * 100), m: Math.round((1 - g - k) / (1 - k) * 100), y: Math.round((1 - b - k) / (1 - k) * 100), k: Math.round(k * 100) };
  }
  function luminance(r, g, b) {
    const a = [r, g, b].map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
    return .2126 * a[0] + .7152 * a[1] + .0722 * a[2];
  }
  function contrast(rgb, hex2) {
    const l1 = luminance(rgb.r, rgb.g, rgb.b);
    const b2 = hexToRgb(hex2);
    const l2 = luminance(b2.r, b2.g, b2.b);
    return ((Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05)).toFixed(2);
  }

  const STATUS = [
    [100, 'Continue', 'Продолжай', 'info', 'Сервер получил заголовки, клиент может отправлять тело.'],
    [101, 'Switching Protocols', 'Смена протокола', 'info', 'Сервер переключается на WebSocket или другой протокол.'],
    [102, 'Processing', 'Обработка', 'info', 'Запрос принят, обработка продолжается (WebDAV).'],
    [200, 'OK', 'Успех', 'ok', 'Стандартный успешный ответ.'],
    [201, 'Created', 'Создано', 'ok', 'Ресурс успешно создан (POST/PUT).'],
    [202, 'Accepted', 'Принято', 'ok', 'Запрос принят в обработку, результат позже.'],
    [204, 'No Content', 'Нет содержимого', 'ok', 'Успех без тела ответа (часто DELETE).'],
    [206, 'Partial Content', 'Частичное содержимое', 'ok', 'Ответ на Range-запрос (докачка).'],
    [301, 'Moved Permanently', 'Перемещено навсегда', 'warn', 'Постоянный редирект на новый URL.'],
    [302, 'Found', 'Найдено', 'warn', 'Временный редирект.'],
    [304, 'Not Modified', 'Не изменено', 'warn', 'Кэш актуален, тело не передаётся.'],
    [307, 'Temporary Redirect', 'Временный редирект', 'warn', 'Редирект с сохранением метода.'],
    [308, 'Permanent Redirect', 'Постоянный редирект', 'warn', 'Постоянный редирект с сохранением метода.'],
    [400, 'Bad Request', 'Плохой запрос', 'err', 'Синтаксическая ошибка или неверные параметры.'],
    [401, 'Unauthorized', 'Не авторизован', 'err', 'Нужна аутентификация (токен, Basic).'],
    [403, 'Forbidden', 'Запрещено', 'err', 'Аутентификация есть, но доступа нет.'],
    [404, 'Not Found', 'Не найдено', 'err', 'Ресурс не существует.'],
    [405, 'Method Not Allowed', 'Метод не разрешён', 'err', 'Метод не поддерживается для эндпоинта.'],
    [408, 'Request Timeout', 'Таймаут запроса', 'err', 'Клиент слишком долго не отправлял запрос.'],
    [409, 'Conflict', 'Конфликт', 'err', 'Конфликт состояния (дубликат, версия).'],
    [410, 'Gone', 'Удалено навсегда', 'err', 'Ресурс удалён и не будет восстановлен.'],
    [413, 'Payload Too Large', 'Слишком большой запрос', 'err', 'Тело превышает лимит сервера.'],
    [415, 'Unsupported Media Type', 'Неподдерживаемый тип', 'err', 'Неверный Content-Type.'],
    [422, 'Unprocessable Entity', 'Необрабатываемый объект', 'err', 'Валидация не пройдена (JSON корректен).'],
    [429, 'Too Many Requests', 'Слишком много запросов', 'err', 'Rate limit — повторите позже.'],
    [500, 'Internal Server Error', 'Внутренняя ошибка', 'err', 'Необработанная ошибка на сервере.'],
    [501, 'Not Implemented', 'Не реализовано', 'err', 'Сервер не поддерживает функциональность.'],
    [502, 'Bad Gateway', 'Плохой шлюз', 'err', 'Прокси получил неверный ответ от upstream.'],
    [503, 'Service Unavailable', 'Сервис недоступен', 'err', 'Перегрузка или техническое обслуживание.'],
    [504, 'Gateway Timeout', 'Таймаут шлюза', 'err', 'Upstream не ответил вовремя.'],
    [101, 'Switching Protocols', 'WebSocket', 'info', 'Используется при установке WebSocket-соединения.'],
    [425, 'Too Early', 'Слишком рано', 'warn', 'Защита от повторных атак (TLS early data).'],
    [451, 'Unavailable For Legal Reasons', 'Недоступно по юридическим причинам', 'err', 'Блокировка по закону.']
  ];

  const MIMES = [
    ['json', 'application/json', 'JSON данные'], ['js', 'text/javascript', 'JavaScript'], ['mjs', 'text/javascript', 'ES-модуль'],
    ['html', 'text/html', 'HTML-документ'], ['htm', 'text/html', 'HTML-документ'], ['css', 'text/css', 'CSS стили'],
    ['txt', 'text/plain', 'Обычный текст'], ['csv', 'text/csv', 'CSV таблица'], ['md', 'text/markdown', 'Markdown'],
    ['xml', 'application/xml', 'XML документ'], ['yaml', 'application/yaml', 'YAML'], ['yml', 'application/yaml', 'YAML'],
    ['pdf', 'application/pdf', 'PDF документ'], ['zip', 'application/zip', 'ZIP архив'], ['gz', 'application/gzip', 'Gzip архив'],
    ['tar', 'application/x-tar', 'Tar архив'], ['7z', 'application/x-7z-compressed', '7-Zip архив'], ['rar', 'application/vnd.rar', 'RAR архив'],
    ['png', 'image/png', 'PNG изображение'], ['jpg', 'image/jpeg', 'JPEG изображение'], ['jpeg', 'image/jpeg', 'JPEG изображение'],
    ['gif', 'image/gif', 'GIF изображение'], ['webp', 'image/webp', 'WebP изображение'], ['svg', 'image/svg+xml', 'SVG вектор'],
    ['ico', 'image/x-icon', 'Иконка'], ['bmp', 'image/bmp', 'BMP изображение'], ['avif', 'image/avif', 'AVIF изображение'],
    ['mp3', 'audio/mpeg', 'MP3 аудио'], ['wav', 'audio/wav', 'WAV аудио'], ['ogg', 'audio/ogg', 'Ogg аудио'],
    ['flac', 'audio/flac', 'FLAC аудио'], ['aac', 'audio/aac', 'AAC аудио'],
    ['mp4', 'video/mp4', 'MP4 видео'], ['webm', 'video/webm', 'WebM видео'], ['avi', 'video/x-msvideo', 'AVI видео'], ['mov', 'video/quicktime', 'QuickTime видео'],
    ['woff', 'font/woff', 'WOFF шрифт'], ['woff2', 'font/woff2', 'WOFF2 шрифт'], ['ttf', 'font/ttf', 'TrueType шрифт'], ['otf', 'font/otf', 'OpenType шрифт'],
    ['doc', 'application/msword', 'Word 97-2003'], ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Word DOCX'],
    ['xls', 'application/vnd.ms-excel', 'Excel 97-2003'], ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Excel XLSX'],
    ['ppt', 'application/vnd.ms-powerpoint', 'PowerPoint'], ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'PowerPoint PPTX'],
    ['wasm', 'application/wasm', 'WebAssembly'], ['apk', 'application/vnd.android.package-archive', 'Android APK'],
    ['exe', 'application/vnd.microsoft.portable-executable', 'Windows EXE'], ['bin', 'application/octet-stream', 'Бинарные данные'],
    ['sql', 'application/sql', 'SQL скрипт'], ['graphql', 'application/graphql', 'GraphQL'], ['form', 'multipart/form-data', 'Form upload'],
    ['urlencoded', 'application/x-www-form-urlencoded', 'URL-encoded форма'], ['ndjson', 'application/x-ndjson', 'Newline JSON'],
    ['epub', 'application/epub+zip', 'EPUB книга'], ['rtf', 'application/rtf', 'RTF документ'], ['ics', 'text/calendar', 'iCalendar']
  ];

  D.registerTools([
    {
      id: 'color', name: 'Color Converter', icon: '◐', cat: 'text', badge: 'core',
      desc: 'HEX ↔ RGB ↔ HSL ↔ HSV ↔ CMYK, палитры и контраст WCAG',
      render(root) {
        root.innerHTML = `
          <div class="row mb">
            <input type="color" id="coPick" value="#7C5CFF" style="width:62px;height:46px;padding:3px;border-radius:10px;border:1px solid var(--border);background:var(--panel)">
            <div class="field" style="width:160px"><span>HEX</span><input id="coHex" class="mono" value="#7C5CFF"></div>
            <div class="field" style="width:130px"><span>RGB</span><input id="coRgb" class="mono" placeholder="124, 92, 255"></div>
            <button class="btn" id="coGo" style="margin-top:15px">Применить</button>
            <span class="spacer"></span>
            <button class="btn" id="coRandom">Случайная палитра</button>
          </div>
          <div class="split">
            <div>
              <div class="grid-2" id="coCards"></div>
              <div class="panel-soft mt">
                <div class="panel-title">Оттенки</div>
                <div class="palette-row" id="coShades"></div>
              </div>
              <div class="panel-soft mt">
                <div class="panel-title">Контраст WCAG</div>
                <div id="coContrast" class="stack"></div>
              </div>
            </div>
            <div class="panel-soft">
              <div class="panel-title">Случайная палитра <button class="btn btn-sm" id="coPaletteCopy">CSS</button></div>
              <div class="palette-row" id="coPalette"></div>
              <div class="code mt" id="coCss" style="max-height:180px"></div>
            </div>
          </div>`;
        const hex = $('#coHex', root), rgbIn = $('#coRgb', root), pick = $('#coPick', root);
        function setRgb(rgb, push = true) {
          const h = rgbToHex(rgb.r, rgb.g, rgb.b);
          if (push) { hex.value = h; rgbIn.value = `${rgb.r}, ${rgb.g}, ${rgb.b}`; pick.value = h; }
          const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
          const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
          const cmyk = rgbToCmyk(rgb.r, rgb.g, rgb.b);
          const lum = luminance(rgb.r, rgb.g, rgb.b);
          const cards = [
            ['HEX', h], ['RGB', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`], ['HSL', `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`],
            ['HSV', `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`], ['CMYK', `${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%`], ['Luminance', lum.toFixed(4)]
          ];
          $('#coCards', root).innerHTML = cards.map(([k, v], i) => `<div class="panel-soft"><div class="row-between"><span class="label">${k}</span><button class="btn btn-sm" data-cocopy="${i}">⧉</button></div><div class="mono mt-sm" style="word-break:break-all" id="cov-${i}">${esc(v)}</div></div>`).join('');
          $('#coCards', root).querySelectorAll('[data-cocopy]').forEach((b) => { b.onclick = () => copy($('#cov-' + b.dataset.cocopy, root).textContent); });
          const shades = [];
          for (let i = 1; i <= 9; i++) {
            const p = i / 10;
            const mix = (c) => Math.round(p < .5 ? c * (p * 2) : c + (255 - c) * ((p - .5) * 2));
            const sh = rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
            shades.push(`<div class="palette-chip" data-shade="${sh}"><div class="sw" style="background:${sh}"></div><div class="lbl">${sh}</div></div>`);
          }
          $('#coShades', root).innerHTML = shades.join('');
          $('#coShades', root).querySelectorAll('[data-shade]').forEach((el) => { el.onclick = () => copy(el.dataset.shade); });
          const cw = contrast(rgb, '#FFFFFF'), cb = contrast(rgb, '#000000');
          $('#coContrast', root).innerHTML = `
            <div class="list-item"><span class="grow">С белым</span><b class="mono">${cw}:1</b><span class="chip ${cw >= 4.5 ? 'ok' : cw >= 3 ? 'warn' : 'err'}">${cw >= 7 ? 'AAA' : cw >= 4.5 ? 'AA' : cw >= 3 ? 'AA large' : 'fail'}</span></div>
            <div class="list-item"><span class="grow">С чёрным</span><b class="mono">${cb}:1</b><span class="chip ${cb >= 4.5 ? 'ok' : cb >= 3 ? 'warn' : 'err'}">${cb >= 7 ? 'AAA' : cb >= 4.5 ? 'AA' : cb >= 3 ? 'AA large' : 'fail'}</span></div>`;
          // палитра
          const palette = [];
          for (let i = 0; i < 5; i++) palette.push(hslToRgb((hsl.h + i * 32) % 360, Math.max(45, Math.min(85, hsl.s)), Math.max(38, Math.min(70, hsl.l + (i % 2 ? 8 : -6)))));
          $('#coPalette', root).innerHTML = palette.map((c) => { const h2 = rgbToHex(c.r, c.g, c.b); return `<div class="palette-chip"><div class="sw" style="background:${h2}"></div><div class="lbl">${h2}</div></div>`; }).join('');
          $('#coCss', root).textContent = ':root {\n' + palette.map((c, i) => `  --color-${i + 1}: ${rgbToHex(c.r, c.g, c.b)};`).join('\n') + '\n}';
        }
        function parse() {
          try {
            if (hex.value.trim()) setRgb(hexToRgb(hex.value));
            else throw new Error('Введите HEX');
          } catch (e) {
            const m = /(\d{1,3})\s*[,\s]\s*(\d{1,3})\s*[,\s]\s*(\d{1,3})/.exec(rgbIn.value);
            if (m) setRgb({ r: +m[1], g: +m[2], b: +m[3] }, false);
            else toast(e.message, 'err');
          }
        }
        $('#coGo', root).onclick = parse;
        hex.addEventListener('input', () => { if (/^#?[0-9a-f]{6}$/i.test(hex.value.trim())) parse(); });
        pick.addEventListener('input', () => { hex.value = pick.value.toUpperCase(); parse(); });
        $('#coRandom', root).onclick = () => { setRgb(hslToRgb(D.randomInt(360), 50 + D.randomInt(40), 40 + D.randomInt(25))); };
        $('#coPaletteCopy', root).onclick = () => copy($('#coCss', root).textContent, 'CSS скопирован');
        setRgb({ r: 124, g: 92, b: 255 });
      }
    },

    {
      id: 'timestamp', name: 'Timestamp', icon: '⏱', cat: 'text', badge: 'core',
      desc: 'Unix время, ISO 8601, локальное время и часовые пояса',
      render(root) {
        root.innerHTML = `
          <div class="panel mb" style="text-align:center">
            <div class="hint">Сейчас</div>
            <div class="mono" id="tsNow" style="font-size:26px;font-weight:700;margin:6px 0">—</div>
            <div class="hint" id="tsNowSub">—</div>
          </div>
          <div class="form-grid mb">
            <div class="field"><span>Timestamp / дата</span><input id="tsIn" class="mono" value="1735689600" placeholder="1735689600, 2026-01-01T00:00:00Z"></div>
            <div class="field"><span>Или выберите дату</span><input id="tsDate" type="datetime-local"></div>
            <button class="btn btn-primary" id="tsGo" style="margin-top:15px">Конвертировать</button>
            <button class="btn" id="tsNowBtn" style="margin-top:15px">Сейчас</button>
          </div>
          <div class="grid-2" id="tsOut"></div>
          <div class="panel-soft mt">
            <div class="panel-title">Часовые пояса</div>
            <table class="kv-table" id="tsZones"></table>
          </div>
          <div class="hint mt-sm" id="tsMsg">Поддерживаются секунды (10 цифр), миллисекунды (13 цифр) и строки, понятные Date.parse.</div>`;
        const input = $('#tsIn', root), out = $('#tsOut', root), msg = $('#tsMsg', root);
        function parseTimestamp(v) {
          v = String(v).trim();
          if (!v) return null;
          if (/^-?\d{1,10}$/.test(v)) return new Date(Number(v) * 1000);
          if (/^-?\d{11,16}$/.test(v)) return new Date(Number(v));
          const d = new Date(v);
          return isNaN(d) ? null : d;
        }
        function run() {
          const d = parseTimestamp(input.value);
          if (!d || isNaN(d)) { out.innerHTML = ''; msg.innerHTML = '<span class="error-text">✕ Не удалось разобрать значение</span>'; return; }
          const items = [
            ['Unix (сек)', Math.floor(d.getTime() / 1000)],
            ['Unix (мс)', d.getTime()],
            ['ISO 8601', d.toISOString()],
            ['UTC', d.toUTCString()],
            ['Локально', d.toLocaleString('ru-RU', { dateStyle: 'full', timeStyle: 'long' })],
            ['Относительно', D.timeAgo(d.getTime())]
          ];
          out.innerHTML = items.map(([k, v], i) => `<div class="panel-soft"><div class="row-between"><span class="label">${k}</span><button class="btn btn-sm" data-tscopy="${i}">⧉</button></div><div class="mono mt-sm" style="word-break:break-all" id="tsv-${i}">${esc(v)}</div></div>`).join('');
          out.querySelectorAll('[data-tscopy]').forEach((b) => { b.onclick = () => copy($('#tsv-' + b.dataset.tscopy, out).textContent); });
          const zones = [['UTC', 'UTC'], ['Москва', 'Europe/Moscow'], ['Лондон', 'Europe/London'], ['Нью-Йорк', 'America/New_York'], ['Лос-Анджелес', 'America/Los_Angeles'], ['Токио', 'Asia/Tokyo'], ['Дубай', 'Asia/Dubai']];
          $('#tsZones', root).innerHTML = zones.map(([name, tz]) => {
            let v = '—';
            try { v = new Intl.DateTimeFormat('ru-RU', { timeZone: tz, dateStyle: 'medium', timeStyle: 'medium' }).format(d); } catch (_) {}
            return `<tr><td>${name}</td><td class="mono">${esc(v)}</td><td class="hint">${tz}</td></tr>`;
          }).join('');
          msg.textContent = 'ISO — всегда UTC. Локальное время зависит от настроек устройства.';
        }
        $('#tsGo', root).onclick = run;
        $('#tsNowBtn', root).onclick = () => { input.value = Math.floor(Date.now() / 1000); run(); };
        $('#tsDate', root).onchange = () => { const d = new Date($('#tsDate', root).value); if (!isNaN(d)) { input.value = d.toISOString(); run(); } };
        input.addEventListener('input', D.debounce(run, 300));
        function tick() {
          if (!document.body.contains(root)) return;
          const now = new Date();
          $('#tsNow', root).textContent = `${Math.floor(now.getTime() / 1000)}`;
          $('#tsNowSub', root).textContent = now.toLocaleString('ru-RU', { dateStyle: 'full', timeStyle: 'medium' });
        }
        tick(); run();
        const timer = setInterval(() => {
          if (!document.body.contains(root)) { clearInterval(timer); return; }
          tick();
        }, 1000);
      }
    },

    {
      id: 'cron', name: 'Cron Parser', icon: '⣿', cat: 'text',
      desc: 'Разбор cron-выражений, объяснение и следующие 5 запусков',
      render(root) {
        root.innerHTML = `
          <div class="field mb"><span>Cron выражение (5 полей: минута час день месяц день_недели)</span>
            <input id="crIn" class="mono" value="*/15 9-18 * * 1-5" placeholder="*/15 9-18 * * 1-5">
          </div>
          <div class="toolbar mb">
            <button class="btn btn-primary" id="crGo">Разобрать</button>
            <button class="btn" id="crNext">Следующие 5</button>
            <span class="spacer"></span>
            <button class="btn btn-sm" data-cron="* * * * *">каждую минуту</button>
            <button class="btn btn-sm" data-cron="0 * * * *">каждый час</button>
            <button class="btn btn-sm" data-cron="0 9 * * *">09:00</button>
            <button class="btn btn-sm" data-cron="0 9 * * 1-5">рабочие 09:00</button>
            <button class="btn btn-sm" data-cron="0 0 1 * *">1-е число</button>
          </div>
          <div class="split">
            <div>
              <div class="panel-soft"><div class="panel-title">Объяснение</div><div id="crDesc" class="stack"></div></div>
              <div class="panel-soft mt"><div class="panel-title">Поля</div><table class="kv-table" id="crFields"></table></div>
            </div>
            <div>
              <div class="out-label"><span class="label">Следующие запуски</span><span class="hint" id="crTz"></span></div>
              <div id="crRuns" class="list"><div class="hint">Нажмите «Следующие 5»</div></div>
              <div class="hint mt-sm">Расчёт по локальному времени устройства. Для сложных выражений с DOM/DOW используется OR-семантика.</div>
            </div>
          </div>`;
        const input = $('#crIn', root);
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        const dows = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
        const monthNames = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
        const dowNames = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        function parseField(raw, min, max, names) {
          const set = new Set();
          for (let part of String(raw).split(',')) {
            part = part.trim().toLowerCase();
            if (!part) throw new Error('пустое поле');
            let step = 1;
            if (part.includes('/')) {
              const [a, b] = part.split('/');
              part = a; step = Number(b);
              if (!step || step < 1) throw new Error('неверный шаг');
            }
            let from, to;
            if (part === '*' || part === '?') { from = min; to = max; }
            else if (part.includes('-')) {
              const [a, b] = part.split('-');
              from = names && names[a] !== undefined ? names[a] : Number(a);
              to = names && names[b] !== undefined ? names[b] : Number(b);
            } else {
              from = names && names[part] !== undefined ? names[part] : Number(part);
              to = step > 1 ? max : from;
            }
            if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error('не число: ' + part);
            if (from < min || to > max) throw new Error(`вне диапазона ${min}–${max}: ${part}`);
            for (let v = from; v <= to; v += step) set.add(v);
          }
          return set;
        }
        function nextRuns(expr, count) {
          const parts = expr.trim().split(/\s+/);
          if (parts.length !== 5) throw new Error('Нужно ровно 5 полей');
          const minutes = parseField(parts[0], 0, 59);
          const hours = parseField(parts[1], 0, 23);
          const doms = parseField(parts[2], 1, 31);
          const monthsSet = parseField(parts[3], 1, 12, monthNames);
          let dowsSet = parseField(parts[4], 0, 7, dowNames);
          if (dowsSet.has(7)) dowsSet.add(0);
          const domRestricted = parts[2] !== '*' && parts[2] !== '?';
          const dowRestricted = parts[4] !== '*' && parts[4] !== '?';
          const start = new Date();
          start.setSeconds(0, 0);
          start.setMinutes(start.getMinutes() + 1);
          const runs = [];
          const end = start.getTime() + 366 * 86400000;
          const d = new Date(start);
          while (d.getTime() < end && runs.length < count) {
            if (!minutes.has(d.getMinutes())) { d.setMinutes(d.getMinutes() + 1); continue; }
            if (!hours.has(d.getHours())) { d.setHours(d.getHours() + 1, 0, 0, 0); continue; }
            if (!monthsSet.has(d.getMonth() + 1)) { d.setMonth(d.getMonth() + 1, 1); d.setHours(0, 0, 0, 0); continue; }
            const domOk = doms.has(d.getDate());
            const dowOk = dowsSet.has(d.getDay());
            const dayOk = domRestricted && dowRestricted ? (domOk || dowOk) : (domOk && dowOk);
            if (!dayOk) { d.setDate(d.getDate() + 1); d.setHours(0, 0, 0, 0); continue; }
            runs.push(new Date(d));
            d.setMinutes(d.getMinutes() + 1);
          }
          return runs;
        }
        function describe(raw, min, max, kind) {
          raw = String(raw).trim();
          if (raw === '*' || raw === '?') return 'любое';
          if (/^\*\/\d+$/.test(raw)) return `каждые ${raw.split('/')[1]} ${kind}`;
          if (/^\d+$/.test(raw)) return raw;
          if (/^\d+-\d+$/.test(raw)) {
            if (kind === 'мин') return `с ${raw.split('-')[0]} по ${raw.split('-')[1]} минуту`;
            if (kind === 'час') return `с ${raw.split('-')[0]} до ${raw.split('-')[1]} часа`;
          }
          if (/^\d+-\d+\/\d+$/.test(raw)) {
            const [r, s] = raw.split('/');
            return `с ${r.split('-')[0]} по ${r.split('-')[1]} каждые ${s}`;
          }
          return raw.replace(/,/g, ', ');
        }
        function run(showNext) {
          const expr = input.value.trim();
          try {
            const parts = expr.split(/\s+/);
            if (parts.length !== 5) throw new Error('Ожидается 5 полей: минута час день месяц день_недели');
            nextRuns(expr, 5);
            const labels = ['Минута', 'Час', 'День месяца', 'Месяц', 'День недели'];
            const kinds = ['мин', 'час', '', '', ''];
            $('#crFields', root).innerHTML = parts.map((p, i) => `<tr><td>${labels[i]}</td><td class="mono">${esc(p)}</td><td class="hint">${esc(describe(p, 0, 0, kinds[i]))}</td></tr>`).join('');
            const minute = describe(parts[0], 0, 59, 'мин');
            const hour = describe(parts[1], 0, 23, 'час');
            let dayText = parts[2] === '*' ? 'каждый день' : `в день ${parts[2]}`;
            if (parts[4] !== '*') dayText = 'по дням недели: ' + parts[4];
            $('#crDesc', root).innerHTML = `
              <div class="list-item"><span class="grow">Минуты</span><b>${esc(minute)}</b></div>
              <div class="list-item"><span class="grow">Часы</span><b>${esc(hour)}</b></div>
              <div class="list-item"><span class="grow">Дни</span><b>${esc(dayText)}</b></div>
              <div class="list-item"><span class="grow">Месяцы</span><b>${esc(describe(parts[3], 1, 12, 'мес'))}</b></div>`;
            if (showNext) {
              const runs = nextRuns(expr, 5);
              $('#crRuns', root).innerHTML = runs.length ? runs.map((d) => `<div class="list-item"><span class="chip accent">${d.toLocaleDateString('ru-RU', { weekday: 'short' })}</span><span class="grow mono">${d.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</span><span class="hint">${D.timeAgo(d.getTime())}</span></div>`).join('') : '<div class="hint">Нет запусков в течение года</div>';
            }
          } catch (e) {
            $('#crDesc', root).innerHTML = `<div class="error-text">✕ ${esc(e.message)}</div>`;
            $('#crFields', root).innerHTML = '';
            $('#crRuns', root).innerHTML = '';
          }
        }
        $('#crGo', root).onclick = () => run(false);
        $('#crNext', root).onclick = () => run(true);
        input.addEventListener('input', D.debounce(() => run(false), 300));
        root.querySelectorAll('[data-cron]').forEach((b) => { b.onclick = () => { input.value = b.dataset.cron; run(true); }; });
        run(true);
      }
    },

    {
      id: 'perm', name: 'Unix Permissions', icon: 'rwx', cat: 'text',
      desc: 'Права chmod: rwx-чекбоксы, octal и символьная запись',
      render(root) {
        root.innerHTML = `
          <div class="split">
            <div class="panel-soft">
              <div class="panel-title">Права</div>
              <div class="form-grid" id="pmGrid"></div>
              <div class="toolbar mt">
                <span class="label">Octal:</span>
                <input id="pmOctal" class="mono" style="width:100px" value="0644">
                <button class="btn" id="pmApply">Применить</button>
                <span class="hint" id="pmMsg"></span>
              </div>
              <div class="panel-title mt">Пресеты</div>
              <div class="row">
                <button class="btn btn-sm" data-perm="644">644 файл</button>
                <button class="btn btn-sm" data-perm="755">755 скрипт</button>
                <button class="btn btn-sm" data-perm="600">600 приватный</button>
                <button class="btn btn-sm" data-perm="700">700 только владелец</button>
                <button class="btn btn-sm" data-perm="775">775 группа</button>
                <button class="btn btn-sm" data-perm="777">777 всё</button>
              </div>
            </div>
            <div>
              <div class="out-label"><span class="label">Результат</span><button class="btn btn-sm" id="pmCopy">Копировать</button></div>
              <div class="code" id="pmOut" style="min-height:260px;font-size:13px"></div>
            </div>
          </div>`;
        const grid = $('#pmGrid', root);
        const groups = [
          { key: 'u', name: 'Владелец', shift: 6 },
          { key: 'g', name: 'Группа', shift: 3 },
          { key: 'o', name: 'Остальные', shift: 0 }
        ];
        grid.innerHTML = groups.map((g) => `
          <div class="field"><span>${g.name}</span>
            <div class="row">
              <label class="check"><input type="checkbox" data-g="${g.key}" data-b="4" checked> r</label>
              <label class="check"><input type="checkbox" data-g="${g.key}" data-b="2" checked> w</label>
              <label class="check"><input type="checkbox" data-g="${g.key}" data-b="1"> x</label>
            </div>
          </div>`).join('') + `
          <div class="field"><span>Специальные биты</span>
            <div class="row">
              <label class="check"><input type="checkbox" id="pmSuid"> setuid (4)</label>
              <label class="check"><input type="checkbox" id="pmSgid"> setgid (2)</label>
              <label class="check"><input type="checkbox" id="pmSticky"> sticky (1)</label>
            </div>
          </div>`;
        function calc() {
          let octal = 0;
          groups.forEach((g) => {
            let v = 0;
            root.querySelectorAll(`[data-g="${g.key}"]`).forEach((c) => { if (c.checked) v += Number(c.dataset.b); });
            octal += v << g.shift;
          });
          const special = (($('#pmSuid', root).checked ? 4 : 0) + ($('#pmSgid', root).checked ? 2 : 0) + ($('#pmSticky', root).checked ? 1 : 0));
          octal += special * 512;
          const oct = octal.toString(8).padStart(4, '0');
          if (document.activeElement !== $('#pmOctal', root)) $('#pmOctal', root).value = oct;
          let sym = '';
          groups.forEach((g) => {
            const v = (octal >> g.shift) & 7;
            let s = (v & 4 ? 'r' : '-') + (v & 2 ? 'w' : '-');
            if (g.key === 'u' && special & 4) s += (v & 1 ? 's' : 'S');
            else if (g.key === 'g' && special & 2) s += (v & 1 ? 's' : 'S');
            else if (g.key === 'o' && special & 1) s += (v & 1 ? 't' : 'T');
            else s += (v & 1 ? 'x' : '-');
            sym += s;
          });
          const desc = [];
          groups.forEach((g) => {
            const v = (octal >> g.shift) & 7;
            desc.push(`${g.name}: ${[v & 4 ? 'чтение' : '', v & 2 ? 'запись' : '', v & 1 ? 'выполнение' : ''].filter(Boolean).join(', ') || 'нет прав'}`);
          });
          $('#pmOut', root).innerHTML = `chmod ${oct} file\n\nOctal:  ${oct}\nSymbolic: -${sym}\n\n${desc.join('\n')}\n${special ? '\nСпецбиты: ' + [$('#pmSuid', root).checked ? 'setuid' : '', $('#pmSgid', root).checked ? 'setgid' : '', $('#pmSticky', root).checked ? 'sticky' : ''].filter(Boolean).join(', ') : ''}`;
        }
        root.querySelectorAll('[data-g]').forEach((c) => { c.onchange = calc; });
        ['pmSuid', 'pmSgid', 'pmSticky'].forEach((id) => { $('#' + id, root).onchange = calc; });
        $('#pmApply', root).onclick = () => {
          const val = parseInt($('#pmOctal', root).value.replace(/[^0-7]/g, ''), 8);
          if (isNaN(val)) { $('#pmMsg', root).innerHTML = '<span class="error-text">Неверный octal</span>'; return; }
          const special = (val >> 9) & 7;
          $('#pmSuid', root).checked = !!(special & 4);
          $('#pmSgid', root).checked = !!(special & 2);
          $('#pmSticky', root).checked = !!(special & 1);
          groups.forEach((g) => {
            const v = (val >> g.shift) & 7;
            root.querySelectorAll(`[data-g="${g.key}"]`).forEach((c) => { c.checked = !!(v & Number(c.dataset.b)); });
          });
          $('#pmMsg', root).innerHTML = '<span class="ok-text">✓</span>';
          calc();
        };
        root.querySelectorAll('[data-perm]').forEach((b) => { b.onclick = () => { $('#pmOctal', root).value = b.dataset.perm; $('#pmApply', root).click(); }; });
        $('#pmCopy', root).onclick = () => copy($('#pmOut', root).textContent);
        calc();
      }
    },

    {
      id: 'ip', name: 'IP Subnet Calculator', icon: '⛓', cat: 'api',
      desc: 'Маска, сеть, broadcast, диапазон хостов и двоичное представление IPv4',
      render(root) {
        root.innerHTML = `
          <div class="field mb"><span>IP-адрес / CIDR</span>
            <input id="ipIn" class="mono" value="192.168.1.10/24" placeholder="192.168.1.0/24">
          </div>
          <div class="toolbar mb">
            <button class="btn btn-primary" id="ipGo">Рассчитать</button>
            <span class="hint" id="ipErr"></span>
          </div>
          <div class="grid-2" id="ipOut"></div>
          <div class="panel-soft mt">
            <div class="panel-title">Двоичное представление</div>
            <div class="code" id="ipBin"></div>
          </div>`;
        const input = $('#ipIn', root);
        const ipToInt = (ip) => ip.split('.').reduce((a, b) => (a * 256) + Number(b), 0) >>> 0;
        const intToIp = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
        function run() {
          const raw = input.value.trim();
          const m = /^(\d{1,3}(?:\.\d{1,3}){3})(?:\/(\d{1,2}))?$/.exec(raw);
          if (!m) { $('#ipOut', root).innerHTML = ''; $('#ipBin', root).textContent = ''; $('#ipErr', root).innerHTML = '<span class="error-text">Неверный IPv4 или CIDR</span>'; return; }
          const octets = m[1].split('.').map(Number);
          if (octets.some((o) => o < 0 || o > 255)) { $('#ipErr', root).innerHTML = '<span class="error-text">Октет вне диапазона 0–255</span>'; return; }
          const prefix = m[2] !== undefined ? Number(m[2]) : 32;
          if (prefix < 0 || prefix > 32) { $('#ipErr', root).innerHTML = '<span class="error-text">Префикс 0–32</span>'; return; }
          $('#ipErr', root).textContent = '';
          const ipInt = ipToInt(m[1]);
          const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;
          const network = (ipInt & mask) >>> 0;
          const broadcast = (network | (~mask >>> 0)) >>> 0;
          const total = Math.pow(2, 32 - prefix);
          const first = prefix >= 31 ? network : network + 1;
          const last = prefix >= 31 ? broadcast : broadcast - 1;
          const usable = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.max(0, total - 2);
          const isPrivate = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(m[1]);
          const cls = octets[0] < 128 ? 'A' : octets[0] < 192 ? 'B' : octets[0] < 224 ? 'C' : octets[0] < 240 ? 'D' : 'E';
          const items = [
            ['IP адрес', m[1]], ['Префикс', '/' + prefix], ['Маска', intToIp(mask)], ['Wildcard', intToIp((~mask) >>> 0)],
            ['Сеть', intToIp(network)], ['Broadcast', intToIp(broadcast)], ['Первый хост', prefix === 32 ? '—' : intToIp(first)],
            ['Последний хост', prefix === 32 ? '—' : intToIp(last)], ['Всего адресов', total.toLocaleString('ru-RU')],
            ['Доступно хостов', usable.toLocaleString('ru-RU')], ['Класс', cls], ['Тип', isPrivate ? 'private' : 'public']
          ];
          $('#ipOut', root).innerHTML = items.map(([k, v], i) => `<div class="panel-soft"><div class="row-between"><span class="label">${k}</span><button class="btn btn-sm" data-ipcopy="${i}">⧉</button></div><div class="mono mt-sm" id="ipv-${i}" style="font-size:14px">${esc(v)}</div></div>`).join('');
          $('#ipOut', root).querySelectorAll('[data-ipcopy]').forEach((b) => { b.onclick = () => copy($('#ipv-' + b.dataset.ipcopy, root).textContent); });
          const bin = (n) => n.toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1.');
          $('#ipBin', root).textContent = `IP:    ${bin(ipInt)}\nМаска: ${bin(mask)}\nСеть:  ${bin(network)}\nBroad.:${bin(broadcast)}`;
        }
        $('#ipGo', root).onclick = run;
        input.addEventListener('input', D.debounce(run, 250));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
        run();
      }
    },

    {
      id: 'status', name: 'HTTP Status Codes', icon: '⇢', cat: 'api',
      desc: 'Справочник кодов ответа HTTP с пояснениями и поиском',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <input id="stSearch" placeholder="Поиск: 404, timeout, auth..." style="max-width:340px">
            <span class="spacer"></span>
            <button class="btn btn-sm is-active" data-stfilter="all">Все</button>
            <button class="btn btn-sm" data-stfilter="2">2xx</button>
            <button class="btn btn-sm" data-stfilter="3">3xx</button>
            <button class="btn btn-sm" data-stfilter="4">4xx</button>
            <button class="btn btn-sm" data-stfilter="5">5xx</button>
          </div>
          <div id="stList" class="list"></div>`;
        let filter = 'all';
        function renderList() {
          const q = $('#stSearch', root).value.trim().toLowerCase();
          const list = STATUS.filter(([code, title, ru, level, desc]) => {
            if (filter !== 'all' && String(code)[0] !== filter) return false;
            if (!q) return true;
            return String(code).includes(q) || title.toLowerCase().includes(q) || ru.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
          });
          $('#stList', root).innerHTML = list.length ? list.map(([code, title, ru, level, desc]) => `
            <div class="list-item">
              <span class="chip ${level}" style="min-width:52px;justify-content:center;font-family:var(--mono)">${code}</span>
              <div class="grow"><b>${esc(title)}</b> <span class="hint">— ${esc(ru)}</span><div class="hint">${esc(desc)}</div></div>
              <button class="btn btn-sm" data-code="${code}">⧉</button>
            </div>`).join('') : '<div class="empty-state">Ничего не найдено</div>';
          root.querySelectorAll('[data-code]').forEach((b) => { b.onclick = () => copy(b.dataset.code); });
        }
        $('#stSearch', root).addEventListener('input', D.debounce(renderList, 150));
        root.querySelectorAll('[data-stfilter]').forEach((b) => {
          b.onclick = () => {
            filter = b.dataset.stfilter;
            root.querySelectorAll('[data-stfilter]').forEach((x) => x.classList.toggle('is-active', x === b));
            renderList();
          };
        });
        renderList();
      }
    },

    {
      id: 'mime', name: 'MIME Types', icon: '⎚', cat: 'api',
      desc: 'Справочник MIME-типов и расширений файлов с поиском',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <input id="miSearch" placeholder="Поиск: json, image, pdf..." style="max-width:360px">
            <span class="hint" id="miCount"></span>
          </div>
          <div class="panel" style="padding:0;overflow:auto;max-height:600px">
            <table class="kv-table" id="miTable">
              <thead><tr><th>Расширение</th><th>MIME</th><th>Описание</th><th></th></tr></thead>
              <tbody></tbody>
            </table>
          </div>`;
        function renderList() {
          const q = $('#miSearch', root).value.trim().toLowerCase();
          const rows = MIMES.filter(([ext, mime, desc]) => !q || ext.includes(q) || mime.toLowerCase().includes(q) || desc.toLowerCase().includes(q));
          $('#miCount', root).textContent = `${rows.length} из ${MIMES.length}`;
          const tbody = $('#miTable', root).querySelector('tbody');
          tbody.innerHTML = rows.map(([ext, mime, desc], i) => `<tr><td class="mono">.${esc(ext)}</td><td class="mono" style="word-break:break-all">${esc(mime)}</td><td class="hint">${esc(desc)}</td><td><button class="btn btn-sm" data-mime="${esc(mime)}">⧉</button></td></tr>`).join('');
          tbody.querySelectorAll('[data-mime]').forEach((b) => { b.onclick = () => copy(b.dataset.mime); });
        }
        $('#miSearch', root).addEventListener('input', D.debounce(renderList, 120));
        renderList();
      }
    }
  ]);
})();
