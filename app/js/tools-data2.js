/* DevSuite Pro — CSV & JWT */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, saveText } = D;

  function parseCSV(text, delim) {
    const rows = [];
    let row = [], field = '', quoted = false;
    const d = delim || ',';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += c;
      } else if (c === '"') quoted = true;
      else if (c === d) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') continue;
      else field += c;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => !(r.length === 1 && r[0] === ''));
  }

  function toCSV(rows, delim) {
    const d = delim || ',';
    return rows.map((r) => r.map((v) => {
      const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return /["\n\r]|,|;|\t|\|/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(d)).join('\r\n');
  }

  function b64json(part, label) {
    if (!part) return {};
    try { return JSON.parse(D.b64urlText(part)); }
    catch (e) { throw new Error(`Не удалось разобрать ${label}: ${e.message}`); }
  }

  D.registerTools([
    {
      id: 'csv', name: 'CSV ↔ JSON', icon: '▦', cat: 'data',
      desc: 'Конвертация таблиц CSV и JSON с кавычками, разделителями и заголовками',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="cToJ">CSV → JSON</button>
            <button class="btn" id="cToC">JSON → CSV</button>
            <div class="field" style="width:130px"><span>Разделитель</span>
              <select id="cDelim"><option value=",">Запятая ,</option><option value=";">Точка с запятой ;</option><option value="\t">Табуляция</option><option value="|">Вертикальная |</option></select>
            </div>
            <label class="check" style="margin-top:15px"><input type="checkbox" id="cHeader" checked> Первая строка — заголовки</label>
            <span class="spacer"></span>
            <button class="btn btn-ghost" id="cSample">Пример</button>
          </div>
          <div class="split">
            <div>
              <div class="out-label"><span class="label">CSV</span><span class="hint" id="cStat">—</span></div>
              <textarea id="cCsv" class="mono" style="min-height:420px" spellcheck="false" placeholder="id,name,role&#10;1,Алиса,admin&#10;2,Боб,user"></textarea>
            </div>
            <div>
              <div class="out-label"><span class="label">JSON</span><span class="hint">массив объектов</span></div>
              <textarea id="cJson" class="mono" style="min-height:420px" spellcheck="false" placeholder='[{"id":1,"name":"Алиса","role":"admin"}]'></textarea>
            </div>
          </div>
          <div class="toolbar mt-sm">
            <button class="btn btn-sm" data-copy-target="#cCsv">Копировать CSV</button>
            <button class="btn btn-sm" data-copy-target="#cJson">Копировать JSON</button>
            <button class="btn btn-sm" id="cSaveCsv">Скачать .csv</button>
            <button class="btn btn-sm" id="cSaveJson">Скачать .json</button>
            <span class="hint" id="cMsg"></span>
          </div>`;
        const csv = $('#cCsv', root), json = $('#cJson', root), msg = $('#cMsg', root), stat = $('#cStat', root);
        const delim = () => $('#cDelim', root).value;

        function csvToJson() {
          const rows = parseCSV(csv.value, delim());
          if (!rows.length) { msg.innerHTML = '<span class="error-text">CSV пуст</span>'; return; }
          let data;
          if ($('#cHeader', root).checked) {
            const head = rows[0].map((h, i) => h.trim() || 'col' + (i + 1));
            data = rows.slice(1).map((r) => { const o = {}; head.forEach((h, i) => { o[h] = r[i] !== undefined ? r[i] : ''; }); return o; });
          } else data = rows;
          json.value = JSON.stringify(data, null, 2);
          stat.textContent = `${rows.length} строк · ${rows[0].length} колонок`;
          msg.innerHTML = '<span class="ok-text">✓ Готово</span>';
          toast('CSV → JSON', 'ok');
        }
        function jsonToCsv() {
          let data;
          try { data = JSON.parse(json.value); } catch (e) { msg.innerHTML = `<span class="error-text">JSON: ${esc(e.message)}</span>`; return; }
          if (!Array.isArray(data)) { msg.innerHTML = '<span class="error-text">Нужен массив JSON</span>'; return; }
          let rows = [];
          if (data.every((x) => x && typeof x === 'object' && !Array.isArray(x))) {
            const keys = [];
            data.forEach((o) => Object.keys(o).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));
            rows.push(keys);
            data.forEach((o) => rows.push(keys.map((k) => o[k] !== undefined ? o[k] : '')));
          } else {
            data.forEach((x) => rows.push(Array.isArray(x) ? x : [x]));
          }
          csv.value = toCSV(rows, delim());
          stat.textContent = `${rows.length} строк`;
          msg.innerHTML = '<span class="ok-text">✓ Готово</span>';
          toast('JSON → CSV', 'ok');
        }
        $('#cToJ', root).onclick = csvToJson;
        $('#cToC', root).onclick = jsonToCsv;
        $('#cSaveCsv', root).onclick = () => { if (csv.value) saveText('table.csv', csv.value, 'text/csv'); };
        $('#cSaveJson', root).onclick = () => { if (json.value) saveText('table.json', json.value, 'application/json'); };
        $('#cSample', root).onclick = () => {
          csv.value = 'id,name,email,role,active\n1,Алиса,alice@example.com,admin,true\n2,Боб,bob@example.com,user,true\n3,"Иван, Jr.",ivan@example.com,user,false';
          csvToJson();
        };
      }
    },

    {
      id: 'jwt', name: 'JWT Decoder', icon: '◈', cat: 'data', badge: 'core',
      desc: 'Разбор заголовка и payload, проверка срока и подписи HS256/384/512',
      render(root) {
        root.innerHTML = `
          <div class="mb">
            <div class="field">
              <span>JWT токен</span>
              <textarea id="tToken" class="mono" style="min-height:110px" spellcheck="false" placeholder="eyJhbGciOiJIUzI1NiIs..."></textarea>
            </div>
          </div>
          <div class="toolbar mb">
            <button class="btn btn-primary" id="tDecode">Разобрать</button>
            <div class="field" style="min-width:220px"><span>Секрет для проверки HS*</span><input id="tSecret" class="mono" type="text" placeholder="your-256-bit-secret"></div>
            <label class="check" style="margin-top:15px"><input type="checkbox" id="tShowSecret"> показать</label>
            <button class="btn" id="tVerify">Проверить подпись</button>
            <span class="spacer"></span>
            <button class="btn btn-ghost" id="tSample">Пример</button>
          </div>
          <div id="tStatus" class="mb"></div>
          <div class="split">
            <div data-tabgroup="jwt">
              <div class="tabs">
                <button class="tab is-active" data-tab="h">Header</button>
                <button class="tab" data-tab="p">Payload</button>
                <button class="tab" data-tab="c">Claims</button>
                <button class="tab" data-tab="r">Raw</button>
              </div>
              <div class="tab-pane is-active" data-pane="h"><div class="code" id="tHeader"></div></div>
              <div class="tab-pane" data-pane="p"><div class="code" id="tPayload"></div></div>
              <div class="tab-pane" data-pane="c"><div id="tClaims" class="hint">Разберите токен</div></div>
              <div class="tab-pane" data-pane="r"><div class="code" id="tRaw"></div></div>
            </div>
            <div class="panel-soft">
              <div class="panel-title">Статус токена</div>
              <div id="tInfo" class="stack">
                <div class="hint">Вставьте JWT и нажмите «Разобрать». Токен не отправляется в сеть.</div>
              </div>
            </div>
          </div>`;
        const token = $('#tToken', root), info = $('#tInfo', root), status = $('#tStatus', root);
        let parts = null;

        function decode() {
          const text = token.value.trim().replace(/^Bearer\s+/i, '');
          parts = text.split('.');
          if (parts.length < 2) { status.innerHTML = '<span class="chip err">Неверный формат JWT</span>'; return; }
          try {
            const header = b64json(parts[0], 'header');
            const payload = b64json(parts[1], 'payload');
            $('#tHeader', root).textContent = JSON.stringify(header, null, 2);
            $('#tPayload', root).textContent = JSON.stringify(payload, null, 2);
            $('#tRaw', root).textContent = text;
            const rows = [];
            const labels = { iss: 'Издатель', sub: 'Субъект', aud: 'Аудитория', exp: 'Истекает', nbf: 'Действует с', iat: 'Выдан', jti: 'ID токена' };
            Object.keys(payload).forEach((k) => {
              let v = payload[k];
              let extra = '';
              if (['exp', 'nbf', 'iat'].includes(k) && typeof v === 'number') extra = ` · ${D.fmtDate(v * 1000)}`;
              rows.push(`<tr><td>${esc(labels[k] || k)}</td><td>${esc(JSON.stringify(v))}${esc(extra)}</td></tr>`);
            });
            $('#tClaims', root).innerHTML = rows.length ? `<table class="kv-table">${rows.join('')}</table>` : '<div class="hint">Payload пуст</div>';

            let chips = `<span class="chip">alg: ${esc(header.alg || '—')}</span><span class="chip">typ: ${esc(header.typ || 'JWT')}</span>`;
            if (typeof payload.exp === 'number') {
              const left = payload.exp * 1000 - Date.now();
              chips += left > 0 ? `<span class="chip ok">истекает через ${formatLeft(left)}</span>` : `<span class="chip err">истёк ${D.timeAgo(payload.exp * 1000)}</span>`;
            } else chips += '<span class="chip warn">нет exp</span>';
            if (typeof payload.nbf === 'number') {
              chips += payload.nbf * 1000 > Date.now() ? '<span class="chip warn">ещё не действует</span>' : '<span class="chip ok">активен</span>';
            }
            status.innerHTML = chips;

            info.innerHTML = `
              <div class="list">
                <div class="list-item"><span class="grow">Алгоритм</span><b class="mono">${esc(header.alg || '—')}</b></div>
                <div class="list-item"><span class="grow">Секций</span><b class="mono">${parts.length}</b></div>
                <div class="list-item"><span class="grow">Размер</span><b class="mono">${D.fmtBytes(text.length)}</b></div>
                <div class="list-item"><span class="grow">Подпись</span><b class="mono" style="max-width:190px;overflow:hidden;text-overflow:ellipsis">${esc(parts[2] ? parts[2].slice(0, 28) : '—')}${parts[2] && parts[2].length > 28 ? '…' : ''}</b></div>
              </div>
              <div class="hint">Проверка подписи возможна только для HS256/384/512. RS/ES требуют публичный ключ — используйте внешнюю библиотеку.</div>`;
          } catch (e) {
            status.innerHTML = `<span class="chip err">${esc(e.message)}</span>`;
          }
        }

        function formatLeft(ms) {
          const s = Math.floor(ms / 1000);
          const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
          return [d ? d + ' дн' : '', h ? h + ' ч' : '', m ? m + ' мин' : ''].filter(Boolean).join(' ') || 'менее минуты';
        }

        $('#tDecode', root).onclick = decode;
        $('#tShowSecret', root).onchange = () => { $('#tSecret', root).type = $('#tShowSecret', root).checked ? 'text' : 'password'; };
        $('#tVerify', root).onclick = async () => {
          if (!parts) decode();
          if (!parts || parts.length < 3) return;
          let header;
          try { header = b64json(parts[0], 'header'); } catch (e) { return; }
          const alg = String(header.alg || '');
          if (!/^HS(256|384|512)$/.test(alg)) {
            info.insertAdjacentHTML('afterbegin', '<div class="chip warn mb">Проверка поддерживается только для HS256/384/512</div>');
            return;
          }
          const map = { HS256: 'SHA-256', HS384: 'SHA-384', HS512: 'SHA-512' };
          try {
            const expected = await D.hmac(map[alg], $('#tSecret', root).value, parts[0] + '.' + parts[1]);
            const actual = D.bytesToHex(D.b64urlDecode(parts[2]));
            const ok = expected === actual;
            status.insertAdjacentHTML('beforeend', ` <span class="chip ${ok ? 'ok' : 'err'}">${ok ? '✓ подпись верна' : '✕ подпись неверна'}</span>`);
          } catch (e) { toast(e.message, 'err'); }
        };
        $('#tSample', root).onclick = () => {
          token.value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5MDAwMDAwMDB9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
          $('#tSecret', root).value = 'your-256-bit-secret';
          decode();
        };
        token.addEventListener('input', D.debounce(decode, 350));
      }
    }
  ]);
})();
