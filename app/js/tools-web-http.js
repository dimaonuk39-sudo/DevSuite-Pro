/* DevSuite Pro — universal HTTP client */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, saveText, store, fmtMs, fmtBytes } = D;

  function parseEnv(text) {
    const o = {};
    String(text || '').split('\n').forEach((line) => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const i = t.indexOf('=');
      if (i > 0) o[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    });
    return o;
  }
  function subst(str, env) {
    return String(str).replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, k) => env[k] !== undefined ? env[k] : m);
  }
  function shellQuote(s) { return "'" + String(s).replace(/'/g, "'\\''") + "'"; }

  D.registerTools([
    {
      id: 'http', name: 'HTTP Client', icon: '⇄', cat: 'api', badge: 'core',
      desc: 'REST/GraphQL запросы: параметры, заголовки, auth, env, история, cURL',
      render(root) {
        const last = store.get('http.last', {});
        root.innerHTML = `
          <div class="http-bar">
            <select id="hMethod">${['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => `<option ${m === (last.method || 'GET') ? 'selected' : ''}>${m}</option>`).join('')}</select>
            <input id="hUrl" class="mono" placeholder="https://api.example.com/v1/users" value="${esc(last.url || 'https://jsonplaceholder.typicode.com/posts/1')}" spellcheck="false">
            <button class="btn btn-primary btn-send" id="hSend">Отправить ⏎</button>
          </div>
          <div class="http-meta">
            <span class="chip" id="hFinalWrap"><span class="mono" id="hFinalUrl">—</span></span>
            <button class="btn btn-ghost btn-sm" id="hCopyUrl">⧉ URL</button>
            <span class="spacer"></span>
            <button class="btn btn-ghost btn-sm" id="hSaveReq">Сохранить запрос</button>
            <button class="btn btn-ghost btn-sm" id="hClearHistory">Очистить историю</button>
          </div>
          <div class="http-layout">
            <div>
              <div data-tabgroup="httpReq">
                <div class="tabs">
                  <button class="tab is-active" data-tab="params">Params <span class="cnt" id="hParamsCnt">0</span></button>
                  <button class="tab" data-tab="headers">Headers</button>
                  <button class="tab" data-tab="body">Body</button>
                  <button class="tab" data-tab="auth">Auth</button>
                  <button class="tab" data-tab="options">Опции</button>
                  <button class="tab" data-tab="env">Env</button>
                  <button class="tab" data-tab="curl">cURL</button>
                </div>
                <div class="tab-pane is-active" data-pane="params"><div id="hParams"></div><div class="hint mt-sm">Параметры добавляются к URL. Поддерживаются переменные <span class="mono">{{name}}</span>.</div></div>
                <div class="tab-pane" data-pane="headers"><div id="hHeaders"></div><div class="hint mt-sm">Заголовки можно отключать чекбоксом. Content-Type подставляется автоматически для JSON/form.</div></div>
                <div class="tab-pane" data-pane="body">
                  <div class="form-grid mb">
                    <div class="field"><span>Тип тела</span>
                      <select id="hBodyType"><option value="none">none</option><option value="json" selected>JSON</option><option value="text">text/plain</option><option value="form">x-www-form-urlencoded</option></select>
                    </div>
                    <div class="field" style="justify-content:flex-end"><div class="row"><button class="btn btn-sm" id="hBodyFormat">Форматировать JSON</button></div></div>
                  </div>
                  <textarea id="hBody" class="mono" style="min-height:190px" spellcheck="false" placeholder='{"key": "value"}'>${esc(last.body || '{\n  "title": "DevSuite",\n  "body": "hello api",\n  "userId": 1\n}')}</textarea>
                </div>
                <div class="tab-pane" data-pane="auth">
                  <div class="field mb"><span>Тип авторизации</span>
                    <select id="hAuthType"><option value="none">none</option><option value="bearer">Bearer Token</option><option value="basic">Basic Auth</option><option value="apikey">API Key (header)</option></select>
                  </div>
                  <div id="hAuthFields">
                    <div data-auth="bearer" style="display:none"><div class="field"><span>Token</span><input id="hAuthToken" class="mono" placeholder="sk-..."></div></div>
                    <div data-auth="basic" style="display:none"><div class="grid-2"><div class="field"><span>Логин</span><input id="hAuthUser" class="mono"></div><div class="field"><span>Пароль</span><input id="hAuthPass" class="mono" type="password"></div></div></div>
                    <div data-auth="apikey" style="display:none"><div class="grid-2"><div class="field"><span>Имя заголовка</span><input id="hAuthHeader" class="mono" value="X-API-Key"></div><div class="field"><span>Значение</span><input id="hAuthKey" class="mono"></div></div></div>
                  </div>
                </div>
                <div class="tab-pane" data-pane="options">
                  <div class="form-grid">
                    <div class="field"><span>Таймаут, мс</span><input id="hTimeout" type="number" min="1000" max="600000" step="1000" value="${esc(last.timeout || 60000)}"></div>
                    <label class="check" style="margin-top:15px"><input type="checkbox" id="hIgnoreTls"> игнорировать ошибки TLS (desktop)</label>
                    <label class="check" style="margin-top:15px"><input type="checkbox" id="hStream" checked> показывать ответ по мере поступления</label>
                  </div>
                  <div class="hint mt">В EXE запросы идут через встроенный прокси без CORS. В APK/браузере — напрямую.</div>
                </div>
                <div class="tab-pane" data-pane="env">
                  <div class="field"><span>Переменные окружения (KEY=value)</span>
                    <textarea id="hEnv" class="mono" style="min-height:150px" spellcheck="false" placeholder="baseUrl=https://api.example.com&#10;token=...">${esc(store.get('http.env', 'baseUrl=https://jsonplaceholder.typicode.com\ntoken=YOUR_TOKEN'))}</textarea>
                  </div>
                  <div class="hint mt-sm">Используйте <span class="mono">{{baseUrl}}</span> в URL, заголовках и теле. Переменные хранятся локально.</div>
                </div>
                <div class="tab-pane" data-pane="curl">
                  <div class="field"><span>cURL</span>
                    <textarea id="hCurl" class="mono" style="min-height:180px" spellcheck="false" placeholder="curl -X POST https://api.example.com -H 'Content-Type: application/json' -d '{...}'"></textarea>
                  </div>
                  <div class="toolbar mt"><button class="btn" id="hCurlGen">Сгенерировать из запроса</button><button class="btn" id="hCurlImport">Импортировать в запрос</button><button class="btn btn-ghost" id="hCurlCopy">Копировать</button></div>
                </div>
              </div>

              <div class="panel-soft mt">
                <div class="row-between"><div class="panel-title" style="margin:0">История</div><span class="hint" id="hHistCount"></span></div>
                <div id="hHistory" class="list mt-sm" style="max-height:180px;overflow:auto"></div>
              </div>
              <div class="panel-soft mt">
                <div class="row-between"><div class="panel-title" style="margin:0">Сохранённые запросы</div><button class="btn btn-sm" id="hSaveNamed">+</button></div>
                <div id="hSaved" class="list mt-sm" style="max-height:180px;overflow:auto"></div>
              </div>
            </div>

            <div class="resp-box" id="hRespBox">
              <div class="resp-head">
                <span class="chip" id="hStatus">—</span>
                <span class="hint" id="hRespMeta">ответ</span>
                <div class="spacer"></div>
                <button class="btn btn-sm btn-danger" id="hAbort" style="display:none">■ Стоп</button>
                <button class="btn btn-sm" data-copy-target="#hRespBody">⧉</button>
                <button class="btn btn-sm" id="hSaveResp">💾</button>
              </div>
              <div data-tabgroup="httpResp">
                <div class="resp-tabs tabs" style="margin:0;padding:0 8px">
                  <button class="tab is-active" data-tab="body">Тело</button>
                  <button class="tab" data-tab="headers">Заголовки</button>
                  <button class="tab" data-tab="preview">Превью</button>
                </div>
                <div class="resp-body">
                  <div class="tab-pane is-active" data-pane="body"><div class="code" id="hRespBody" style="max-height:560px;min-height:300px">Отправьте запрос, чтобы увидеть ответ.</div></div>
                  <div class="tab-pane" data-pane="headers"><table class="kv-table" id="hRespHeaders"><tr><td>—</td><td>—</td></tr></table></div>
                  <div class="tab-pane" data-pane="preview"><div id="hRespPreview" class="hint">Превью доступно для изображений.</div></div>
                </div>
              </div>
            </div>
          </div>`;
        const method = $('#hMethod', root), url = $('#hUrl', root), sendBtn = $('#hSend', root), abortBtn = $('#hAbort', root);
        const params = D.kvEditor($('#hParams', root), last.params || [{ key: '', value: '' }], { keyPlaceholder: 'query', valuePlaceholder: 'value' });
        const headers = D.kvEditor($('#hHeaders', root), last.headers || [{ key: 'Accept', value: 'application/json' }], { keyPlaceholder: 'Header', valuePlaceholder: 'value' });
        const envArea = $('#hEnv', root), body = $('#hBody', root), bodyType = $('#hBodyType', root);
        const authType = $('#hAuthType', root);
        let request = null;
        let responseBytes = [];
        let lastText = '';
        let lastMeta = null;
        let lastSavedName = '';

        if (last.bodyType) bodyType.value = last.bodyType;
        if (last.authType) authType.value = last.authType;
        if (last.env) envArea.value = last.env;
        ['hAuthToken', 'hAuthUser', 'hAuthPass', 'hAuthHeader', 'hAuthKey'].forEach((id) => { if (last[id]) $('#' + id, root).value = last[id]; });
        if (last.timeout) $('#hTimeout', root).value = last.timeout;
        if (last.ignoreTls) $('#hIgnoreTls', root).checked = true;

        function toggleAuth() {
          root.querySelectorAll('[data-auth]').forEach((el) => { el.style.display = el.dataset.auth === authType.value ? '' : 'none'; });
        }
        authType.onchange = toggleAuth; toggleAuth();

        function getAuthFields() {
          return {
            type: authType.value,
            token: $('#hAuthToken', root).value,
            user: $('#hAuthUser', root).value,
            pass: $('#hAuthPass', root).value,
            header: $('#hAuthHeader', root).value,
            key: $('#hAuthKey', root).value
          };
        }
        function snapshot() {
          return {
            method: method.value, url: url.value,
            params: params.getRows(false), headers: headers.getRows(false),
            bodyType: bodyType.value, body: body.value,
            auth: getAuthFields(), env: envArea.value,
            timeout: $('#hTimeout', root).value, ignoreTls: $('#hIgnoreTls', root).checked
          };
        }
        function applySnapshot(s) {
          if (!s) return;
          method.value = s.method || 'GET';
          url.value = s.url || '';
          params.setRows(s.params || []);
          headers.setRows(s.headers || []);
          bodyType.value = s.bodyType || 'none';
          body.value = s.body || '';
          envArea.value = s.env || '';
          const a = s.auth || {};
          authType.value = a.type || 'none'; toggleAuth();
          $('#hAuthToken', root).value = a.token || '';
          $('#hAuthUser', root).value = a.user || '';
          $('#hAuthPass', root).value = a.pass || '';
          $('#hAuthHeader', root).value = a.header || 'X-API-Key';
          $('#hAuthKey', root).value = a.key || '';
          $('#hTimeout', root).value = s.timeout || 60000;
          $('#hIgnoreTls', root).checked = !!s.ignoreTls;
          updateFinal();
          toast('Запрос загружен');
        }

        function buildURL() {
          let raw = url.value.trim();
          if (!raw) throw new Error('Введите URL');
          const env = parseEnv(envArea.value);
          raw = subst(raw, env);
          if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
          const u = new URL(raw);
          params.getRows(true).forEach((r) => u.searchParams.append(subst(r.key, env), subst(r.value, env)));
          return u.toString();
        }
        function updateFinal() {
          try {
            const u = buildURL();
            $('#hFinalUrl', root).textContent = u;
            $('#hParamsCnt', root).textContent = params.getRows(true).length;
          } catch (_) { $('#hFinalUrl', root).textContent = '—'; }
        }
        url.addEventListener('input', D.debounce(updateFinal, 250));
        $('#hParams', root).addEventListener('input', D.debounce(updateFinal, 250));
        $('#hParams', root).addEventListener('click', () => setTimeout(updateFinal, 50));
        $('#hCopyUrl', root).onclick = () => { try { copy(buildURL()); } catch (e) { toast(e.message, 'err'); } };
        $('#hBodyFormat', root).onclick = () => { try { body.value = D.prettyJSON(body.value); } catch (_) { toast('Тело не является корректным JSON', 'err'); } };

        function setStatus(meta, extra) {
          const el = $('#hStatus', root);
          if (!meta || !meta.status) { el.className = 'chip'; el.textContent = '—'; }
          else {
            el.textContent = meta.status + ' ' + (meta.statusText || '');
            el.className = 'chip ' + (meta.status >= 200 && meta.status < 300 ? 'ok' : meta.status >= 300 && meta.status < 400 ? 'warn' : 'err');
          }
          $('#hRespMeta', root).textContent = extra || (meta && meta.url ? meta.url : 'ответ');
        }
        function showError(e) {
          setStatus(null, 'ошибка');
          $('#hRespBody', root).innerHTML = `<span class="error-text">✕ ${esc(e.message || e)}</span>`;
          $('#hRespHeaders', root).innerHTML = '';
          sendBtn.disabled = false; sendBtn.textContent = 'Отправить ⏎';
          abortBtn.style.display = 'none';
          request = null;
        }

        function buildHeaders() {
          const env = parseEnv(envArea.value);
          const out = {};
          headers.getRows(true).forEach((r) => { out[subst(r.key, env)] = subst(r.value, env); });
          const has = (name) => Object.keys(out).some((k) => k.toLowerCase() === name.toLowerCase());
          const a = getAuthFields();
          if (a.type === 'bearer' && a.token) out['Authorization'] = 'Bearer ' + subst(a.token, env);
          else if (a.type === 'basic' && (a.user || a.pass)) out['Authorization'] = 'Basic ' + D.base64EncodeText(a.user + ':' + a.pass);
          else if (a.type === 'apikey' && a.header && a.key) out[subst(a.header, env)] = subst(a.key, env);
          if (bodyType.value !== 'none' && !has('Content-Type')) {
            out['Content-Type'] = bodyType.value === 'json' ? 'application/json' : bodyType.value === 'form' ? 'application/x-www-form-urlencoded' : 'text/plain';
          }
          return out;
        }

        function send() {
          if (request) return;
          let finalURL;
          try { finalURL = buildURL(); } catch (e) { showError(e); return; }
          const m = method.value;
          const env = parseEnv(envArea.value);
          let payload = null;
          if (bodyType.value !== 'none' && m !== 'GET' && m !== 'HEAD') {
            payload = subst(body.value, env);
            if (bodyType.value === 'json') {
              try { JSON.parse(payload); } catch (e) { toast('JSON в теле некорректен: ' + e.message, 'err'); }
            }
          }
          lastText = ''; responseBytes = []; lastMeta = null;
          $('#hRespBody', root).textContent = '';
          $('#hRespHeaders', root).innerHTML = '';
          $('#hRespPreview', root).innerHTML = 'Превью доступно для изображений.';
          setStatus(null, 'отправка…');
          sendBtn.disabled = true; sendBtn.textContent = 'Отправка…';
          abortBtn.style.display = '';
          const started = performance.now();
          const streamLive = $('#hStream', root).checked;
          let acc = '';
          request = D.requestStream({
            method: m, url: finalURL, headers: buildHeaders(), body: payload,
            timeout: Number($('#hTimeout', root).value) || 60000,
            ignoreTls: $('#hIgnoreTls', root).checked
          }, {
            onResponse(meta) {
              lastMeta = meta;
              setStatus(meta, 'получение…');
              const tbl = $('#hRespHeaders', root);
              tbl.innerHTML = Object.entries(meta.headers || {}).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('') || '<tr><td>—</td><td>пусто</td></tr>';
            },
            onBytes(chunk) { responseBytes.push(chunk); },
            onText(piece) {
              acc += piece;
              if (streamLive) {
                $('#hRespBody', root).textContent = acc.length > 1200000 ? acc.slice(0, 1200000) + '\n\n…ответ обрезан для отображения (полный размер в метаданных)' : acc;
              }
            },
            onEnd(meta) {
              request = null;
              sendBtn.disabled = false; sendBtn.textContent = 'Отправить ⏎';
              abortBtn.style.display = 'none';
              lastText = meta.text;
              const total = responseBytes.reduce((n, b) => n + b.length, 0);
              setStatus({ status: meta.status, statusText: meta.statusText, url: meta.url }, `${fmtMs(meta.time)} · ${fmtBytes(total)}`);
              const ct = String((meta.headers || {})['content-type'] || '').toLowerCase();
              let display = meta.text;
              if (ct.includes('json') || /^\s*[\[{]/.test(display)) display = D.tryPrettyJSON(display);
              if (display.length > 1500000) display = display.slice(0, 1500000) + '\n\n…ответ обрезан для отображения';
              $('#hRespBody', root).textContent = display || '(пустой ответ)';
              // image preview
              if (ct.startsWith('image/') && total) {
                try {
                  const blob = new Blob(responseBytes, { type: ct.split(';')[0] });
                  const imgUrl = URL.createObjectURL(blob);
                  $('#hRespPreview', root).innerHTML = `<img src="${imgUrl}" style="max-width:100%;border-radius:10px;border:1px solid var(--border)">`;
                } catch (_) {}
              }
              addHistory({ method: m, url: finalURL, status: meta.status, time: meta.time, bytes: total });
              store.set('http.last', snapshot());
              store.set('http.env', envArea.value);
            },
            onError(e) {
              request = null;
              sendBtn.disabled = false; sendBtn.textContent = 'Отправить ⏎';
              abortBtn.style.display = 'none';
              if (e.aborted) { setStatus(null, 'отменено'); $('#hRespBody', root).textContent = 'Запрос отменён.'; }
              else {
                showError(e);
                addHistory({ method: m, url: finalURL, status: 0, error: e.message, time: performance.now() - started });
              }
            }
          });
        }

        sendBtn.onclick = send;
        abortBtn.onclick = () => { if (request) request.abort(); };
        url.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
        body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send(); });

        /* history & saved */
        function addHistory(entry) {
          const h = store.get('http.history', []);
          h.unshift(Object.assign({ ts: Date.now(), snapshot: snapshot() }, entry));
          store.set('http.history', h.slice(0, 30));
          renderHistory();
        }
        function renderHistory() {
          const h = store.get('http.history', []);
          $('#hHistCount', root).textContent = h.length ? `${h.length} записей` : '';
          $('#hHistory', root).innerHTML = h.length ? h.map((e, i) => `
            <div class="list-item" style="padding:7px 9px">
              <span class="chip ${e.status >= 200 && e.status < 300 ? 'ok' : e.status ? 'err' : 'warn'}" style="font-family:var(--mono);min-width:44px;justify-content:center">${e.status || 'ERR'}</span>
              <span class="mono grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px" title="${esc(e.url)}">${esc(e.method)} ${esc(e.url)}</span>
              <span class="hint" style="flex:0 0 62px;text-align:right">${e.time ? fmtMs(e.time) : ''}</span>
              <button class="btn btn-sm" data-hist="${i}" title="Загрузить">↺</button>
            </div>`).join('') : '<div class="hint">Пока пусто</div>';
          root.querySelectorAll('[data-hist]').forEach((b) => { b.onclick = () => applySnapshot(h[b.dataset.hist].snapshot); });
        }
        function renderSaved() {
          const s = store.get('http.saved', []);
          $('#hSaved', root).innerHTML = s.length ? s.map((e, i) => `
            <div class="list-item" style="padding:7px 9px">
              <span class="mono grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">${esc(e.name)}</span>
              <span class="hint">${esc(e.method)}</span>
              <button class="btn btn-sm" data-saved="${i}" title="Загрузить">↺</button>
              <button class="btn btn-sm" data-del="${i}" title="Удалить">✕</button>
            </div>`).join('') : '<div class="hint">Сохраните часто используемый запрос</div>';
          root.querySelectorAll('[data-saved]').forEach((b) => { b.onclick = () => applySnapshot(s[b.dataset.saved]); });
          root.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { s.splice(b.dataset.del, 1); store.set('http.saved', s); renderSaved(); }; });
        }
        $('#hSaveNamed', root).onclick = $('#hSaveReq', root).onclick = () => {
          const name = prompt('Название запроса:', lastSavedName || (method.value + ' ' + (url.value || '').replace(/^https?:\/\//, '').slice(0, 40)));
          if (!name) return;
          lastSavedName = name;
          const s = store.get('http.saved', []);
          s.unshift(Object.assign({ name, ts: Date.now() }, snapshot()));
          store.set('http.saved', s.slice(0, 50));
          renderSaved(); toast('Запрос сохранён', 'ok');
        };
        $('#hClearHistory', root).onclick = () => { store.set('http.history', []); renderHistory(); toast('История очищена'); };

        /* cURL */
        function genCurl() {
          let finalURL;
          try { finalURL = buildURL(); } catch (e) { toast(e.message, 'err'); return; }
          const h = buildHeaders();
          let s = `curl -X ${method.value} ${shellQuote(finalURL)}`;
          Object.entries(h).forEach(([k, v]) => { s += ` \\\n  -H ${shellQuote(k + ': ' + v)}`; });
          if (bodyType.value !== 'none' && method.value !== 'GET' && method.value !== 'HEAD') s += ` \\\n  --data-raw ${shellQuote(subst(body.value, parseEnv(envArea.value)))}`;
          $('#hCurl', root).value = s;
          return s;
        }
        $('#hCurlGen', root).onclick = genCurl;
        $('#hCurlCopy', root).onclick = () => { const v = $('#hCurl', root).value || genCurl(); if (v) copy(v); };
        $('#hCurlImport', root).onclick = () => {
          const text = $('#hCurl', root).value;
          if (!text.trim()) return;
          try {
            const um = /curl\s+([\s\S]*)/i.exec(text);
            const rest = um ? um[1] : text;
            let m = /-X\s+['"]?([A-Z]+)/i.exec(rest);
            if (m) method.value = m[1].toUpperCase();
            const urlM = /(?:^|\s)(?:-X\s+\w+\s+)?['"]?(https?:\/\/[^\s'"]+)['"]?/i.exec(rest);
            if (!urlM) throw new Error('URL не найден');
            url.value = urlM[1];
            const hs = [];
            const hr = /-H\s+['"]([^'"]+)['"]/g;
            let hm;
            while ((hm = hr.exec(rest))) {
              const i = hm[1].indexOf(':');
              if (i > 0) hs.push({ key: hm[1].slice(0, i).trim(), value: hm[1].slice(i + 1).trim() });
            }
            if (hs.length) headers.setRows(hs);
            const dr = /(?:--data-raw|--data|-d)\s+['"]([\s\S]*?)['"](?:\s|$)/.exec(rest);
            if (dr) {
              body.value = dr[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
              bodyType.value = /^\s*[\[{]/.test(body.value) ? 'json' : 'text';
            }
            const authH = hs.find((x) => /^authorization$/i.test(x.key));
            if (authH && /^Bearer\s+/i.test(authH.value)) { authType.value = 'bearer'; $('#hAuthToken', root).value = authH.value.replace(/^Bearer\s+/i, ''); }
            toggleAuth(); updateFinal();
            toast('cURL импортирован', 'ok');
          } catch (e) { toast('Не удалось разобрать cURL: ' + e.message, 'err'); }
        };

        $('#hSaveResp', root).onclick = () => {
          const ct = String((lastMeta && lastMeta.headers || {})['content-type'] || '').toLowerCase();
          if (ct.startsWith('image/') && responseBytes.length) {
            const total = responseBytes.reduce((n, b) => n + b.length, 0);
            const all = new Uint8Array(total); let off = 0;
            responseBytes.forEach((b) => { all.set(b, off); off += b.length; });
            const ext = ct.includes('png') ? 'png' : ct.includes('jpeg') ? 'jpg' : ct.includes('svg') ? 'svg' : 'img';
            D.saveBase64('response.' + ext, ct.split(';')[0], D.bytesToB64(all));
          } else {
            saveText('response.txt', $('#hRespBody', root).textContent || '');
          }
        };

        updateFinal();
        renderHistory();
        renderSaved();
      }
    }
  ]);
})();
