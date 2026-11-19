/* DevSuite Pro — WebSocket & DNS tools */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, store, fmtMs, fmtBytes, saveText } = D;

  D.registerTools([
    {
      id: 'ws', name: 'WebSocket Client', icon: '⇆', cat: 'api', badge: 'core',
      desc: 'Подключение к ws:// и wss://, обмен сообщениями, лог кадров и статусы',
      render(root) {
        const last = store.get('ws.last', { url: 'wss://echo.websocket.events', protocols: '', autoScroll: true });
        root.innerHTML = `
          <div class="http-bar">
            <select id="wsState" disabled><option>ws</option></select>
            <input id="wsUrl" class="mono" placeholder="wss://example.com/socket" value="${esc(last.url || 'wss://echo.websocket.events')}" spellcheck="false">
            <button class="btn btn-primary btn-send" id="wsConnect">Подключиться</button>
          </div>
          <div class="http-meta">
            <span class="chip" id="wsBadge">отключено</span>
            <span class="hint" id="wsInfo">—</span>
            <span class="spacer"></span>
            <input id="wsProtocols" class="mono" style="max-width:260px;font-size:11px" placeholder="protocols: chat, json" value="${esc(last.protocols || '')}">
            <button class="btn btn-ghost btn-sm" id="wsClear">Очистить лог</button>
            <button class="btn btn-ghost btn-sm" id="wsSave">Экспорт</button>
          </div>
          <div class="split-wide">
            <div>
              <div class="panel" style="padding:0;overflow:hidden">
                <div class="resp-head">
                  <span class="label" style="font-size:11.5px">Сообщения</span>
                  <span class="hint" id="wsCount">0</span>
                  <div class="spacer"></div>
                  <label class="check"><input type="checkbox" id="wsAutoScroll" ${last.autoScroll !== false ? 'checked' : ''}> автоскролл</label>
                  <label class="check"><input type="checkbox" id="wsFormatJson"> JSON</label>
                </div>
                <div class="code" id="wsLog" style="height:420px;max-height:52vh;overflow:auto;background:var(--bg-deep);white-space:pre-wrap">Ожидание подключения…</div>
              </div>
              <div class="toolbar mt">
                <textarea id="wsMessage" class="mono" style="flex:1;min-width:200px;min-height:74px" spellcheck="false" placeholder='Текст сообщения или JSON: {"type":"ping"}'>{"type":"ping","ts":${Date.now()}}</textarea>
                <div class="stack">
                  <button class="btn btn-primary" id="wsSend" disabled>Отправить ➤</button>
                  <button class="btn btn-sm" id="wsPing" disabled>Пинг</button>
                </div>
              </div>
              <div class="hint mt-sm">Enter — отправить, Shift+Enter — новая строка. Браузерный WebSocket не позволяет задавать произвольные заголовки; авторизацию передавайте в query или первым сообщением.</div>
            </div>
            <div>
              <div class="panel-soft">
                <div class="panel-title">Быстрый старт</div>
                <div class="stack">
                  <button class="btn btn-sm" data-wsurl="wss://echo.websocket.events">echo.websocket.events</button>
                  <button class="btn btn-sm" data-wsurl="wss://ws.postman-echo.com/raw">ws.postman-echo.com/raw</button>
                  <button class="btn btn-sm" data-wsurl="wss://stream.binance.com:9443/ws/btcusdt@trade">Binance trades</button>
                  <button class="btn btn-sm" data-wsurl="ws://localhost:8080/ws">Локальный ws://localhost</button>
                </div>
              </div>
              <div class="panel-soft mt">
                <div class="panel-title">Подписка Binance</div>
                <div class="field"><span>Сообщение для подписки</span>
                  <textarea id="wsSub" class="mono" style="min-height:90px" spellcheck="false">{"method":"SUBSCRIBE","params":["btcusdt@trade"],"id":1}</textarea>
                </div>
                <button class="btn btn-sm mt" id="wsUseSub">Вставить в поле отправки</button>
              </div>
              <div class="panel-soft mt">
                <div class="panel-title">Статистика</div>
                <table class="kv-table" id="wsStats">
                  <tr><td>Получено</td><td>0</td></tr>
                  <tr><td>Отправлено</td><td>0</td></tr>
                  <tr><td>Трафик</td><td>0 B</td></tr>
                </table>
              </div>
            </div>
          </div>`;

        const url = $('#wsUrl', root), state = $('#wsBadge', root), info = $('#wsInfo', root), log = $('#wsLog', root),
          countEl = $('#wsCount', root), msg = $('#wsMessage', root), sendBtn = $('#wsSend', root), pingBtn = $('#wsPing', root),
          connectBtn = $('#wsConnect', root);

        let socket = null, openedAt = 0, rx = 0, tx = 0, bytes = 0, count = 0;
        const lines = [];

        function setState(text, cls) {
          state.textContent = text;
          state.className = 'chip ' + (cls || '');
          connectBtn.textContent = socket ? 'Отключиться' : 'Подключиться';
          sendBtn.disabled = !socket;
          pingBtn.disabled = !socket;
        }
        function addLine(dir, text, meta) {
          const time = new Date().toLocaleTimeString('ru-RU');
          lines.push({ dir, text, meta: meta || '', time });
          count++;
          const dirBadge = dir === 'in' ? '<span class="chip ok" style="min-width:34px;justify-content:center">↓</span>' :
            dir === 'out' ? '<span class="chip accent" style="min-width:34px;justify-content:center">↑</span>' :
            dir === 'sys' ? '<span class="chip" style="min-width:34px;justify-content:center">i</span>' :
            '<span class="chip err" style="min-width:34px;justify-content:center">!</span>';
          const display = $('#wsFormatJson', root).checked ? D.tryPrettyJSON(text) : text;
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:8px;padding:5px 10px;border-bottom:1px solid var(--border-soft);align-items:flex-start';
          row.innerHTML = `<span class="hint" style="flex:0 0 56px">${time}</span>${dirBadge}<span class="mono grow" style="word-break:break-word;font-size:11.5px;white-space:pre-wrap">${esc(display)}</span>${meta ? `<span class="hint" style="flex:0 0 auto">${esc(meta)}</span>` : ''}`;
          if (count === 1) log.textContent = '';
          log.appendChild(row);
          countEl.textContent = count + ' сообщений';
          if ($('#wsAutoScroll', root).checked) log.scrollTop = log.scrollHeight;
          updateStats();
        }
        function updateStats() {
          const rows = $('#wsStats', root).querySelectorAll('tr td:last-child');
          if (rows.length >= 3) {
            rows[0].textContent = rx + ' · ' + fmtBytes(bytes);
            rows[1].textContent = String(tx);
            rows[2].textContent = fmtBytes(bytes);
          }
        }
        function connect() {
          let raw = url.value.trim();
          if (!raw) { toast('Введите URL', 'err'); return; }
          if (!/^wss?:\/\//i.test(raw)) raw = 'wss://' + raw;
          let ws;
          try {
            const protocols = $('#wsProtocols', root).value.split(',').map((s) => s.trim()).filter(Boolean);
            ws = protocols.length ? new WebSocket(raw, protocols) : new WebSocket(raw);
          } catch (e) {
            setState('ошибка URL', 'err');
            addLine('err', e.message);
            return;
          }
          socket = ws;
          setState('подключение…', 'warn');
          info.textContent = raw;
          addLine('sys', 'Подключение к ' + raw);
          store.set('ws.last', { url: raw, protocols: $('#wsProtocols', root).value, autoScroll: $('#wsAutoScroll', root).checked });

          ws.onopen = () => {
            openedAt = Date.now();
            rx = 0; tx = 0; bytes = 0;
            setState('открыто', 'ok');
            info.innerHTML = `протокол: <b>${esc(ws.protocol || '—')}</b> · расширения: ${esc(ws.extensions || '—')}`;
            addLine('sys', 'Соединение установлено');
          };
          ws.onmessage = async (ev) => {
            rx++;
            let text = ev.data;
            let size = 0;
            if (typeof text === 'string') size = D.utf8(text).length;
            else if (text instanceof Blob) { size = text.size; text = '[Blob ' + fmtBytes(text.size) + ']'; }
            else if (text instanceof ArrayBuffer) { size = text.byteLength; text = '[ArrayBuffer ' + fmtBytes(size) + '] ' + D.bytesToHex(new Uint8Array(text).slice(0, 64)); }
            bytes += size;
            addLine('in', text, fmtBytes(size));
          };
          ws.onerror = () => {
            addLine('err', 'Ошибка WebSocket. Проверьте URL, TLS и доступность сервера.');
          };
          ws.onclose = (ev) => {
            socket = null;
            setState('закрыто', ev.wasClean ? '' : 'err');
            info.textContent = `код ${ev.code}${ev.reason ? ' · ' + ev.reason : ''}${openedAt ? ' · ' + fmtMs(Date.now() - openedAt) : ''}`;
            addLine('sys', `Соединение закрыто (code ${ev.code}${ev.reason ? ', ' + ev.reason : ''})`);
            sendBtn.disabled = true; pingBtn.disabled = true;
            connectBtn.textContent = 'Подключиться';
          };
        }
        function disconnect() {
          if (socket) { try { socket.close(1000, 'client disconnect'); } catch (_) {} }
          socket = null;
          setState('отключено');
        }
        function send() {
          if (!socket || socket.readyState !== 1) { toast('Соединение не открыто', 'err'); return; }
          const text = msg.value;
          if (!text) return;
          socket.send(text);
          tx++;
          bytes += D.utf8(text).length;
          addLine('out', text, fmtBytes(D.utf8(text).length));
        }
        connectBtn.onclick = () => { if (socket) disconnect(); else connect(); };
        sendBtn.onclick = send;
        pingBtn.onclick = () => { msg.value = '{"type":"ping","ts":' + Date.now() + '}'; send(); };
        msg.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
        $('#wsClear', root).onclick = () => { lines.length = 0; count = 0; log.textContent = 'Лог очищен'; countEl.textContent = '0'; };
        $('#wsSave', root).onclick = () => {
          const text = lines.map((l) => `[${l.time}] ${l.dir.toUpperCase()} ${l.text}${l.meta ? ' (' + l.meta + ')' : ''}`).join('\n');
          saveText('websocket-log.txt', text || 'Нет сообщений');
        };
        $('#wsFormatJson', root).onchange = () => {
          log.textContent = '';
          const saved = lines.slice();
          lines.length = 0; count = 0;
          saved.forEach((l) => addLine(l.dir, l.text, l.meta));
        };
        root.querySelectorAll('[data-wsurl]').forEach((b) => { b.onclick = () => { url.value = b.dataset.wsurl; store.set('ws.last', { url: url.value, protocols: $('#wsProtocols', root).value, autoScroll: true }); }; });
        $('#wsUseSub', root).onclick = () => { msg.value = $('#wsSub', root).value; msg.focus(); };
        window.addEventListener('beforeunload', () => { if (socket) try { socket.close(); } catch (_) {} });
      }
    },

    {
      id: 'dns', name: 'DNS Lookup', icon: '⌘', cat: 'api',
      desc: 'A, AAAA, MX, TXT, CNAME, NS, SOA и SRV записи через системный DNS или DoH',
      render(root) {
        root.innerHTML = `
          <div class="form-grid mb">
            <div class="field" style="grid-column:span 2"><span>Домен</span><input id="dnsHost" class="mono" value="example.com" placeholder="example.com"></div>
            <div class="field"><span>Тип записи</span>
              <select id="dnsType"><option>A</option><option>AAAA</option><option>MX</option><option>TXT</option><option>CNAME</option><option>NS</option><option>SOA</option><option>SRV</option><option>PTR</option></select>
            </div>
            <div class="field"><span>Резолвер</span>
              <select id="dnsResolver"><option value="auto">системный / Google DoH</option><option value="google">Google DoH</option><option value="cloudflare">Cloudflare DoH</option></select>
            </div>
          </div>
          <div class="toolbar mb">
            <button class="btn btn-primary" id="dnsGo">Запросить</button>
            <button class="btn" id="dnsTrace">Проверить A + AAAA + MX</button>
            <span class="spacer"></span>
            <span class="hint" id="dnsMsg"></span>
          </div>
          <div class="split">
            <div class="panel" style="padding:0;overflow:auto;max-height:520px">
              <table class="kv-table" id="dnsTable"><thead><tr><th>Тип</th><th>Значение</th><th>Ttl</th></tr></thead><tbody><tr><td colspan="3" class="hint">Выполните запрос</td></tr></tbody></table>
            </div>
            <div>
              <div class="panel-soft">
                <div class="panel-title">Результат</div>
                <div class="code" id="dnsRaw" style="max-height:260px">—</div>
                <div class="toolbar mt-sm">
                  <button class="btn btn-sm" id="dnsCopy">Копировать</button>
                  <button class="btn btn-sm" id="dnsSave">Скачать .json</button>
                </div>
              </div>
              <div class="panel-soft mt">
                <div class="panel-title">Популярные домены</div>
                <div class="row">
                  <button class="btn btn-sm" data-domain="google.com">google.com</button>
                  <button class="btn btn-sm" data-domain="github.com">github.com</button>
                  <button class="btn btn-sm" data-domain="api.telegram.org">api.telegram.org</button>
                  <button class="btn btn-sm" data-domain="openai.com">openai.com</button>
                </div>
              </div>
              <div class="hint mt">В EXE используется системный DNS (быстрее и учитывает hosts). В APK/браузере — DNS-over-HTTPS через Google или Cloudflare.</div>
            </div>
          </div>`;

        const host = $('#dnsHost', root), type = $('#dnsType', root), resolver = $('#dnsResolver', root),
          msg = $('#dnsMsg', root), table = $('#dnsTable', root), raw = $('#dnsRaw', root);
        let lastResult = null;

        function render(rows, meta) {
          table.querySelector('tbody').innerHTML = rows.length ? rows.map((r) => `<tr><td class="mono">${esc(r.type || type.value)}</td><td class="mono" style="word-break:break-all">${esc(r.value)}</td><td class="hint">${esc(r.ttl != null ? r.ttl : '—')}</td></tr>`).join('') : '<tr><td colspan="3" class="hint">Записей не найдено</td></tr>';
          raw.textContent = JSON.stringify(lastResult, null, 2);
          msg.innerHTML = `<span class="ok-text">✓ ${rows.length} записей${meta ? ' · ' + esc(meta) : ''}</span>`;
        }
        async function doh(name, t, provider) {
          const base = provider === 'cloudflare' ? 'https://cloudflare-dns.com/dns-query?name=' : 'https://dns.google/resolve?name=';
          const res = await D.http({ method: 'GET', url: base + encodeURIComponent(name) + '&type=' + encodeURIComponent(t), headers: { Accept: 'application/dns-json' }, timeout: 30000 });
          if (res.status !== 200) throw new Error('DNS-over-HTTPS HTTP ' + res.status);
          const data = JSON.parse(res.text);
          if (data.Status && data.Status !== 0) {
            const codes = { 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' };
            throw new Error('DNS ответ: ' + (codes[data.Status] || data.Status));
          }
          return (data.Answer || []).map((a) => ({ type: t, value: a.data, ttl: a.TTL }));
        }
        async function query(name, t, quiet) {
          let rows = [], via = '';
          try {
            if (window.devsuite && resolver.value === 'auto' && !['PTR'].includes(t)) {
              const r = await window.devsuite.dnsLookup(name, t);
              rows = (r.records || []).map((v) => ({ type: t, value: String(v), ttl: null }));
              via = 'системный DNS · ' + D.fmtMs(r.time);
            } else {
              rows = await doh(name, t, resolver.value === 'cloudflare' ? 'cloudflare' : 'google');
              via = 'DoH';
            }
          } catch (e) {
            if (!quiet) msg.innerHTML = `<span class="error-text">✕ ${esc(e.message)}</span>`;
            throw e;
          }
          return { rows, via };
        }
        async function run() {
          const name = host.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          if (!name) { toast('Введите домен', 'err'); return; }
          msg.textContent = 'Запрос…';
          try {
            const { rows, via } = await query(name, type.value);
            lastResult = { name, type: type.value, rows, via, ts: new Date().toISOString() };
            render(rows, via);
          } catch (e) { table.querySelector('tbody').innerHTML = `<tr><td colspan="3" class="error-text">${esc(e.message)}</td></tr>`; raw.textContent = ''; }
        }
        async function trace() {
          msg.textContent = 'Проверка…';
          table.querySelector('tbody').innerHTML = '';
          const all = [];
          let fails = 0;
          for (const t of ['A', 'AAAA', 'MX', 'TXT']) {
            try {
              const { rows } = await query(host.value.trim(), t, true);
              rows.forEach((r) => { r.type = t; all.push(r); });
            } catch (_) { fails++; }
          }
          lastResult = { name: host.value.trim(), type: 'A+AAAA+MX+TXT', rows: all, ts: new Date().toISOString() };
          render(all, fails ? `${fails} запрос(ов) без записей` : 'все типы');
        }
        $('#dnsGo', root).onclick = run;
        $('#dnsTrace', root).onclick = trace;
        host.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
        $('#dnsCopy', root).onclick = () => copy(raw.textContent);
        $('#dnsSave', root).onclick = () => saveText('dns-' + host.value.trim() + '.json', raw.textContent, 'application/json');
        root.querySelectorAll('[data-domain]').forEach((b) => { b.onclick = () => { host.value = b.dataset.domain; run(); }; });
        run();
      }
    }
  ]);
})();
