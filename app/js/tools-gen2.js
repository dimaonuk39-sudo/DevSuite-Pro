/* DevSuite Pro — generators part 2 */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, saveText, saveBase64 } = D;

  const FIRST_M = ['Александр', 'Дмитрий', 'Иван', 'Максим', 'Сергей', 'Андрей', 'Михаил', 'Артём', 'Никита', 'Егор', 'Кирилл', 'Роман', 'Павел', 'Владимир', 'Денис'];
  const FIRST_F = ['Анна', 'Мария', 'Алиса', 'Екатерина', 'Ольга', 'Наталья', 'Ирина', 'Дарья', 'София', 'Полина', 'Ксения', 'Вера', 'Алина', 'Юлия', 'Татьяна'];
  const LAST = ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Михайлов', 'Новиков', 'Фёдоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семёнов'];
  const CITIES = ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 'Екатеринбург', 'Нижний Новгород', 'Самара', 'Омск', 'Ростов-на-Дону', 'Уфа', 'Красноярск', 'Воронеж'];
  const STREETS = ['Ленина', 'Мира', 'Гагарина', 'Пушкина', 'Садовая', 'Центральная', 'Советская', 'Лесная', 'Набережная', 'Школьная'];
  const COMPANIES = ['Яндекс', 'ТехноСофт', 'КодМастер', 'ВебЛаб', 'ДатаСфера', 'НейроТек', 'Квант', 'СофтЛайн', 'Пиксель', 'АпиХаб'];
  const WORDS = ['alpha', 'beta', 'delta', 'gamma', 'omega', 'nexus', 'quantum', 'vector', 'matrix', 'pixel', 'cloud', 'byte', 'code', 'data', 'node', 'stack', 'logic', 'core', 'flow', 'sync'];

  function pick(a) { return a[D.randomInt(a.length)]; }
  function digits(n) { let s = ''; for (let i = 0; i < n; i++) s += D.randomInt(10); return s; }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function translitName(s) { return D.slugify(s).replace(/-/g, '.'); }

  function fakeRow() {
    const female = Math.random() < 0.5;
    const first = female ? pick(FIRST_F) : pick(FIRST_M);
    const last = pick(LAST) + (female ? 'а' : '');
    const city = pick(CITIES);
    const year = 1970 + D.randomInt(35), month = 1 + D.randomInt(12), day = 1 + D.randomInt(28);
    return {
      id: D.randomInt(100000),
      name: first + ' ' + last,
      email: translitName(first) + '.' + translitName(last) + '@example.com',
      phone: '+7 9' + digits(2) + ' ' + digits(3) + '-' + digits(2) + '-' + digits(2),
      company: pick(COMPANIES) + ' ' + pick(['LLC', 'Group', 'Labs', 'Systems']),
      city,
      address: 'ул. ' + pick(STREETS) + ', д. ' + (1 + D.randomInt(120)) + ', кв. ' + (1 + D.randomInt(300)),
      username: pick(WORDS) + '_' + digits(3),
      password: D.password({ length: 14 }).value,
      birthday: `${year}-${pad2(month)}-${pad2(day)}`,
      uuid: D.uuidV4(),
      ip: `192.168.${D.randomInt(255)}.${1 + D.randomInt(253)}`,
      created_at: new Date(Date.now() - D.randomInt(365 * 86400000)).toISOString()
    };
  }

  D.registerTools([
    {
      id: 'password', name: 'Password Generator', icon: '✦', cat: 'gen', badge: 'core',
      desc: 'Криптостойкие пароли с энтропией, PIN и пакетная генерация',
      render(root) {
        root.innerHTML = `
          <div class="split">
            <div class="panel-soft">
              <div class="panel-title">Параметры</div>
              <div class="field"><span>Длина: <b id="pwLenVal">20</b></span>
                <input type="range" id="pwLen" min="4" max="64" value="20">
              </div>
              <div class="form-grid mt">
                <label class="check"><input type="checkbox" id="pwLower" checked> a-z</label>
                <label class="check"><input type="checkbox" id="pwUpper" checked> A-Z</label>
                <label class="check"><input type="checkbox" id="pwDigits" checked> 0-9</label>
                <label class="check"><input type="checkbox" id="pwSymbols" checked> !@#$</label>
                <label class="check"><input type="checkbox" id="pwNoAmb"> без похожих (0/O, l/1)</label>
              </div>
              <div class="form-grid mt">
                <div class="field"><span>Количество</span><input id="pwCount" type="number" min="1" max="20" value="5"></div>
              </div>
              <div class="toolbar mt">
                <button class="btn btn-primary" id="pwGo">Сгенерировать</button>
                <button class="btn" id="pwPin">PIN 6</button>
              </div>
            </div>
            <div>
              <div class="out-label"><span class="label">Пароли</span><span class="hint" id="pwEntropy"></span></div>
              <div id="pwOut" class="list" style="max-height:340px;overflow:auto"></div>
              <div class="hint mt-sm">Пароли генерируются криптографически стойким <span class="mono">crypto.getRandomValues</span> и не передаются в сеть.</div>
            </div>
          </div>`;
        const out = $('#pwOut', root), len = $('#pwLen', root);
        function strength(entropy) {
          if (entropy < 40) return ['слабый', 'err'];
          if (entropy < 70) return ['средний', 'warn'];
          if (entropy < 100) return ['сильный', 'ok'];
          return ['очень сильный', 'ok'];
        }
        function generate() {
          const n = Math.max(1, Math.min(20, Number($('#pwCount', root).value) || 1));
          const opts = {
            length: Number(len.value),
            lower: $('#pwLower', root).checked, upper: $('#pwUpper', root).checked,
            digits: $('#pwDigits', root).checked, symbols: $('#pwSymbols', root).checked,
            noAmbiguous: $('#pwNoAmb', root).checked
          };
          let ent = 0;
          const items = [];
          for (let i = 0; i < n; i++) { const p = D.password(opts); ent = p.entropy; items.push(p.value); }
          const [label, cls] = strength(ent);
          $('#pwEntropy', root).innerHTML = `<span class="chip ${cls}">${label} · ${ent} бит</span>`;
          out.innerHTML = items.map((p, i) => `<div class="list-item"><span class="mono grow" style="word-break:break-all;font-size:13px" id="pwv-${i}">${esc(p)}</span><button class="btn btn-sm" data-pw="${i}">⧉</button></div>`).join('');
          out.querySelectorAll('[data-pw]').forEach((b) => { b.onclick = () => copy($('#pwv-' + b.dataset.pw, out).textContent, 'Пароль скопирован'); });
        }
        len.oninput = () => { $('#pwLenVal', root).textContent = len.value; };
        len.onchange = generate;
        ['pwLower', 'pwUpper', 'pwDigits', 'pwSymbols', 'pwNoAmb', 'pwCount'].forEach((id) => { $('#' + id, root).onchange = generate; });
        $('#pwGo', root).onclick = generate;
        $('#pwPin', root).onclick = () => {
          out.innerHTML = Array.from({ length: 5 }, (_, i) => `<div class="list-item"><span class="mono grow">${digits(6)}</span><button class="btn btn-sm" data-pin="${i}">⧉</button></div>`).join('');
          out.querySelectorAll('[data-pin]').forEach((b) => { b.onclick = () => copy(b.previousElementSibling.textContent); });
        };
        generate();
      }
    },

    {
      id: 'qr', name: 'QR Generator', icon: '▣', cat: 'gen', badge: 'core',
      desc: 'QR-код для текста, ссылок, Wi-Fi и любых данных — PNG локально',
      render(root) {
        root.innerHTML = `
          <div class="split">
            <div>
              <div class="field"><span>Содержимое</span>
                <textarea id="qrText" class="mono" style="min-height:180px" spellcheck="false">https://devsuite.pro</textarea>
              </div>
              <div class="form-grid mt">
                <div class="field"><span>Коррекция ошибок</span><select id="qrEcc"><option value="L">L — 7%</option><option value="M" selected>M — 15%</option><option value="Q">Q — 25%</option><option value="H">H — 30%</option></select></div>
                <div class="field"><span>Размер модуля</span><input id="qrCell" type="number" min="2" max="20" value="6"></div>
                <div class="field"><span>Отступ</span><input id="qrMargin" type="number" min="0" max="10" value="3"></div>
              </div>
              <div class="toolbar mt">
                <button class="btn btn-primary" id="qrGo">Сгенерировать</button>
                <button class="btn" id="qrSave">Скачать PNG</button>
                <button class="btn" id="qrWifi">Wi-Fi шаблон</button>
              </div>
              <div class="hint mt-sm" id="qrMsg">Данные не покидают устройство. QR-код строится в браузере.</div>
            </div>
            <div>
              <div class="out-label"><span class="label">Предпросмотр</span><span class="hint" id="qrInfo"></span></div>
              <div class="qr-holder" id="qrHolder"><canvas id="qrCanvas"></canvas></div>
            </div>
          </div>`;
        const text = $('#qrText', root), canvas = $('#qrCanvas', root), msg = $('#qrMsg', root), info = $('#qrInfo', root);
        let lastSize = 0;
        function generate() {
          const data = text.value;
          if (!data) { msg.innerHTML = '<span class="error-text">Введите содержимое</span>'; return; }
          try {
            const ecc = $('#qrEcc', root).value;
            const cell = Math.max(2, Math.min(20, Number($('#qrCell', root).value) || 6));
            const margin = Math.max(0, Math.min(10, Number($('#qrMargin', root).value) || 0));
            const qr = qrcode(0, ecc);
            qr.addData(data);
            qr.make();
            const count = qr.getModuleCount();
            const size = (count + margin * 2) * cell;
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = '#000000';
            for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) {
              if (qr.isDark(r, c)) ctx.fillRect((margin + c) * cell, (margin + r) * cell, cell, cell);
            }
            lastSize = size;
            info.textContent = `${count}×${count} модулей · ${size}px`;
            msg.innerHTML = '<span class="ok-text">✓ Готово</span>';
          } catch (e) { msg.innerHTML = `<span class="error-text">✕ ${esc(e.message)}</span>`; }
        }
        text.addEventListener('input', D.debounce(generate, 250));
        ['qrEcc', 'qrCell', 'qrMargin'].forEach((id) => { $('#' + id, root).onchange = generate; });
        $('#qrGo', root).onclick = generate;
        $('#qrSave', root).onclick = () => {
          if (!lastSize) return;
          const b64 = canvas.toDataURL('image/png').split(',')[1];
          saveBase64('qrcode.png', 'image/png', b64);
        };
        $('#qrWifi', root).onclick = () => {
          text.value = 'WIFI:T:WPA;S:MyNetwork;P:MyPassword;H:false;;';
          generate();
        };
        generate();
      }
    },

    {
      id: 'qrs', name: 'QR Scanner', icon: '◉', cat: 'gen',
      desc: 'Сканирование QR-кодов через камеру устройства',
      render(root) {
        root.innerHTML = `
          <div class="split">
            <div>
              <div class="scan-wrap" id="scanWrap">
                <video id="scanVideo" playsinline muted></video>
                <div class="scan-overlay" id="scanOverlay" style="display:none"></div>
                <div class="empty-state" id="scanPlaceholder">Камера выключена</div>
              </div>
              <div class="toolbar mt">
                <button class="btn btn-primary" id="scanStart">Включить камеру</button>
                <button class="btn" id="scanStop" disabled>Остановить</button>
                <label class="check"><input type="checkbox" id="scanContinuous" checked> непрерывно</label>
                <span class="hint" id="scanMsg"></span>
              </div>
            </div>
            <div>
              <div class="out-label"><span class="label">Результат</span><button class="btn btn-sm" data-copy-target="#scanResult">Копировать</button></div>
              <textarea id="scanResult" class="mono" style="min-height:170px" spellcheck="false" placeholder="QR-код появится здесь..."></textarea>
              <div class="toolbar mt-sm">
                <button class="btn btn-sm" id="scanOpen">Открыть ссылку</button>
                <button class="btn btn-sm" id="scanClear">Очистить</button>
              </div>
              <div class="hint mt-sm">Камера используется только для декодирования кадра на устройстве. Видео никуда не передаётся. В Android разрешение на камеру запрашивается при запуске.</div>
              <div class="panel-soft mt"><div class="panel-title">Журнал</div><div id="scanLog" class="hint">Пусто</div></div>
            </div>
          </div>`;
        const video = $('#scanVideo', root), placeholder = $('#scanPlaceholder', root), overlay = $('#scanOverlay', root), msg = $('#scanMsg', root);
        const result = $('#scanResult', root), log = $('#scanLog', root), startBtn = $('#scanStart', root), stopBtn = $('#scanStop', root);
        let stream = null, timer = null, canvas = document.createElement('canvas'), lastValue = ''; const seen = [];

        async function start() {
          msg.textContent = '';
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            msg.innerHTML = '<span class="error-text">Камера недоступна в этом окружении</span>'; return;
          }
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
            video.srcObject = stream;
            await video.play();
            placeholder.style.display = 'none'; overlay.style.display = '';
            startBtn.disabled = true; stopBtn.disabled = false;
            timer = setInterval(scanFrame, 220);
            msg.innerHTML = '<span class="ok-text">✓ камера активна</span>';
          } catch (e) {
            let text = e.message || String(e);
            if (/Permission|NotAllowed/i.test(text)) text = 'Разрешение на камеру отклонено. Разрешите доступ в настройках устройства.';
            if (/NotFound|Devices/i.test(text)) text = 'Камера не найдена.';
            msg.innerHTML = `<span class="error-text">✕ ${esc(text)}</span>`;
          }
        }
        function stop() {
          if (timer) { clearInterval(timer); timer = null; }
          if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
          video.srcObject = null;
          placeholder.style.display = ''; overlay.style.display = 'none';
          startBtn.disabled = false; stopBtn.disabled = true;
        }
        function scanFrame() {
          if (!video.videoWidth) return;
          const w = Math.min(640, video.videoWidth);
          const h = Math.round(video.videoHeight * w / video.videoWidth);
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, w, h);
          let code = null;
          try { code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' }); } catch (_) {}
          if (code && code.data) {
            result.value = code.data;
            if (code.data !== lastValue) {
              lastValue = code.data;
              seen.unshift({ t: Date.now(), v: code.data });
              log.innerHTML = seen.slice(0, 8).map((s) => `<div class="list-item"><span class="hint" style="flex:0 0 60px">${new Date(s.t).toLocaleTimeString('ru-RU')}</span><span class="mono grow" style="word-break:break-all;font-size:10.5px">${esc(s.v.slice(0, 140))}</span></div>`).join('');
              notify();
            }
            if (!$('#scanContinuous', root).checked) stop();
          }
        }
        function notify() { try { if (navigator.vibrate) navigator.vibrate(60); } catch (_) {} }
        startBtn.onclick = start;
        stopBtn.onclick = stop;
        $('#scanClear', root).onclick = () => { result.value = ''; lastValue = ''; };
        $('#scanOpen', root).onclick = () => {
          const v = result.value.trim();
          if (!v) return;
          if (/^https?:\/\//i.test(v)) { if (window.devsuite) window.devsuite.openExternal(v); else window.open(v, '_blank', 'noopener'); }
          else toast('Это не http(s)-ссылка', 'err');
        };
        window.addEventListener('beforeunload', stop);
      }
    },

    {
      id: 'barcode', name: 'Barcode Generator', icon: '|||', cat: 'gen',
      desc: 'Code128, EAN-13, EAN-8, UPC, Code39 и другие штрихкоды (SVG)',
      render(root) {
        root.innerHTML = `
          <div class="split">
            <div>
              <div class="field"><span>Данные</span><input id="bcText" class="mono" value="DEVSUITE-2026"></div>
              <div class="form-grid mt">
                <div class="field"><span>Формат</span>
                  <select id="bcFormat">
                    <option value="CODE128">CODE128</option><option value="CODE128A">CODE128A</option><option value="CODE128B">CODE128B</option><option value="CODE128C">CODE128C</option>
                    <option value="EAN13">EAN-13</option><option value="EAN8">EAN-8</option><option value="UPC">UPC-A</option>
                    <option value="CODE39">CODE39</option><option value="ITF14">ITF-14</option><option value="MSI">MSI</option><option value="pharmacode">Pharmacode</option><option value="codabar">Codabar</option>
                  </select>
                </div>
                <div class="field"><span>Ширина линии</span><input id="bcWidth" type="number" min="1" max="6" value="2"></div>
                <div class="field"><span>Высота</span><input id="bcHeight" type="number" min="30" max="200" value="80"></div>
                <div class="field"><span>Подпись</span><select id="bcDisplay"><option value="true">показывать</option><option value="false">скрыть</option></select></div>
              </div>
              <div class="toolbar mt">
                <button class="btn btn-primary" id="bcGo">Сгенерировать</button>
                <button class="btn" id="bcSave">Скачать SVG</button>
                <button class="btn" id="bcPng">Скачать PNG</button>
              </div>
              <div class="hint mt-sm" id="bcMsg">EAN-13 требует 12 или 13 цифр, EAN-8 — 7 или 8, UPC-A — 11 или 12.</div>
            </div>
            <div>
              <div class="out-label"><span class="label">Штрихкод</span></div>
              <div class="barcode-holder" id="bcHolder"><svg id="bcSvg"></svg></div>
            </div>
          </div>`;
        const svg = $('#bcSvg', root), msg = $('#bcMsg', root);
        function generate() {
          msg.textContent = '';
          try {
            JsBarcode(svg, $('#bcText', root).value, {
              format: $('#bcFormat', root).value,
              width: Number($('#bcWidth', root).value) || 2,
              height: Number($('#bcHeight', root).value) || 80,
              displayValue: $('#bcDisplay', root).value === 'true',
              margin: 10, background: '#ffffff', lineColor: '#000000', font: 'monospace', fontSize: 14
            });
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
            $('#bcMsg', root).innerHTML = '<span class="ok-text">✓ Готово</span>';
          } catch (e) { msg.innerHTML = `<span class="error-text">✕ ${esc(e.message.replace(/^.*?Error:\s*/, ''))}</span>`; }
        }
        $('#bcGo', root).onclick = generate;
        ['bcFormat', 'bcWidth', 'bcHeight', 'bcDisplay'].forEach((id) => { $('#' + id, root).onchange = generate; });
        $('#bcText', root).addEventListener('input', D.debounce(generate, 350));
        $('#bcSave', root).onclick = () => {
          if (!svg.innerHTML) return;
          saveText('barcode.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + svg.outerHTML, 'image/svg+xml');
        };
        $('#bcPng', root).onclick = () => {
          try {
            const xml = new XMLSerializer().serializeToString(svg);
            const img = new Image();
            img.onload = () => {
              const c = document.createElement('canvas');
              c.width = img.width || 600; c.height = img.height || 140;
              c.getContext('2d').drawImage(img, 0, 0);
              saveBase64('barcode.png', 'image/png', c.toDataURL('image/png').split(',')[1]);
            };
            img.src = 'data:image/svg+xml;base64,' + D.bytesToB64(D.utf8(xml));
          } catch (e) { toast('Не удалось конвертировать в PNG', 'err'); }
        };
        generate();
      }
    },

    {
      id: 'fake', name: 'Fake Data', icon: '⚗', cat: 'gen',
      desc: 'Тестовые пользователи, адреса, компании и даты в JSON/CSV/SQL',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <div class="field" style="width:130px"><span>Количество</span><input id="fCount" type="number" min="1" max="200" value="5"></div>
            <div class="field" style="width:150px"><span>Формат</span><select id="fFormat"><option value="json">JSON</option><option value="csv">CSV</option><option value="sql">SQL INSERT</option></select></div>
            <button class="btn btn-primary" id="fGo" style="margin-top:15px">Сгенерировать</button>
            <span class="spacer"></span>
            <button class="btn" data-copy-target="#fOut">Копировать</button>
            <button class="btn" id="fSave">Скачать</button>
          </div>
          <div class="panel-soft mb">
            <div class="row" id="fFields"></div>
          </div>
          <div class="out-label"><span class="label">Результат</span><span class="hint" id="fStat"></span></div>
          <div class="code" id="fOut" style="min-height:320px;max-height:520px"></div>`;
        const fields = ['id', 'name', 'email', 'phone', 'company', 'city', 'address', 'username', 'password', 'birthday', 'uuid', 'ip', 'created_at'];
        const labels = { id: 'ID', name: 'Имя', email: 'Email', phone: 'Телефон', company: 'Компания', city: 'Город', address: 'Адрес', username: 'Логин', password: 'Пароль', birthday: 'Дата рождения', uuid: 'UUID', ip: 'IP', created_at: 'Создан' };
        $('#fFields', root).innerHTML = fields.map((f) => `<label class="check"><input type="checkbox" data-field="${f}" ${['id', 'name', 'email', 'phone'].includes(f) ? 'checked' : ''}> ${labels[f]}</label>`).join('');
        function escSql(v) { return typeof v === 'number' ? v : v === null ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'"; }
        function run() {
          const count = Math.max(1, Math.min(200, Number($('#fCount', root).value) || 1));
          const selected = Array.from(root.querySelectorAll('[data-field]')).filter((c) => c.checked).map((c) => c.dataset.field);
          if (!selected.length) { toast('Выберите поля', 'err'); return; }
          const rows = Array.from({ length: count }, fakeRow);
          const fmt = $('#fFormat', root).value;
          let output = '';
          if (fmt === 'json') output = JSON.stringify(rows.map((r) => { const o = {}; selected.forEach((k) => o[k] = r[k]); return o; }), null, 2);
          else if (fmt === 'csv') {
            const head = selected.join(',');
            const body = rows.map((r) => selected.map((k) => {
              const v = String(r[k] ?? '');
              return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
            }).join(','));
            output = head + '\n' + body.join('\n');
          } else {
            output = rows.map((r) => `INSERT INTO users (${selected.join(', ')}) VALUES (${selected.map((k) => escSql(r[k])).join(', ')});`).join('\n');
          }
          $('#fOut', root).textContent = output;
          $('#fStat', root).textContent = `${count} записей · ${selected.length} полей`;
        }
        $('#fGo', root).onclick = run;
        $('#fCount', root).onchange = run;
        $('#fFormat', root).onchange = run;
        $('#fSave', root).onclick = () => { if ($('#fOut', root).textContent) saveText('fake-data.' + ($('#fFormat', root).value === 'sql' ? 'sql' : $('#fFormat', root).value), $('#fOut', root).textContent); };
        run();
      }
    },

    {
      id: 'lorem', name: 'Lorem Ipsum', icon: '¶', cat: 'gen',
      desc: 'Заполнитель на латыни или русском с настройкой абзацев',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <div class="field" style="width:100px"><span>Абзацы</span><input id="lP" type="number" min="1" max="20" value="3"></div>
            <div class="field" style="width:110px"><span>Предложений</span><input id="lS" type="number" min="1" max="12" value="4"></div>
            <div class="field" style="width:150px"><span>Язык</span><select id="lLang"><option value="la">Lorem ipsum</option><option value="ru">Русский</option></select></div>
            <label class="check" style="margin-top:15px"><input type="checkbox" id="lStart" checked> начинать с "Lorem ipsum"</label>
            <button class="btn btn-primary" id="lGo" style="margin-top:15px">Сгенерировать</button>
            <span class="spacer"></span>
            <button class="btn" data-copy-target="#lOut">Копировать</button>
          </div>
          <div class="code" id="lOut" style="min-height:320px;font-family:var(--font);font-size:13px;line-height:1.7"></div>`;
        const latin = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');
        const russian = 'программный код разработка интерфейс сервер клиент данные запрос ответ система модуль проект безопасность скорость архитектура тестирование документация библиотека функция компонент шаблон дизайн пользователь приложение платформа алгоритм процесс структура'.split(' ');
        function word(lang) { return lang === 'ru' ? pick(russian) : pick(latin); }
        function sentence(lang) {
          const n = 6 + D.randomInt(9);
          const arr = Array.from({ length: n }, () => word(lang));
          let s = arr.join(' ');
          if (lang === 'ru') s = s[0].toUpperCase() + s.slice(1) + '.';
          else { s = s[0].toUpperCase() + s.slice(1) + '.'; }
          return s;
        }
        function run() {
          const p = Math.max(1, Math.min(20, Number($('#lP', root).value) || 1));
          const sn = Math.max(1, Math.min(12, Number($('#lS', root).value) || 1));
          const lang = $('#lLang', root).value;
          const paras = [];
          for (let i = 0; i < p; i++) {
            const arr = Array.from({ length: sn }, () => sentence(lang));
            let text = arr.join(' ');
            if (i === 0 && $('#lStart', root).checked && lang === 'la') text = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ' + text;
            paras.push(text);
          }
          $('#lOut', root).innerHTML = paras.map((t) => `<p>${esc(t)}</p>`).join('');
        }
        $('#lGo', root).onclick = run;
        ['lP', 'lS', 'lLang', 'lStart'].forEach((id) => { $('#' + id, root).onchange = run; });
        run();
      }
    },

    {
      id: 'slug', name: 'Slug Generator', icon: '→', cat: 'gen',
      desc: 'URL-slug с транслитерацией кириллицы и пакетной обработкой',
      render(root) {
        root.innerHTML = `
          <div class="split">
            <div>
              <div class="field"><span>Текст (по одному на строку для пакета)</span>
                <textarea id="slIn" class="mono" style="min-height:260px" spellcheck="false">Привет, мир! Это DevSuite Pro
Как дела?
Инструменты разработчика 2026</textarea>
              </div>
              <div class="form-grid mt">
                <div class="field"><span>Разделитель</span><select id="slSep"><option value="-">дефис (-)</option><option value="_">подчёркивание (_)</option><option value=".">точка (.)</option></select></div>
                <label class="check" style="margin-top:15px"><input type="checkbox" id="slLower" checked> нижний регистр</label>
                <label class="check" style="margin-top:15px"><input type="checkbox" id="slTrans" checked> транслитерация</label>
              </div>
              <div class="toolbar mt"><button class="btn btn-primary" id="slGo">Сгенерировать</button></div>
            </div>
            <div>
              <div class="out-label"><span class="label">Slug</span><button class="btn btn-sm" data-copy-target="#slOut">Копировать</button></div>
              <textarea id="slOut" class="mono" style="min-height:260px" spellcheck="false"></textarea>
              <div class="hint mt-sm">Кириллица транслитерируется в латиницу (ГОСТ-подобно). Эмодзи и спецсимволы удаляются.</div>
            </div>
          </div>`;
        const input = $('#slIn', root), out = $('#slOut', root);
        function run() {
          const sep = $('#slSep', root).value;
          const lower = $('#slLower', root).checked;
          const trans = $('#slTrans', root).checked;
          const lines = input.value.split('\n').map((line) => {
            let s = trans ? D.slugify(line) : line.toLowerCase().trim().replace(/[^a-z0-9\u0400-\u04FF]+/gi, '-').replace(/^-+|-+$/g, '');
            if (trans) s = s.replace(/-/g, sep);
            else s = s.replace(/-+/g, sep);
            if (!lower) s = s; // slugify already lowercase
            return s;
          });
          out.value = lines.join('\n');
        }
        $('#slGo', root).onclick = run;
        input.addEventListener('input', D.debounce(run, 200));
        ['slSep', 'slLower', 'slTrans'].forEach((id) => { $('#' + id, root).onchange = run; });
        run();
      }
    }
  ]);
})();
