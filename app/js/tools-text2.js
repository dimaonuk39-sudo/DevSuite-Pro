/* DevSuite Pro — text tools part 2 */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, $$, toast, copy, saveText } = D;

  D.registerTools([
    {
      id: 'unicode', name: 'Unicode Inspector', icon: 'U+', cat: 'text',
      desc: 'Коды символов, UTF-8 байты, UTF-16, категории и HTML-entities',
      render(root) {
        root.innerHTML = `
          <div class="field mb"><span>Текст</span>
            <textarea id="uIn" class="mono" style="min-height:120px" spellcheck="false">Привет 👋 DevSuite ✦</textarea>
          </div>
          <div class="row mb" id="uStats"></div>
          <div class="panel" style="padding:0;overflow:auto;max-height:520px">
            <table class="kv-table" id="uTable" style="font-family:var(--mono)"></table>
          </div>
          <div class="hint mt-sm">Категории определяются по Unicode-свойствам. Невидимые символы показаны как ␠, ↵, → и т.п.</div>`;
        const input = $('#uIn', root), table = $('#uTable', root), stats = $('#uStats', root);
        const visible = (cp, ch) => {
          if (cp === 32) return '␠';
          if (cp === 10) return '↵';
          if (cp === 9) return '⇥';
          if (cp === 13) return '␍';
          if (cp === 0) return '␀';
          if (cp < 32) return '·';
          return ch;
        };
        function category(cp, ch) {
          if (/\p{Extended_Pictographic}/u.test(ch)) return 'эмодзи';
          if (/\p{Lu}/u.test(ch)) return 'буква (заглавная)';
          if (/\p{Ll}/u.test(ch)) return 'буква (строчная)';
          if (/\p{N}/u.test(ch)) return 'цифра/число';
          if (/\p{P}/u.test(ch)) return 'пунктуация';
          if (/\p{S}/u.test(ch)) return 'символ';
          if (/\p{Z}/u.test(ch)) return 'пробел';
          if (/\p{C}/u.test(ch)) return 'управляющий';
          return 'прочее';
        }
        function render() {
          const text = input.value;
          const chars = Array.from(text);
          const bytes = D.utf8(text);
          stats.innerHTML = `<span class="chip">${chars.length} code points</span><span class="chip">${text.length} UTF-16 units</span><span class="chip">${bytes.length} байт UTF-8</span><span class="chip">${Array.from(new Set(chars)).length} уникальных</span>`;
          const rows = ['<thead><tr><th>Символ</th><th>Code point</th><th>Dec</th><th>UTF-8</th><th>UTF-16</th><th>Категория</th><th>HTML</th></tr></thead>'];
          let html = '';
          const limit = Math.min(chars.length, 4000);
          for (let i = 0; i < limit; i++) {
            const ch = chars[i], cp = ch.codePointAt(0);
            const utf8 = Array.from(D.utf8(ch)).map((b) => b.toString(16).padStart(2, '0')).join(' ');
            const u16 = [];
            for (let k = 0; k < ch.length; k++) u16.push(ch.charCodeAt(k).toString(16).toUpperCase().padStart(4, '0'));
            html += `<tr>
              <td style="font-size:16px;text-align:center">${esc(visible(cp, ch))}</td>
              <td>U+${cp.toString(16).toUpperCase().padStart(4, '0')}</td>
              <td>${cp}</td>
              <td>${utf8}</td>
              <td>${u16.join(' ')}</td>
              <td>${category(cp, ch)}</td>
              <td>&amp;#x${cp.toString(16).toUpperCase()};</td>
            </tr>`;
          }
          if (chars.length > limit) html += `<tr><td colspan="7" class="hint">Показаны первые ${limit} из ${chars.length} символов</td></tr>`;
          table.innerHTML = rows.join('') + '<tbody>' + html + '</tbody>';
        }
        input.addEventListener('input', D.debounce(render, 200));
        render();
      }
    },

    {
      id: 'case', name: 'Case Converter', icon: 'Aa', cat: 'text',
      desc: 'camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE и другие',
      render(root) {
        root.innerHTML = `
          <div class="field mb"><span>Исходный текст</span>
            <textarea id="aIn" class="mono" style="min-height:110px" spellcheck="false">DevSuite pro — инструменты разработчика</textarea>
          </div>
          <div class="toolbar mb">
            <button class="btn btn-ghost" id="aSample">Пример</button>
            <label class="check"><input type="checkbox" id="aCyr" checked> транслитерация в slug</label>
          </div>
          <div id="aOut" class="list"></div>`;
        const input = $('#aIn', root), out = $('#aOut', root);
        function sentence(s) {
          const t = String(s).toLowerCase().trim();
          return t ? t[0].toUpperCase() + t.slice(1) : '';
        }
        function alternating(s) { return String(s).split('').map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join(''); }
        const converters = {
          'UPPER CASE': (s) => s.toUpperCase(),
          'lower case': (s) => s.toLowerCase(),
          'Title Case': D.titleCase,
          'Sentence case': sentence,
          'camelCase': D.toCamel,
          'PascalCase': D.toPascal,
          'snake_case': D.toSnake,
          'kebab-case': D.toKebab,
          'CONSTANT_CASE': D.toConstant,
          'dot.case': (s) => D.words(s).map((w) => w.toLowerCase()).join('.'),
          'slug-url': (s) => D.slugify(s),
          'aLtErNaTiNg': alternating,
          'Reverse': (s) => Array.from(s).reverse().join('')
        };
        function render() {
          out.innerHTML = Object.keys(converters).map((name, i) => {
            let val = '';
            try { val = converters[name](input.value); } catch (_) {}
            return `<div class="list-item">
              <div class="grow"><div class="hint">${esc(name)}</div><div class="mono" style="word-break:break-all" id="case-${i}">${esc(val) || '<span class="muted">—</span>'}</div></div>
              <button class="btn btn-sm" data-case="${i}">Копировать</button>
            </div>`;
          }).join('');
          out.querySelectorAll('[data-case]').forEach((b) => {
            b.onclick = () => {
              const el = $('#case-' + b.dataset.case, out);
              copy(el.textContent, 'Скопировано');
            };
          });
        }
        input.addEventListener('input', D.debounce(render, 120));
        $('#aSample', root).onclick = () => { input.value = 'user profile settings 2026'; render(); };
        render();
      }
    },

    {
      id: 'text', name: 'Text Utilities', icon: '¶', cat: 'text',
      desc: 'Статистика, сортировка, уникальные строки, извлечение email/URL и replace',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="xSortA">Сортировать A→Z</button>
            <button class="btn" id="xSortD">Z→A</button>
            <button class="btn" id="xUniq">Уникальные</button>
            <button class="btn" id="xRev">Реверс строк</button>
            <button class="btn" id="xTrim">Trim</button>
            <button class="btn" id="xEmpty">Убрать пустые</button>
            <button class="btn" id="xNum">Нумерация</button>
            <button class="btn" id="xShuffle">Перемешать</button>
          </div>
          <div class="toolbar mb">
            <button class="btn" id="xEmails">Email</button>
            <button class="btn" id="xUrls">URL</button>
            <button class="btn" id="xPhones">Телефоны</button>
            <button class="btn" id="xNums">Числа</button>
            <span class="spacer"></span>
            <button class="btn btn-ghost" id="xSample">Пример</button>
          </div>
          <div class="split">
            <div><div class="out-label"><span class="label">Входной текст</span><span class="hint" id="xStats">—</span></div>
              <textarea id="xIn" class="mono" style="min-height:360px" spellcheck="false" placeholder="Вставьте текст..."></textarea></div>
            <div><div class="out-label"><span class="label">Результат</span><button class="btn btn-sm" data-copy-target="#xOut">Копировать</button></div>
              <textarea id="xOut" class="mono" style="min-height:360px" spellcheck="false" placeholder="Результат операций..."></textarea></div>
          </div>
          <div class="panel-soft mt">
            <div class="panel-title">Найти и заменить</div>
            <div class="grid-3">
              <div class="field"><span>Найти</span><input id="xFind" class="mono" placeholder="текст или regex"></div>
              <div class="field"><span>Заменить на</span><input id="xRepl" class="mono" placeholder=""></div>
              <div class="field"><span>Опции</span><div class="row"><label class="check"><input type="checkbox" id="xRegex"> regex</label><label class="check"><input type="checkbox" id="xCase"> учёт регистра</label></div></div>
            </div>
            <div class="toolbar mt-sm"><button class="btn btn-primary btn-sm" id="xReplace">Заменить</button><span class="hint" id="xMsg"></span></div>
          </div>`;
        const input = $('#xIn', root), out = $('#xOut', root), stats = $('#xStats', root), msg = $('#xMsg', root);
        const lines = () => out.value ? out.value.split('\n') : input.value.split('\n');
        function set(text) { out.value = text; updateStats(); }
        function updateStats() {
          const t = input.value;
          stats.textContent = `${t.length} символов · ${(t.trim() ? t.trim().split(/\s+/).length : 0)} слов · ${(t ? t.split('\n').length : 0)} строк`;
        }
        input.addEventListener('input', updateStats);
        const ops = {
          xSortA: () => lines().slice().sort((a, b) => a.localeCompare(b, 'ru')).join('\n'),
          xSortD: () => lines().slice().sort((a, b) => b.localeCompare(a, 'ru')).join('\n'),
          xUniq: () => D.uniq(lines()).join('\n'),
          xRev: () => lines().reverse().join('\n'),
          xTrim: () => input.value.split('\n').map((l) => l.trim()).join('\n'),
          xEmpty: () => input.value.split('\n').filter((l) => l.trim()).join('\n'),
          xNum: () => input.value.split('\n').map((l, i) => `${i + 1}. ${l}`).join('\n'),
          xShuffle: () => { const a = lines().slice(); for (let i = a.length - 1; i > 0; i--) { const j = D.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a.join('\n'); }
        };
        Object.keys(ops).forEach((id) => { $('#' + id, root).onclick = () => { set(ops[id]()); updateStats(); }; });
        const extractors = {
          xEmails: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
          xUrls: /https?:\/\/[^\s"'<>]+/g,
          xPhones: /\+?\d[\d\s()\-]{8,}\d/g,
          xNums: /-?\d+(?:[.,]\d+)?/g
        };
        Object.keys(extractors).forEach((id) => {
          $('#' + id, root).onclick = () => {
            const m = input.value.match(extractors[id]) || [];
            set(D.uniq(m).join('\n'));
            toast(`${m.length} найдено`, 'ok');
          };
        });
        $('#xSample', root).onclick = () => {
          input.value = 'bob@example.com\nhttps://devsuite.pro\n+7 999 123-45-67\nalice@example.com\nhttps://api.telegram.org\n42\nbob@example.com\n';
          updateStats();
        };
        $('#xReplace', root).onclick = () => {
          const find = $('#xFind', root).value;
          if (!find) return;
          try {
            let flags = $('#xCase', root).checked ? 'g' : 'gi';
            const re = $('#xRegex', root).checked ? new RegExp(find, flags) : new RegExp(D.escapeRegExp(find), flags);
            const count = (input.value.match(re) || []).length;
            set(input.value.replace(re, $('#xRepl', root).value));
            msg.innerHTML = `<span class="ok-text">✓ заменено: ${count}</span>`;
          } catch (e) { msg.innerHTML = `<span class="error-text">${esc(e.message)}</span>`; }
        };
        updateStats();
      }
    },

    {
      id: 'number', name: 'Number Base', icon: '01', cat: 'text',
      desc: 'Конвертация чисел между 2, 8, 10, 16 и произвольными основаниями (BigInt)',
      render(root) {
        root.innerHTML = `
          <div class="form-grid mb">
            <div class="field"><span>Число</span><input id="nIn" class="mono" value="255" placeholder="255 / 0xFF / 11111111"></div>
            <div class="field"><span>Система счисления</span>
              <select id="nBase"><option value="10">Decimal (10)</option><option value="2">Binary (2)</option><option value="8">Octal (8)</option><option value="16">Hex (16)</option><option value="auto">Авто (0x/0b/0o)</option><option value="36">Base36</option><option value="custom">Другая…</option></select>
            </div>
            <div class="field" id="nCustomWrap" style="display:none"><span>Основание (2–36)</span><input id="nCustom" type="number" min="2" max="36" value="32"></div>
          </div>
          <div class="toolbar mb"><button class="btn btn-primary" id="nGo">Конвертировать</button><span class="hint" id="nErr"></span></div>
          <div class="grid-2" id="nOut"></div>
          <div class="panel-soft mt">
            <div class="panel-title">Представление</div>
            <div id="nBits" class="code" style="max-height:200px"></div>
          </div>`;
        const input = $('#nIn', root), baseSel = $('#nBase', root), customWrap = $('#nCustomWrap', root), out = $('#nOut', root), err = $('#nErr', root), bits = $('#nBits', root);

        function parseBig(str, base) {
          str = String(str).trim().replace(/[\s_]/g, '');
          let neg = false;
          if (str.startsWith('-')) { neg = true; str = str.slice(1); }
          else if (str.startsWith('+')) str = str.slice(1);
          if (base === 'auto') {
            if (/^0x/i.test(str)) { base = 16; str = str.slice(2); }
            else if (/^0b/i.test(str)) { base = 2; str = str.slice(2); }
            else if (/^0o/i.test(str)) { base = 8; str = str.slice(2); }
            else base = 10;
          }
          base = Number(base);
          if (!(base >= 2 && base <= 36)) throw new Error('Основание должно быть от 2 до 36');
          if (!str) throw new Error('Пустое число');
          let n = 0n;
          const B = BigInt(base);
          for (const ch of str.toLowerCase()) {
            const digit = parseInt(ch, 36);
            if (isNaN(digit) || digit >= base) throw new Error(`Символ «${ch}» недопустим для основания ${base}`);
            n = n * B + BigInt(digit);
          }
          return neg ? -n : n;
        }
        function run() {
          err.textContent = '';
          try {
            let base = baseSel.value;
            if (base === 'custom') base = Number($('#nCustom', root).value);
            const n = parseBig(input.value, base);
            const items = [
              ['Binary', n.toString(2)],
              ['Octal', n.toString(8)],
              ['Decimal', n.toString(10)],
              ['Hex', n.toString(16).toUpperCase()],
              ['Base36', n.toString(36)],
              ['Длина (бит)', n === 0n ? '1' : (n < 0n ? -n : n).toString(2).length.toString()]
            ];
            out.innerHTML = items.map(([k, v], i) => `
              <div class="panel-soft">
                <div class="row-between"><span class="label">${k}</span><button class="btn btn-sm" data-ncopy="${i}">Копировать</button></div>
                <div class="mono mt-sm" style="word-break:break-all;font-size:14px" id="nval-${i}">${esc(v)}</div>
              </div>`).join('');
            out.querySelectorAll('[data-ncopy]').forEach((b) => { b.onclick = () => copy($('#nval-' + b.dataset.ncopy, out).textContent); });
            const bin = (n < 0n ? -n : n).toString(2);
            const grouped = bin.replace(/\B(?=(\d{4})+(?!\d))/g, ' ');
            const b8 = bin.replace(/\B(?=(\d{8})+(?!\d))/g, ' ');
            bits.textContent = `bin: ${n < 0n ? '-' : ''}${grouped}\nbytes: ${b8}\nhex: 0x${(n < 0n ? -n : n).toString(16).toUpperCase()}\n32-bit: ${n >= 0n && n <= 0xFFFFFFFFn ? '0x' + n.toString(16).toUpperCase().padStart(8, '0') : '—'}\n64-bit: ${n >= 0n && n <= 0xFFFFFFFFFFFFFFFFn ? '0x' + n.toString(16).toUpperCase().padStart(16, '0') : '—'}`;
          } catch (e) {
            out.innerHTML = '';
            bits.textContent = '';
            err.innerHTML = `<span class="error-text">${esc(e.message)}</span>`;
          }
        }
        baseSel.onchange = () => { customWrap.style.display = baseSel.value === 'custom' ? '' : 'none'; if (baseSel.value !== 'custom') run(); };
        $('#nCustom', root).addEventListener('input', run);
        $('#nGo', root).onclick = run;
        input.addEventListener('input', D.debounce(run, 200));
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
        run();
      }
    },

    {
      id: 'html', name: 'HTML Entities', icon: '&', cat: 'text',
      desc: 'Кодирование и декодирование HTML-сущностей с таблицей популярных',
      render(root) {
        root.innerHTML = `
          <div class="split">
            <div>
              <div class="field"><span>Исходный текст / HTML</span>
                <textarea id="hIn" class="mono" style="min-height:260px" spellcheck="false"><div class="card">Привет & "мир"</div></textarea>
              </div>
              <div class="toolbar mt">
                <button class="btn btn-primary" id="hEnc">Encode →</button>
                <button class="btn" id="hDec">← Decode</button>
                <button class="btn btn-ghost" id="hSwap">⇄</button>
              </div>
            </div>
            <div>
              <div class="field"><span>Результат</span>
                <textarea id="hOut" class="mono" style="min-height:260px" spellcheck="false"></textarea>
              </div>
              <div class="toolbar"><button class="btn" data-copy-target="#hOut">Копировать</button><span class="hint" id="hMsg"></span></div>
            </div>
          </div>
          <div class="panel-soft mt">
            <div class="panel-title">Популярные сущности</div>
            <div class="grid-3" id="hTable"></div>
          </div>`;
        const input = $('#hIn', root), out = $('#hOut', root), msg = $('#hMsg', root);
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '©': '&copy;', '®': '&reg;', '€': '&euro;', '£': '&pound;', '—': '&mdash;', '–': '&ndash;', '«': '&laquo;', '»': '&raquo;', '…': '&hellip;', '•': '&bull;', '→': '&rarr;', '←': '&larr;', '✓': '&check;', '×': '&times;', '÷': '&divide;' };
        const enc = (s) => String(s).replace(/[&<>"']/g, (c) => map[c]);
        function dec(s) {
          const t = document.createElement('textarea');
          t.innerHTML = String(s);
          return t.value;
        }
        $('#hEnc', root).onclick = () => { out.value = enc(input.value); msg.innerHTML = '<span class="ok-text">✓</span>'; };
        $('#hDec', root).onclick = () => { out.value = dec(input.value); msg.innerHTML = '<span class="ok-text">✓</span>'; };
        $('#hSwap', root).onclick = () => { const t = input.value; input.value = out.value; out.value = t; };
        $('#hTable', root).innerHTML = Object.entries(map).slice(0, 18).map(([ch, ent]) => `<div class="list-item"><b class="mono" style="width:26px">${esc(ch)}</b><span class="mono grow">${esc(ent)}</span><button class="btn btn-sm" data-copy="${esc(ent)}">⧉</button></div>`).join('');
      }
    },

    {
      id: 'binary', name: 'Text ↔ Binary', icon: '10', cat: 'text',
      desc: 'Текст в двоичный код, hex, octal и обратно с разными разделителями',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <div class="field" style="width:190px"><span>Формат</span>
              <select id="bFormat"><option value="bin">Binary (01001)</option><option value="hex">Hex (0A FF)</option><option value="oct">Octal</option><option value="dec">Decimal bytes</option></select>
            </div>
            <div class="field" style="width:150px"><span>Разделитель</span>
              <select id="bSep"><option value=" ">Пробел</option><option value="">Без</option><option value=",">Запятая</option><option value="-">Дефис</option></select>
            </div>
            <div class="field" style="width:170px"><span>Размер единицы</span>
              <select id="bPad"><option value="8">8 бит / 2 hex</option><option value="16">16 бит / 4 hex</option><option value="4">4 бита / 1 hex</option></select>
            </div>
            <span class="spacer"></span>
            <label class="check" style="margin-top:15px"><input type="checkbox" id="bSpaces" checked> пробелы → видимые</label>
          </div>
          <div class="split">
            <div><div class="out-label"><span class="label">Текст</span></div>
              <textarea id="bIn" class="mono" style="min-height:280px" spellcheck="false">Hello, DevSuite 👋</textarea>
              <div class="toolbar mt-sm"><button class="btn btn-primary btn-sm" id="bEnc">Текст → код</button><span class="hint" id="bInfo"></span></div>
            </div>
            <div><div class="out-label"><span class="label">Код</span></div>
              <textarea id="bOut" class="mono" style="min-height:280px" spellcheck="false"></textarea>
              <div class="toolbar mt-sm"><button class="btn btn-sm" id="bDec">Код → текст</button><button class="btn btn-sm" data-copy-target="#bOut">Копировать</button></div>
            </div>
          </div>`;
        const input = $('#bIn', root), out = $('#bOut', root), info = $('#bInfo', root);
        function units(text) {
          const bytes = D.utf8(text);
          const fmt = $('#bFormat', root).value;
          const pad = Number($('#bPad', root).value);
          if (fmt === 'bin' || fmt === 'hex' || fmt === 'oct') {
            if (pad === 4 && fmt === 'hex') return Array.from(bytes).map((b) => (b >> 4).toString(16) + (b & 15).toString(16)).join('');
            if (pad === 16) {
              const out16 = [];
              for (let i = 0; i < bytes.length; i += 2) {
                const v = (bytes[i] << 8) | (bytes[i + 1] || 0);
                out16.push(fmt === 'bin' ? v.toString(2).padStart(16, '0') : fmt === 'hex' ? v.toString(16).padStart(4, '0') : v.toString(8).padStart(6, '0'));
              }
              return out16;
            }
            return Array.from(bytes).map((b) => fmt === 'bin' ? b.toString(2).padStart(8, '0') : fmt === 'hex' ? b.toString(16).padStart(2, '0').toUpperCase() : b.toString(8).padStart(3, '0'));
          }
          return Array.from(bytes).map(String);
        }
        function encode() {
          let text = input.value;
          if ($('#bSpaces', root).checked) text = text.replace(/ /g, '␠');
          const fmt = $('#bFormat', root).value;
          const pad = Number($('#bPad', root).value);
          const sep = $('#bSep', root).value;
          let arr;
          if (fmt === 'hex' && pad === 4) arr = [units(text).join('')];
          else arr = units(text);
          out.value = arr.join(sep);
          info.textContent = `${D.utf8(text).length} байт UTF-8`;
        }
        function decode() {
          try {
            const fmt = $('#bFormat', root).value;
            const pad = Number($('#bPad', root).value);
            let tokens;
            if (fmt === 'dec') tokens = out.value.trim().split(/[\s,;\-]+/).filter(Boolean);
            else if (fmt === 'hex' && pad === 4) tokens = (out.value.replace(/[^0-9a-f]/gi, '').match(/.{1,4}/g) || []);
            else tokens = out.value.trim().split(/[\s,;\-]+/).filter(Boolean);
            const bytes = [];
            for (const tok of tokens) {
              let n;
              if (fmt === 'bin') n = parseInt(tok, 2);
              else if (fmt === 'hex') n = parseInt(tok, 16);
              else if (fmt === 'oct') n = parseInt(tok, 8);
              else n = parseInt(tok, 10);
              if (isNaN(n)) throw new Error('Некорректный токен: ' + tok);
              if (pad === 16 && fmt !== 'dec') { bytes.push((n >> 8) & 255, n & 255); }
              else bytes.push(n & 255);
            }
            input.value = new TextDecoder('utf-8').decode(new Uint8Array(bytes)).replace(/␠/g, ' ');
            info.textContent = `${bytes.length} байт`;
          } catch (e) { toast(e.message, 'err'); }
        }
        $('#bEnc', root).onclick = encode;
        $('#bDec', root).onclick = decode;
        ['bFormat', 'bSep', 'bPad', 'bSpaces'].forEach((id) => { $('#' + id, root).onchange = encode; });
        input.addEventListener('input', D.debounce(encode, 250));
        encode();
      }
    }
  ]);
})();
