/* DevSuite Pro — generators part 1 */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, saveText, saveBase64 } = D;

  D.registerTools([
    {
      id: 'base64', name: 'Base64', icon: '64', cat: 'code', badge: 'core',
      desc: 'Кодирование текста и файлов в Base64 и обратно, data URI',
      render(root) {
        root.innerHTML = `
          <div data-tabgroup="b64">
            <div class="tabs">
              <button class="tab is-active" data-tab="text">Текст</button>
              <button class="tab" data-tab="file">Файлы</button>
            </div>
            <div class="tab-pane is-active" data-pane="text">
              <div class="split">
                <div><div class="out-label"><span class="label">Исходный текст</span></div>
                  <textarea id="bTIn" class="mono" style="min-height:300px" spellcheck="false">Привет, DevSuite! 👋</textarea></div>
                <div><div class="out-label"><span class="label">Base64</span><span class="hint" id="bTStat"></span></div>
                  <textarea id="bTOut" class="mono" style="min-height:300px" spellcheck="false"></textarea></div>
              </div>
              <div class="toolbar mt">
                <button class="btn btn-primary" id="bTEnc">Encode →</button>
                <button class="btn" id="bTDec">← Decode</button>
                <label class="check"><input type="checkbox" id="bTUrl"> URL-safe (-_)</label>
                <label class="check"><input type="checkbox" id="bTRaw"> убрать padding (=)</label>
                <span class="spacer"></span>
                <button class="btn" data-copy-target="#bTOut">Копировать</button>
                <button class="btn btn-ghost" id="bTSwap">⇄</button>
                <span class="hint" id="bTMsg"></span>
              </div>
            </div>
            <div class="tab-pane" data-pane="file">
              <div class="split">
                <div>
                  <div class="drop-zone" id="bDrop">Нажмите, чтобы выбрать файл<br><span class="small">любой тип · кодирование происходит локально</span></div>
                  <input type="file" id="bFile" hidden>
                  <div class="hint mt-sm" id="bFileInfo">Файл не выбран</div>
                  <label class="check mt"><input type="checkbox" id="bDataUri" checked> добавить data URI префикс</label>
                  <div class="toolbar mt">
                    <button class="btn btn-primary" id="bFileEnc">Кодировать файл</button>
                    <button class="btn" id="bFileDl">Скачать Base64 .txt</button>
                  </div>
                  <div class="field mt"><span>Base64 для декодирования</span>
                    <textarea id="bFileIn" class="mono" style="min-height:150px" spellcheck="false" placeholder="Вставьте Base64 или data:image/png;base64,..."></textarea>
                  </div>
                  <div class="form-grid mt-sm">
                    <div class="field"><span>Имя файла</span><input id="bFileName" value="decoded.bin"></div>
                    <div class="field"><span>MIME</span><input id="bFileMime" value="application/octet-stream"></div>
                  </div>
                  <div class="toolbar mt-sm"><button class="btn btn-primary" id="bFileDec">Декодировать в файл</button><span class="hint" id="bFileMsg"></span></div>
                  <div class="mt" id="bPreview"></div>
                </div>
                <div>
                  <div class="out-label"><span class="label">Base64 результата</span><span class="hint" id="bB64Stat"></span></div>
                  <textarea id="bB64Out" class="mono" style="min-height:320px" spellcheck="false" placeholder="Здесь появится Base64..."></textarea>
                  <div class="toolbar mt-sm"><button class="btn btn-sm" data-copy-target="#bB64Out">Копировать</button></div>
                </div>
              </div>
            </div>
          </div>`;
        const tIn = $('#bTIn', root), tOut = $('#bTOut', root), tStat = $('#bTStat', root), tMsg = $('#bTMsg', root);
        function prep(b64) {
          if ($('#bTUrl', root).checked) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_');
          if ($('#bTRaw', root).checked) b64 = b64.replace(/=+$/, '');
          return b64;
        }
        $('#bTEnc', root).onclick = () => {
          tOut.value = prep(D.base64EncodeText(tIn.value));
          tStat.textContent = `${D.utf8(tIn.value).length} байт → ${tOut.value.length} символов`;
          tMsg.innerHTML = '<span class="ok-text">✓</span>';
        };
        $('#bTDec', root).onclick = () => {
          try {
            let s = tOut.value.trim().replace(/-/g, '+').replace(/_/g, '/');
            while (s.length % 4) s += '=';
            tIn.value = D.base64DecodeText(s);
            tStat.textContent = `${tIn.value.length} символов`;
            tMsg.innerHTML = '<span class="ok-text">✓</span>';
          } catch (e) { tMsg.innerHTML = `<span class="error-text">✕ неверный Base64</span>`; }
        };
        $('#bTSwap', root).onclick = () => { const t = tIn.value; tIn.value = tOut.value; tOut.value = t; };

        let currentFile = null;
        const fileInput = $('#bFile', root);
        $('#bDrop', root).onclick = () => fileInput.click();
        $('#bDrop', root).ondragover = (e) => { e.preventDefault(); $('#bDrop', root).classList.add('drag'); };
        $('#bDrop', root).ondragleave = () => $('#bDrop', root).classList.remove('drag');
        $('#bDrop', root).ondrop = (e) => { e.preventDefault(); $('#bDrop', root).classList.remove('drag'); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); };
        fileInput.addEventListener('change', () => { if (fileInput.files[0]) handleFile(fileInput.files[0]); fileInput.value = ''; });

        async function handleFile(f) {
          currentFile = f;
          $('#bFileInfo', root).innerHTML = `<b>${esc(f.name)}</b> · ${D.fmtBytes(f.size)} · ${esc(f.type || 'unknown')}`;
          $('#bFileName', root).value = f.name;
          $('#bFileMime', root).value = f.type || 'application/octet-stream';
          try {
            const buf = new Uint8Array(await D.readFile(f, 'arrayBuffer'));
            const b64 = D.bytesToB64(buf);
            $('#bB64Out', root).value = $('#bDataUri', root).checked ? `data:${f.type || 'application/octet-stream'};base64,${b64}` : b64;
            $('#bB64Stat', root).textContent = `${D.fmtBytes(f.size)} → ${D.fmtBytes(b64.length)} base64`;
            if (/^image\//.test(f.type)) {
              const url = URL.createObjectURL(f);
              $('#bPreview', root).innerHTML = `<img src="${url}" style="max-width:100%;max-height:220px;border-radius:10px;border:1px solid var(--border)">`;
            } else $('#bPreview', root).innerHTML = '';
            toast('Файл закодирован', 'ok');
          } catch (e) { toast('Ошибка чтения файла', 'err'); }
        }
        $('#bFileEnc', root).onclick = () => { if (!currentFile) { toast('Сначала выберите файл', 'err'); return; } handleFile(currentFile); };
        $('#bFileDl', root).onclick = () => { if ($('#bB64Out', root).value) saveText('file.base64.txt', $('#bB64Out', root).value); };
        $('#bFileDec', root).onclick = () => {
          let s = $('#bFileIn', root).value.trim();
          let mime = $('#bFileMime', root).value || 'application/octet-stream';
          let name = $('#bFileName', root).value || 'decoded.bin';
          const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(s);
          if (m) { if (m[1]) mime = m[1]; s = m[3]; name = name === 'decoded.bin' ? (mime.split('/')[1] ? 'decoded.' + mime.split('/')[1].replace('+xml', '') : 'decoded.bin') : name; }
          try {
            s = s.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
            while (s.length % 4) s += '=';
            D.b64ToBytes(s);
            saveBase64(name, mime, s);
            $('#bFileMsg', root).innerHTML = '<span class="ok-text">✓ декодировано</span>';
          } catch (e) { $('#bFileMsg', root).innerHTML = '<span class="error-text">✕ неверный Base64</span>'; }
        };
        $('#bTEnc', root).click();
      }
    },

    {
      id: 'url', name: 'URL Codec & Parser', icon: '⌁', cat: 'code',
      desc: 'encode/decode URL, разбор компонентов и query-параметров',
      render(root) {
        root.innerHTML = `
          <div data-tabgroup="url">
            <div class="tabs">
              <button class="tab is-active" data-tab="codec">Кодек</button>
              <button class="tab" data-tab="parser">Парсер URL</button>
            </div>
            <div class="tab-pane is-active" data-pane="codec">
              <div class="split">
                <div><div class="out-label"><span class="label">Текст / URL</span></div>
                  <textarea id="uIn" class="mono" style="min-height:260px" spellcheck="false">https://example.com/поиск?q=привет мир&lang=ru</textarea></div>
                <div><div class="out-label"><span class="label">Результат</span><span class="hint" id="uStat"></span></div>
                  <textarea id="uOut" class="mono" style="min-height:260px" spellcheck="false"></textarea></div>
              </div>
              <div class="toolbar mt">
                <button class="btn btn-primary" id="uEnc">Component Encode</button>
                <button class="btn" id="uDec">Component Decode</button>
                <button class="btn" id="uEncFull">Encode URI</button>
                <button class="btn" id="uDecFull">Decode URI</button>
                <span class="spacer"></span>
                <button class="btn" data-copy-target="#uOut">Копировать</button>
              </div>
            </div>
            <div class="tab-pane" data-pane="parser">
              <div class="field mb"><span>URL</span><input id="urlIn" class="mono" value="https://user:pass@api.example.com:8443/v1/chat?model=deepseek&stream=true&q=hello%20world#section"></div>
              <div class="grid-2">
                <div class="panel-soft">
                  <div class="panel-title">Компоненты</div>
                  <table class="kv-table" id="urlParts"></table>
                </div>
                <div class="panel-soft">
                  <div class="panel-title">Query параметры <span class="hint" id="urlQCount"></span></div>
                  <div id="urlQuery" class="hint">Нет параметров</div>
                </div>
              </div>
              <div class="hint mt-sm" id="urlMsg">Значения query декодируются автоматически. Изменение URL обновляет разбор.</div>
            </div>
          </div>`;
        const input = $('#uIn', root), out = $('#uOut', root), stat = $('#uStat', root);
        $('#uEnc', root).onclick = () => { out.value = encodeURIComponent(input.value); stat.textContent = out.value.length + ' символов'; };
        $('#uDec', root).onclick = () => { try { out.value = decodeURIComponent(input.value); stat.textContent = out.value.length + ' символов'; } catch (e) { toast('Ошибка декодирования: ' + e.message, 'err'); } };
        $('#uEncFull', root).onclick = () => { out.value = encodeURI(input.value); stat.textContent = out.value.length + ' символов'; };
        $('#uDecFull', root).onclick = () => { try { out.value = decodeURI(input.value); stat.textContent = out.value.length + ' символов'; } catch (e) { toast('Ошибка декодирования: ' + e.message, 'err'); } };

        const urlIn = $('#urlIn', root), parts = $('#urlParts', root), query = $('#urlQuery', root), qcount = $('#urlQCount', root), msg = $('#urlMsg', root);
        function parseUrl() {
          let raw = urlIn.value.trim();
          if (!raw) { parts.innerHTML = ''; query.innerHTML = '<div class="hint">Нет данных</div>'; return; }
          if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = 'https://' + raw;
          try {
            const u = new URL(raw);
            const rows = [
              ['protocol', u.protocol], ['username', u.username], ['password', u.password], ['hostname', u.hostname],
              ['port', u.port || '(по умолчанию)'], ['host', u.host], ['origin', u.origin], ['pathname', u.pathname],
              ['search', u.search], ['hash', u.hash]
            ];
            parts.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td class="mono">${esc(v) || '<span class="muted">—</span>'}</td></tr>`).join('');
            const params = Array.from(u.searchParams.entries());
            qcount.textContent = `(${params.length})`;
            query.innerHTML = params.length ? `<table class="kv-table">${params.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="mono">${esc(v)}</td></tr>`).join('')}</table>` : '<div class="hint">Нет параметров</div>';
            msg.innerHTML = '<span class="ok-text">✓ URL корректен</span>';
          } catch (e) {
            parts.innerHTML = '';
            query.innerHTML = '';
            msg.innerHTML = `<span class="error-text">✕ ${esc(e.message)}</span>`;
          }
        }
        urlIn.addEventListener('input', D.debounce(parseUrl, 250));
        parseUrl();
      }
    },

    {
      id: 'hash', name: 'Hash & HMAC', icon: '#', cat: 'code', badge: 'core',
      desc: 'MD5, SHA-1/256/384/512, HMAC и хеши файлов — всё локально',
      render(root) {
        root.innerHTML = `
          <div class="field mb"><span>Текст</span>
            <textarea id="hIn" class="mono" style="min-height:120px" spellcheck="false">DevSuite Pro</textarea>
          </div>
          <div class="row mb">
            <label class="check"><input type="checkbox" id="hUpper"> UPPER CASE</label>
            <div class="field" style="width:150px"><span>HMAC алгоритм</span>
              <select id="hAlgo"><option>SHA-256</option><option>SHA-1</option><option>SHA-384</option><option>SHA-512</option></select>
            </div>
            <div class="field" style="flex:1;min-width:200px"><span>HMAC секрет</span><input id="hKey" class="mono" placeholder="secret key"></div>
            <button class="btn" id="hCalc" style="margin-top:15px">Пересчитать</button>
          </div>
          <div id="hOut" class="list mb"></div>
          <div class="grid-2">
            <div class="panel-soft">
              <div class="panel-title">Проверить хеш</div>
              <div class="field"><span>Ожидаемый хеш</span><input id="hExpected" class="mono" placeholder="вставьте хеш для сравнения"></div>
              <div class="hint mt-sm" id="hCompare">Сравнение выполняется по всем алгоритмам.</div>
            </div>
            <div class="panel-soft">
              <div class="panel-title">Хеш файла</div>
              <input type="file" id="hFile" class="small">
              <div class="hint mt-sm" id="hFileInfo">Выберите файл — хеши считаются локально.</div>
              <div id="hFileOut" class="list mt-sm"></div>
            </div>
          </div>`;
        const input = $('#hIn', root), out = $('#hOut', root);
        const algos = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
        async function calc() {
          const text = input.value;
          const upper = $('#hUpper', root).checked;
          const results = [];
          for (const a of algos) {
            try { results.push({ a, v: await D.hashText(a, text) }); }
            catch (e) { results.push({ a, v: 'ошибка: ' + e.message }); }
          }
          const key = $('#hKey', root).value;
          let hmacVal = '';
          if (key) {
            try { hmacVal = await D.hmac($('#hAlgo', root).value, key, text); } catch (_) {}
          }
          out.innerHTML = results.map((r, i) => `
            <div class="list-item">
              <span class="chip" style="min-width:76px;justify-content:center">${r.a}</span>
              <span class="mono grow" style="word-break:break-all;font-size:11.5px" id="hv-${i}">${esc(upper ? r.v.toUpperCase() : r.v)}</span>
              <span class="hint">${typeof r.v === 'string' && r.v.length === 128 ? '512' : typeof r.v === 'string' && r.v.length === 96 ? '384' : typeof r.v === 'string' && r.v.length === 64 ? '256' : typeof r.v === 'string' && r.v.length === 40 ? '160' : '128'} bit</span>
              <button class="btn btn-sm" data-hcopy="${i}">⧉</button>
            </div>`).join('') + (key ? `
            <div class="list-item" style="border-color:rgba(124,92,255,.3)">
              <span class="chip accent" style="min-width:76px;justify-content:center">HMAC</span>
              <span class="mono grow" style="word-break:break-all;font-size:11.5px" id="hmacVal">${esc(upper ? hmacVal.toUpperCase() : hmacVal)}</span>
              <span class="hint">${esc($('#hAlgo', root).value)}</span>
              <button class="btn btn-sm" id="hmacCopy">⧉</button>
            </div>` : '');
          out.querySelectorAll('[data-hcopy]').forEach((b) => { b.onclick = () => copy($('#hv-' + b.dataset.hcopy, out).textContent); });
          if (key) $('#hmacCopy', root).onclick = () => copy($('#hmacVal', root).textContent);
          compare(results);
        }
        function compare(results) {
          const expected = $('#hExpected', root).value.trim().replace(/^0x/i, '').toLowerCase();
          const el = $('#hCompare', root);
          if (!expected) { el.textContent = 'Сравнение выполняется по всем алгоритмам.'; el.className = 'hint mt-sm'; return; }
          const hit = results.find((r) => r.v.toLowerCase() === expected);
          if (hit) { el.innerHTML = `<span class="ok-text">✓ Совпадение: ${esc(hit.a)}</span>`; }
          else { el.innerHTML = '<span class="error-text">✕ Совпадений нет</span>'; }
        }
        input.addEventListener('input', D.debounce(calc, 300));
        $('#hKey', root).addEventListener('input', D.debounce(calc, 300));
        $('#hAlgo', root).onchange = calc;
        $('#hUpper', root).onchange = calc;
        $('#hExpected', root).addEventListener('input', () => { const vals = Array.from(out.querySelectorAll('[id^="hv-"]')).map((el, i) => ({ a: algos[i], v: el.textContent })); compare(vals); });
        $('#hCalc', root).onclick = calc;

        $('#hFile', root).addEventListener('change', async () => {
          const f = $('#hFile', root).files[0];
          if (!f) return;
          $('#hFileInfo').innerHTML = `<b>${esc(f.name)}</b> · ${D.fmtBytes(f.size)}`;
          try {
            const bytes = new Uint8Array(await D.readFile(f, 'arrayBuffer'));
            const res = [];
            for (const a of algos) res.push({ a, v: D.bytesToHex(await D.digest(a, bytes)) });
            $('#hFileOut').innerHTML = res.map((r, i) => `<div class="list-item"><span class="chip" style="min-width:66px;justify-content:center">${r.a}</span><span class="mono grow" style="word-break:break-all;font-size:10.5px">${esc(r.v)}</span><button class="btn btn-sm" data-fcopy="${i}">⧉</button></div>`).join('');
            $('#hFileOut').querySelectorAll('[data-fcopy]').forEach((b) => { b.onclick = () => copy(res[b.dataset.fcopy].v); });
          } catch (e) { $('#hFileInfo').innerHTML = `<span class="error-text">${esc(e.message)}</span>`; }
        });
        calc();
      }
    },

    {
      id: 'aes', name: 'AES Encrypt', icon: '⚿', cat: 'code',
      desc: 'AES-256-GCM шифрование текста паролем (PBKDF2, 150k итераций)',
      render(root) {
        root.innerHTML = `
          <div data-tabgroup="aes">
            <div class="tabs">
              <button class="tab is-active" data-tab="enc">Шифровать</button>
              <button class="tab" data-tab="dec">Расшифровать</button>
            </div>
            <div class="tab-pane is-active" data-pane="enc">
              <div class="split">
                <div>
                  <div class="field"><span>Открытый текст</span><textarea id="aeText" class="mono" style="min-height:220px" spellcheck="false">Секретное сообщение</textarea></div>
                  <div class="field mt"><span>Пароль</span><input id="aePass" class="mono" type="password" placeholder="надёжный пароль"></div>
                  <div class="toolbar mt"><button class="btn btn-primary" id="aeGo">Зашифровать</button><button class="btn" id="aeGen">Сгенерировать пароль</button><span class="hint" id="aeMsg"></span></div>
                </div>
                <div>
                  <div class="out-label"><span class="label">Шифротекст (формат DS1)</span></div>
                  <textarea id="aeOut" class="mono" style="min-height:260px" spellcheck="false" placeholder="Результат..."></textarea>
                  <div class="toolbar mt-sm"><button class="btn btn-sm" data-copy-target="#aeOut">Копировать</button><button class="btn btn-sm" id="aeSave">Скачать .txt</button></div>
                </div>
              </div>
            </div>
            <div class="tab-pane" data-pane="dec">
              <div class="split">
                <div>
                  <div class="field"><span>Шифротекст</span><textarea id="adText" class="mono" style="min-height:220px" spellcheck="false" placeholder="DS1...."></textarea></div>
                  <div class="field mt"><span>Пароль</span><input id="adPass" class="mono" type="password"></div>
                  <div class="toolbar mt"><button class="btn btn-primary" id="adGo">Расшифровать</button><span class="hint" id="adMsg"></span></div>
                </div>
                <div>
                  <div class="out-label"><span class="label">Открытый текст</span></div>
                  <textarea id="adOut" class="mono" style="min-height:260px" spellcheck="false"></textarea>
                  <div class="toolbar mt-sm"><button class="btn btn-sm" data-copy-target="#adOut">Копировать</button></div>
                </div>
              </div>
            </div>
          </div>
          <div class="panel-soft mt">
            <div class="hint">Формат: <b>DS1.</b> + Base64(salt 16 B + IV 12 B + AES-GCM ciphertext). Ключ выводится PBKDF2-SHA256, 150 000 итераций. Без пароля восстановить текст невозможно. Не используйте один пароль для критичных данных без дополнительной защиты.</div>
          </div>`;
        const gen = () => D.password({ length: 28 }).value;
        $('#aeGen', root).onclick = () => { $('#aePass', root).value = gen(); $('#aePass', root).type = 'text'; };
        $('#aeGo', root).onclick = async () => {
          if (!$('#aePass', root).value) { $('#aeMsg', root).innerHTML = '<span class="error-text">Введите пароль</span>'; return; }
          try {
            $('#aeMsg', root).textContent = 'Шифрование…';
            $('#aeOut', root).value = await D.aesEncrypt($('#aeText', root).value, $('#aePass', root).value);
            $('#aeMsg', root).innerHTML = '<span class="ok-text">✓ зашифровано</span>';
          } catch (e) { $('#aeMsg', root).innerHTML = `<span class="error-text">${esc(e.message)}</span>`; }
        };
        $('#aeSave', root).onclick = () => { if ($('#aeOut', root).value) saveText('secret.ds1.txt', $('#aeOut', root).value); };
        $('#adGo', root).onclick = async () => {
          try {
            $('#adMsg', root).textContent = 'Расшифровка…';
            $('#adOut', root).value = await D.aesDecrypt($('#adText', root).value, $('#adPass', root).value);
            $('#adMsg', root).innerHTML = '<span class="ok-text">✓ расшифровано</span>';
          } catch (e) { $('#adMsg', root).innerHTML = '<span class="error-text">✕ неверный пароль или повреждённые данные</span>'; }
        };
      }
    },

    {
      id: 'uuid', name: 'UUID Generator', icon: 'ID', cat: 'gen', badge: 'core',
      desc: 'UUID v4/v7, ULID и NanoID пакетно, с валидатором',
      render(root) {
        root.innerHTML = `
          <div class="form-grid mb">
            <div class="field"><span>Тип</span>
              <select id="idType"><option value="v4">UUID v4</option><option value="v7">UUID v7 (время)</option><option value="ulid">ULID</option><option value="nano">NanoID</option></select>
            </div>
            <div class="field"><span>Количество</span><input id="idCount" type="number" min="1" max="500" value="5"></div>
            <div class="field" id="idLenWrap" style="display:none"><span>Длина NanoID</span><input id="idLen" type="number" min="4" max="64" value="21"></div>
            <div class="field"><span>Регистр</span><select id="idCase"><option value="lower">нижний</option><option value="upper">ВЕРХНИЙ</option></select></div>
          </div>
          <div class="toolbar mb">
            <button class="btn btn-primary" id="idGo">Сгенерировать</button>
            <button class="btn" data-copy-target="#idOut">Копировать все</button>
            <button class="btn" id="idSave">Скачать .txt</button>
            <span class="spacer"></span>
            <span class="hint" id="idStat"></span>
          </div>
          <div class="code" id="idOut" style="min-height:220px"></div>
          <div class="panel-soft mt">
            <div class="panel-title">Валидатор UUID</div>
            <div class="row">
              <input id="idCheck" class="mono" style="max-width:420px" placeholder="550e8400-e29b-41d4-a716-446655440000">
              <button class="btn" id="idValidate">Проверить</button>
              <span id="idCheckMsg" class="hint"></span>
            </div>
          </div>`;
        const out = $('#idOut', root), stat = $('#idStat', root);
        function generate() {
          const type = $('#idType', root).value;
          const count = Math.max(1, Math.min(500, Number($('#idCount', root).value) || 1));
          const upper = $('#idCase', root).value === 'upper';
          const len = Math.max(4, Math.min(64, Number($('#idLen', root).value) || 21));
          const list = [];
          for (let i = 0; i < count; i++) {
            let v;
            if (type === 'v4') v = D.uuidV4();
            else if (type === 'v7') v = D.uuidV7();
            else if (type === 'ulid') v = D.ulid();
            else v = D.nanoid(len);
            list.push(upper ? v.toUpperCase() : v);
          }
          out.textContent = list.join('\n');
          stat.textContent = `${count} шт · ${type.toUpperCase()}`;
        }
        $('#idType', root).onchange = () => { $('#idLenWrap', root).style.display = $('#idType', root).value === 'nano' ? '' : 'none'; generate(); };
        $('#idGo', root).onclick = generate;
        $('#idCount', root).onchange = generate;
        $('#idCase', root).onchange = generate;
        $('#idLen', root).onchange = generate;
        $('#idSave', root).onclick = () => { if (out.textContent) saveText('ids.txt', out.textContent); };
        $('#idValidate', root).onclick = () => {
          const v = $('#idCheck', root).value.trim();
          const el = $('#idCheckMsg', root);
          const m = /^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/i.exec(v);
          if (!m) { el.innerHTML = '<span class="error-text">✕ не UUID</span>'; return; }
          if (/^[0-9a-f]{32}$/i.test(v.replace(/-/g, ''))) {
            const ver = m[3][0].toLowerCase();
            const variant = '89ab'.includes(m[4][0].toLowerCase()) ? 'RFC 4122/9562' : 'нестандартный';
            el.innerHTML = `<span class="chip ok">✓ UUID v${ver}</span> <span class="chip">variant: ${variant}</span>`;
          }
        };
        generate();
      }
    }
  ]);
})();
