/* DevSuite Pro — text tools part 1 */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, saveText } = D;

  function highlightPlan(text) { return esc(text); }

  D.registerTools([
    {
      id: 'sql', name: 'SQL Formatter', icon: '▤', cat: 'text',
      desc: 'Форматирование и минификация SQL запросов (SELECT, JOIN, INSERT и др.)',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="sFmt">Форматировать</button>
            <button class="btn" id="sMin">Минифицировать</button>
            <button class="btn" id="sUpper">Ключевые слова в UPPER</button>
            <span class="spacer"></span>
            <button class="btn btn-ghost" id="sSample">Пример</button>
          </div>
          <div class="split">
            <div>
              <div class="out-label"><span class="label">SQL запрос</span></div>
              <textarea id="sIn" class="mono" style="min-height:420px" spellcheck="false" placeholder="select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.active = 1 group by u.id, u.name order by orders desc limit 10;"></textarea>
            </div>
            <div>
              <div class="out-label"><span class="label">Результат</span><span class="hint" id="sStat">—</span></div>
              <div class="code tall" id="sOut"></div>
              <div class="toolbar mt-sm">
                <button class="btn btn-sm" data-copy-target="#sOut">Копировать</button>
                <button class="btn btn-sm" id="sSave">Скачать .sql</button>
              </div>
            </div>
          </div>
          <div class="hint mt-sm">Базовое форматирование по ключевым словам. Строки и комментарии сохраняются, но сложные диалекты (PostgreSQL/TSQL) могут требовать ручной правки.</div>`;
        const input = $('#sIn', root), out = $('#sOut', root), stat = $('#sStat', root);
        const major = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION ALL', 'UNION', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'WITH', 'RETURNING', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN', 'JOIN', 'ON', 'AND', 'OR'];
        const kwRe = new RegExp('\\b(' + major.slice().sort((a, b) => b.length - a.length).map(D.escapeRegExp).join('|') + ')\\b', 'gi');
        function upper(sql) { return sql.replace(kwRe, (m) => m.toUpperCase()); }
        function formatSQL(sql) {
          let s = sql.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
          s = s.replace(kwRe, (m) => {
            const up = m.toUpperCase();
            if (['AND', 'OR', 'ON'].includes(up)) return '\n  ' + up;
            return '\n' + up;
          });
          s = s.replace(/\n\s*\n+/g, '\n').replace(/^\n+/, '');
          const lines = s.split('\n');
          let indent = 0;
          return lines.map((line) => {
            const trimmed = line.trim();
            if (/^(FROM|WHERE|GROUP BY|ORDER BY|HAVING|LIMIT|OFFSET|UNION|INNER JOIN|LEFT JOIN|RIGHT JOIN|FULL JOIN|CROSS JOIN|JOIN|VALUES|SET|RETURNING)\b/i.test(trimmed)) indent = 1;
            else if (/^(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP)\b/i.test(trimmed)) indent = 0;
            const res = (indent ? '  ' : '') + trimmed;
            if (/^(AND|OR|ON)\b/i.test(trimmed)) return '  ' + res;
            return res;
          }).join('\n');
        }
        $('#sFmt', root).onclick = () => {
          if (!input.value.trim()) return;
          out.textContent = formatSQL(input.value);
          stat.textContent = out.textContent.split('\n').length + ' строк';
          toast('SQL отформатирован', 'ok');
        };
        $('#sMin', root).onclick = () => {
          out.textContent = input.value.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\s+/g, ' ').replace(/\s*([(),;=<>+\-*\/])\s*/g, '$1').trim();
          stat.textContent = 'минифицировано';
        };
        $('#sUpper', root).onclick = () => { input.value = upper(input.value); };
        $('#sSave', root).onclick = () => { if (out.textContent) saveText('query.sql', out.textContent, 'text/plain'); };
        $('#sSample', root).onclick = () => {
          input.value = "select u.id, u.name, u.email, count(o.id) as orders_count, sum(o.total) as total_sum from users u left join orders o on o.user_id = u.id and o.status = 'paid' where u.active = 1 and u.created_at >= '2025-01-01' group by u.id, u.name, u.email having count(o.id) > 0 order by total_sum desc limit 10;";
          $('#sFmt', root).click();
        };
      }
    },

    {
      id: 'css', name: 'CSS Formatter', icon: '#', cat: 'text',
      desc: 'Красивое форматирование и безопасная минификация CSS',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="cFmt">Форматировать</button>
            <button class="btn" id="cMin">Минифицировать</button>
            <span class="spacer"></span>
            <button class="btn btn-ghost" id="cSample">Пример</button>
          </div>
          <div class="split">
            <div><div class="out-label"><span class="label">CSS</span></div>
              <textarea id="cIn" class="mono" style="min-height:430px" spellcheck="false" placeholder=".button{color:#fff;background:#7c5cff;border-radius:10px;}"></textarea></div>
            <div><div class="out-label"><span class="label">Результат</span><span class="hint" id="cStat">—</span></div>
              <div class="code tall" id="cOut"></div>
              <div class="toolbar mt-sm"><button class="btn btn-sm" data-copy-target="#cOut">Копировать</button><button class="btn btn-sm" id="cSave">Скачать .css</button></div>
            </div>
          </div>`;
        const input = $('#cIn', root), out = $('#cOut', root), stat = $('#cStat', root);
        function beautify(css) {
          css = css.replace(/\/\*[\s\S]*?\*\//g, '');
          let res = '', indent = 0, quote = null;
          const pad = () => '  '.repeat(indent);
          for (let i = 0; i < css.length; i++) {
            const ch = css[i];
            if (quote) {
              res += ch;
              if (ch === quote && css[i - 1] !== '\\') quote = null;
              continue;
            }
            if (ch === '"' || ch === "'") { quote = ch; res += ch; continue; }
            if (ch === '{') {
              res = res.replace(/\s+$/, '') + ' {\n' + pad() + '  ';
              indent++;
            } else if (ch === '}') {
              indent = Math.max(0, indent - 1);
              res = res.replace(/\s+$/, '') + '\n' + pad() + '}\n\n' + pad();
            } else if (ch === ';') {
              res += ';\n' + pad();
            } else if (ch === '\n' || ch === '\r') {
              res += ' ';
            } else {
              res += ch;
            }
          }
          return res.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n\s*\n$/, '').trim();
        }
        function minify(css) {
          css = css.replace(/\/\*[\s\S]*?\*\//g, '');
          let res = '', quote = null;
          for (let i = 0; i < css.length; i++) {
            const ch = css[i];
            if (quote) { res += ch; if (ch === quote && css[i - 1] !== '\\') quote = null; continue; }
            if (ch === '"' || ch === "'") { quote = ch; res += ch; continue; }
            if (/\s/.test(ch)) { if (!/[\s{};:,>+~]$/.test(res) && !/^[\s{};:,>+~]/.test(css.slice(i + 1))) res += ' '; }
            else res += ch;
          }
          return res.replace(/\s*([{};:,>+~])\s*/g, '$1').replace(/;}/g, '}').trim();
        }
        $('#cFmt', root).onclick = () => { out.textContent = beautify(input.value); stat.textContent = out.textContent.split('\n').length + ' строк'; };
        $('#cMin', root).onclick = () => { out.textContent = minify(input.value); stat.textContent = D.fmtBytes(new Blob([out.textContent]).size); };
        $('#cSave', root).onclick = () => { if (out.textContent) saveText('styles.css', out.textContent, 'text/css'); };
        $('#cSample', root).onclick = () => {
          input.value = '.btn{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border:0;border-radius:10px;background:linear-gradient(135deg,#7c5cff,#22d3ee);color:#fff;font-weight:600}.btn:hover{filter:brightness(1.1)}@media(max-width:600px){.btn{width:100%;justify-content:center}}';
          $('#cFmt', root).click();
        };
      }
    },

    {
      id: 'markdown', name: 'Markdown Preview', icon: 'M↓', cat: 'text',
      desc: 'Редактор Markdown с живым предпросмотром, HTML и скачиванием',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="mCopy">Копировать HTML</button>
            <button class="btn" id="mSaveMd">Скачать .md</button>
            <button class="btn" id="mSaveHtml">Скачать .html</button>
            <span class="spacer"></span>
            <span class="hint" id="mStat">—</span>
            <button class="btn btn-ghost" id="mSample">Пример</button>
          </div>
          <div class="split">
            <div><div class="out-label"><span class="label">Markdown</span></div>
              <textarea id="mIn" class="mono" style="min-height:480px" spellcheck="false"></textarea></div>
            <div><div class="out-label"><span class="label">Предпросмотр</span><span class="hint">sanitized</span></div>
              <div class="md-preview panel" id="mOut" style="min-height:480px;max-height:640px;overflow:auto"></div></div>
          </div>`;
        const input = $('#mIn', root), out = $('#mOut', root), stat = $('#mStat', root);
        function render() {
          out.innerHTML = D.renderMarkdown(input.value);
          const w = input.value.trim() ? input.value.trim().split(/\s+/).length : 0;
          stat.textContent = `${w} слов · ${input.value.length} символов`;
        }
        input.addEventListener('input', D.debounce(render, 180));
        $('#mCopy', root).onclick = () => copy(out.innerHTML, 'HTML скопирован');
        $('#mSaveMd', root).onclick = () => saveText('document.md', input.value, 'text/markdown');
        $('#mSaveHtml', root).onclick = () => saveText('document.html', `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Markdown export</title><style>body{max-width:820px;margin:40px auto;padding:0 20px;font:16px/1.65 system-ui,sans-serif;color:#1c2233}pre{background:#f4f6fb;padding:14px;border-radius:8px;overflow:auto}code{font-family:Consolas,monospace}blockquote{border-left:3px solid #7c5cff;margin:0;padding-left:14px;color:#555}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px 10px}</style></head><body>${out.innerHTML}</body></html>`, 'text/html');
        $('#mSample', root).onclick = () => {
          input.value = '# DevSuite Pro\n\n**DevSuite Pro** — офлайн-набор инструментов разработчика.\n\n## Возможности\n\n- 40+ инструментов в одном приложении\n- HTTP-клиент, AI Chat и Telegram Bot\n- Работает в Windows (.exe) и Android (.apk)\n\n> Все запросы выполняются напрямую с вашего устройства.\n\n```js\nconst response = await fetch("https://api.example.com/v1/chat", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ message: "Привет!" })\n});\n```\n\n| Модуль | Статус |\n|---|---|\n| JSON Studio | ✅ |\n| API Client | ✅ |\n| Telegram | ✅ |\n';
          render();
        };
        $('#mSample', root).click();
      }
    },

    {
      id: 'escape', name: 'Escape / Unescape', icon: '\\', cat: 'text',
      desc: 'Экранирование строк для JSON, JavaScript, SQL, HTML, XML и RegExp',
      render(root) {
        root.innerHTML = `
          <div class="split">
            <div>
              <div class="field mb"><span>Режим</span>
                <select id="eMode">
                  <option value="json">JSON string</option>
                  <option value="js">JavaScript string</option>
                  <option value="sql">SQL (одинарные кавычки)</option>
                  <option value="html">HTML entities</option>
                  <option value="xml">XML</option>
                  <option value="regex">RegExp</option>
                  <option value="url">URL component</option>
                </select>
              </div>
              <div class="field"><span>Исходный текст</span>
                <textarea id="eIn" class="mono" style="min-height:300px" spellcheck="false" placeholder="Введите текст..."></textarea>
              </div>
              <div class="toolbar mt">
                <button class="btn btn-primary" id="eEsc">Escape →</button>
                <button class="btn" id="eUnesc">← Unescape</button>
                <button class="btn btn-ghost" id="eSwap">⇄ Взять результат</button>
              </div>
            </div>
            <div>
              <div class="field mb"><span>Результат</span>
                <textarea id="eOut" class="mono" style="min-height:300px" spellcheck="false" placeholder="Результат появится здесь..."></textarea>
              </div>
              <div class="toolbar">
                <button class="btn" data-copy-target="#eOut">Копировать</button>
                <span class="hint" id="eMsg"></span>
              </div>
              <div class="panel-soft mt">
                <div class="panel-title">Подсказка</div>
                <div class="hint" id="eHint">JSON string добавляет кавычки и экранирует спецсимволы. JavaScript — без внешних кавычек.</div>
              </div>
            </div>
          </div>`;
        const input = $('#eIn', root), out = $('#eOut', root), mode = $('#eMode', root), msg = $('#eMsg', root);
        const hints = {
          json: 'JSON.stringify: результат включает обрамляющие кавычки и корректен как JSON-строка.',
          js: 'Экранирует \\, кавычки, переводы строк и управляющие символы для вставки в JS.',
          sql: 'Удваивает одинарные кавычки и экранирует обратный слэш (MySQL-совместимо).',
          html: 'Заменяет & < > " \' на HTML entities.',
          xml: 'Экранирует & < > " \' для XML-текста и атрибутов.',
          regex: 'Экранирует символы, имеющие специальное значение в регулярных выражениях.',
          url: 'encodeURIComponent / decodeURIComponent.'
        };
        mode.onchange = () => { $('#eHint', root).textContent = hints[mode.value]; msg.textContent = ''; };

        function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
        function unescapeHtml(s) {
          const t = document.createElement('textarea');
          t.innerHTML = String(s).replace(/<[^>]*>/g, '');
          return t.value;
        }
        function esc(kind, s) {
          switch (kind) {
            case 'json': return JSON.stringify(String(s));
            case 'js': return JSON.stringify(String(s)).slice(1, -1);
            case 'sql': return String(s).replace(/\\/g, '\\\\').replace(/'/g, "''");
            case 'html': return escapeHtml(s);
            case 'xml': return escapeHtml(s);
            case 'regex': return D.escapeRegExp(s);
            case 'url': return encodeURIComponent(s);
            default: return s;
          }
        }
        function unesc(kind, s) {
          switch (kind) {
            case 'json': try { return JSON.parse(String(s).trim()); } catch (_) { return JSON.parse('"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'); }
            case 'js': try { return JSON.parse('"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'); } catch (_) { return s; }
            case 'sql': return String(s).replace(/''/g, "'").replace(/\\\\/g, '\\');
            case 'html': return unescapeHtml(s);
            case 'xml': return unescapeHtml(s);
            case 'regex': return String(s).replace(/\\(.)/g, '$1');
            case 'url': try { return decodeURIComponent(s); } catch (_) { return s; }
            default: return s;
          }
        }
        $('#eEsc', root).onclick = () => { try { out.value = esc(mode.value, input.value); msg.innerHTML = '<span class="ok-text">✓ Готово</span>'; } catch (e) { msg.innerHTML = `<span class="error-text">${esc(e.message)}</span>`; } };
        $('#eUnesc', root).onclick = () => { try { out.value = unesc(mode.value, input.value); msg.innerHTML = '<span class="ok-text">✓ Готово</span>'; } catch (e) { msg.innerHTML = `<span class="error-text">${esc(e.message)}</span>`; } };
        $('#eSwap', root).onclick = () => { const t = input.value; input.value = out.value; out.value = t; };
        mode.onchange();
      }
    }
  ]);
})();
