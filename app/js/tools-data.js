/* DevSuite Pro — data & text tools */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, $$, toast, copy, saveText, fmtBytes } = D;

  function fileName(name) { return D.slugify(name) || 'file'; }
  function readTextFile(input, cb) {
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (!f) return;
      try { cb(await D.readFile(f, 'text'), f); } catch (e) { toast('Не удалось прочитать файл', 'err'); }
      input.value = '';
    });
  }

  function jsonError(text, e) {
    const msg = String(e.message || e);
    const m = /position (\d+)/.exec(msg) || /at position (\d+)/.exec(msg);
    if (m) {
      const pos = Math.min(Number(m[1]), text.length);
      const before = text.slice(0, pos);
      const line = before.split('\n').length;
      const col = pos - before.lastIndexOf('\n');
      return `${msg} — строка ${line}, колонка ${col}`;
    }
    return msg;
  }

  function countJSON(v) {
    let keys = 0, arrays = 0, nodes = 0, depth = 0;
    function walk(x, d) {
      nodes++; depth = Math.max(depth, d);
      if (Array.isArray(x)) { arrays++; x.forEach((i) => walk(i, d + 1)); }
      else if (x && typeof x === 'object') { keys += Object.keys(x).length; Object.values(x).forEach((i) => walk(i, d + 1)); }
    }
    walk(v, 0);
    return { keys, arrays, nodes, depth };
  }

  function sortJSON(v) {
    if (Array.isArray(v)) return v.map(sortJSON);
    if (v && typeof v === 'object') {
      const o = {};
      Object.keys(v).sort().forEach((k) => { o[k] = sortJSON(v[k]); });
      return o;
    }
    return v;
  }

  function treeHTML(v, key, depth) {
    const label = key === null ? '' : `<span class="j-key">${esc(key)}</span><span class="j-colon">: </span>`;
    if (Array.isArray(v)) {
      if (!v.length) return `<div class="j-row">${label}<span class="j-brace">[]</span></div>`;
      return `<details ${depth < 2 ? 'open' : ''} class="j-node"><summary>${label}<span class="j-brace">[</span><span class="j-count">${v.length}</span><span class="j-brace">]</span></summary><div class="j-children">${v.map((x, i) => treeHTML(x, i, depth + 1)).join('')}</div><span class="j-brace j-close">]</span></details>`;
    }
    if (v && typeof v === 'object') {
      const ks = Object.keys(v);
      if (!ks.length) return `<div class="j-row">${label}<span class="j-brace">{}</span></div>`;
      return `<details ${depth < 2 ? 'open' : ''} class="j-node"><summary>${label}<span class="j-brace">{</span><span class="j-count">${ks.length}</span><span class="j-brace">}</span></summary><div class="j-children">${ks.map((k) => treeHTML(v[k], k, depth + 1)).join('')}</div><span class="j-brace j-close">}</span></details>`;
    }
    let cls = 'j-null', out = 'null';
    if (typeof v === 'string') { cls = 'j-str'; out = JSON.stringify(v); }
    else if (typeof v === 'number') { cls = 'j-num'; out = String(v); }
    else if (typeof v === 'boolean') { cls = 'j-bool'; out = String(v); }
    return `<div class="j-row">${label}<span class="${cls}">${esc(out)}</span></div>`;
  }

  function diffSeq(a, b, eqFn) {
    const n = a.length, m = b.length;
    const w = m + 1;
    const dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = eqFn(a[i], b[j])
          ? dp[(i + 1) * w + j + 1] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (eqFn(a[i], b[j])) { out.push({ t: 'eq', a: a[i], b: b[j] }); i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) out.push({ t: 'del', a: a[i++] });
      else out.push({ t: 'add', b: b[j++] });
    }
    while (i < n) out.push({ t: 'del', a: a[i++] });
    while (j < m) out.push({ t: 'add', b: b[j++] });
    return out;
  }

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
      else if (c === '\r') { /* skip */ }
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

  D.registerTools([
    /* ---------------- JSON Studio ---------------- */
    {
      id: 'json', name: 'JSON Studio', icon: '{}', cat: 'data', badge: 'core',
      desc: 'Форматирование, валидация, дерево, сортировка ключей, поиск ошибок',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="jFmt">Форматировать</button>
            <button class="btn" id="jMin">Минифицировать</button>
            <button class="btn" id="jSort">Сортировать ключи</button>
            <button class="btn" id="jCheck">Проверить</button>
            <input type="file" id="jFile" accept=".json,.txt,application/json" hidden>
            <button class="btn" id="jLoad">Открыть файл</button>
            <span class="spacer"></span>
            <button class="btn btn-ghost" id="jSample">Пример</button>
            <button class="btn btn-ghost" id="jClear">Очистить</button>
          </div>
          <div class="split">
            <div>
              <div class="out-label"><span class="label">Входной JSON</span><span class="hint" id="jStat">—</span></div>
              <textarea id="jIn" class="mono" style="min-height:460px" spellcheck="false" placeholder='{"hello": "world", "items": [1, 2, 3]}'></textarea>
              <div class="hint mt-sm" id="jMsg">Вставьте JSON и нажмите «Форматировать». Поддерживаются комментарии-ошибки, дерево и сортировка.</div>
            </div>
            <div data-tabgroup="jsonout">
              <div class="tabs">
                <button class="tab is-active" data-tab="out">Результат</button>
                <button class="tab" data-tab="tree">Дерево</button>
              </div>
              <div class="tab-pane is-active" data-pane="out">
                <div class="code tall" id="jOut"></div>
                <div class="toolbar mt-sm">
                  <button class="btn btn-sm" data-copy-target="#jOut">Копировать</button>
                  <button class="btn btn-sm" id="jSave">Скачать .json</button>
                </div>
              </div>
              <div class="tab-pane" data-pane="tree"><div class="tree" id="jTree"><div class="empty-state">Дерево появится после разбора JSON</div></div></div>
            </div>
          </div>`;
        const ta = $('#jIn', root), out = $('#jOut', root), tree = $('#jTree', root), msg = $('#jMsg', root), stat = $('#jStat', root);
        let current = null;

        function parseNow(showOk) {
          const text = ta.value.trim();
          if (!text) { msg.textContent = 'Введите JSON.'; msg.className = 'hint mt-sm'; return null; }
          try {
            const v = JSON.parse(text);
            current = v;
            const st = countJSON(v);
            stat.textContent = `${fmtBytes(new Blob([text]).size)} · ${st.nodes} узлов · глубина ${st.depth}`;
            msg.innerHTML = `<span class="ok-text">✓ Корректный JSON</span> · ключей: ${st.keys}, массивов: ${st.arrays}, узлов: ${st.nodes}, глубина: ${st.depth}`;
            msg.className = 'hint mt-sm';
            tree.innerHTML = treeHTML(v, null, 0);
            if (showOk) toast('JSON корректен', 'ok');
            return v;
          } catch (e) {
            msg.innerHTML = `<span class="error-text">✕ ${esc(jsonError(text, e))}</span>`;
            msg.className = 'hint mt-sm';
            stat.textContent = 'ошибка';
            return null;
          }
        }

        $('#jFmt', root).onclick = () => {
          const v = parseNow();
          if (v !== null) { out.textContent = JSON.stringify(v, null, 2); toast('Отформатировано', 'ok'); }
        };
        $('#jMin', root).onclick = () => {
          const v = parseNow();
          if (v !== null) out.textContent = JSON.stringify(v);
        };
        $('#jSort', root).onclick = () => {
          const v = parseNow();
          if (v !== null) { out.textContent = JSON.stringify(sortJSON(v), null, 2); toast('Ключи отсортированы', 'ok'); }
        };
        $('#jCheck', root).onclick = () => parseNow(true);
        $('#jLoad', root).onclick = () => $('#jFile', root).click();
        readTextFile($('#jFile', root), (text) => { ta.value = text; parseNow(); });
        $('#jSave', root).onclick = () => {
          const v = current || parseNow();
          if (v === null) return;
          saveText('data.json', JSON.stringify(v, null, 2), 'application/json');
        };
        $('#jSample', root).onclick = () => {
          ta.value = JSON.stringify({ app: 'DevSuite Pro', version: '1.0.0', features: ['json', 'api', 'ai', 'telegram'], config: { theme: 'dark', offline: true, limits: { rps: 25, timeout: 30000 } }, users: [{ id: 1, name: 'Алиса', active: true }, { id: 2, name: 'Боб', active: false }] }, null, 2);
          out.textContent = ''; tree.innerHTML = '<div class="empty-state">Дерево появится после разбора JSON</div>'; parseNow();
        };
        $('#jClear', root).onclick = () => { ta.value = ''; out.textContent = ''; stat.textContent = '—'; msg.textContent = 'Вставьте JSON и нажмите «Форматировать».'; tree.innerHTML = '<div class="empty-state">Дерево появится после разбора JSON</div>'; current = null; ta.focus(); };
        ta.addEventListener('input', D.debounce(() => { if (ta.value.trim()) parseNow(); }, 450));
      }
    },

    /* ---------------- YAML <-> JSON ---------------- */
    {
      id: 'yaml', name: 'YAML ↔ JSON', icon: '⇆', cat: 'data',
      desc: 'Двусторонняя конвертация YAML и JSON с валидацией',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="yToJ">YAML → JSON</button>
            <button class="btn" id="yToY">JSON → YAML</button>
            <button class="btn" id="yFmt">Форматировать YAML</button>
            <span class="spacer"></span>
            <button class="btn btn-ghost" id="ySample">Пример</button>
          </div>
          <div class="split">
            <div>
              <div class="out-label"><span class="label">YAML</span><span class="hint">вход / выход</span></div>
              <textarea id="yYaml" class="mono" style="min-height:440px" spellcheck="false" placeholder="server:&#10;  host: localhost&#10;  port: 8080"></textarea>
            </div>
            <div>
              <div class="out-label"><span class="label">JSON</span><span class="hint">вход / выход</span></div>
              <textarea id="yJson" class="mono" style="min-height:440px" spellcheck="false" placeholder='{"server":{"host":"localhost","port":8080}}'></textarea>
            </div>
          </div>
          <div class="hint mt-sm" id="yMsg">Используется js-yaml 4. Поддерживаются якоря, многострочные строки и несколько документов (первый).</div>`;
        const y = $('#yYaml', root), j = $('#yJson', root), msg = $('#yMsg', root);
        const ok = (t) => { msg.innerHTML = `<span class="ok-text">✓ ${esc(t)}</span>`; };
        const err = (e) => { msg.innerHTML = `<span class="error-text">✕ ${esc(e.message || e)}</span>`; };
        $('#yToJ', root).onclick = () => {
          try { const v = jsyaml.load(y.value); j.value = JSON.stringify(v, null, 2); ok('YAML успешно разобран'); }
          catch (e) { err(e); }
        };
        $('#yToY', root).onclick = () => {
          try { const v = JSON.parse(j.value); y.value = jsyaml.dump(v, { indent: 2, lineWidth: 100, noRefs: true }); ok('JSON успешно разобран'); }
          catch (e) { err(e); }
        };
        $('#yFmt', root).onclick = () => {
          try { y.value = jsyaml.dump(jsyaml.load(y.value), { indent: 2, lineWidth: 100, noRefs: true }); ok('YAML отформатирован'); }
          catch (e) { err(e); }
        };
        $('#ySample', root).onclick = () => {
          y.value = 'app: DevSuite Pro\nversion: 1.0.0\nfeatures:\n  - json\n  - api\n  - telegram\nserver:\n  host: 0.0.0.0\n  port: 8080\n  tls: true\nlimits:\n  rps: 25\n  timeout: 30000\n';
          $('#yToJ', root).click();
        };
      }
    },

    /* ---------------- XML ---------------- */
    {
      id: 'xml', name: 'XML Studio', icon: '‹›', cat: 'data',
      desc: 'Форматирование, минификация, валидация и конвертация XML в JSON',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="xFmt">Форматировать</button>
            <button class="btn" id="xMin">Минифицировать</button>
            <button class="btn" id="xJson">XML → JSON</button>
            <button class="btn" id="xCplx">→ JSON (компактный)</button>
            <span class="spacer"></span>
            <button class="btn btn-ghost" id="xSample">Пример</button>
          </div>
          <div class="split">
            <div>
              <div class="out-label"><span class="label">XML</span><span class="hint">вход</span></div>
              <textarea id="xIn" class="mono" style="min-height:440px" spellcheck="false" placeholder="&lt;root&gt;&lt;item id=&quot;1&quot;&gt;Hello&lt;/item&gt;&lt;/root&gt;"></textarea>
            </div>
            <div>
              <div class="out-label"><span class="label">Результат</span><span class="hint" id="xStat">—</span></div>
              <div class="code tall" id="xOut"></div>
              <div class="toolbar mt-sm">
                <button class="btn btn-sm" data-copy-target="#xOut">Копировать</button>
                <button class="btn btn-sm" id="xSave">Скачать</button>
              </div>
            </div>
          </div>
          <div class="hint mt-sm" id="xMsg">Поддерживаются пространства имён, атрибуты и CDATA. Для JSON атрибуты получают префикс @, текст — #text.</div>`;
        const ta = $('#xIn', root), out = $('#xOut', root), msg = $('#xMsg', root), stat = $('#xStat', root);

        function parseXML(text) {
          const doc = new DOMParser().parseFromString(text, 'application/xml');
          const err = doc.querySelector('parsererror');
          if (err) throw new Error(err.textContent.replace(/\s+/g, ' ').trim());
          return doc;
        }
        function fmtNode(node, level) {
          const pad = '  '.repeat(level);
          if (node.nodeType === 9) return Array.from(node.childNodes).map((n) => fmtNode(n, level)).join('');
          if (node.nodeType === 3) { const t = node.nodeValue.trim(); return t ? pad + t + '\n' : ''; }
          if (node.nodeType === 4) return pad + '<![CDATA[' + node.nodeValue + ']]>\n';
          if (node.nodeType === 8) return pad + '<!--' + node.nodeValue + '-->\n';
          if (node.nodeType === 1) {
            const attrs = Array.from(node.attributes).map((a) => ` ${a.name}="${a.value.replace(/"/g, '&quot;')}"`).join('');
            const kids = Array.from(node.childNodes).filter((n) => n.nodeType === 1 || n.nodeType === 4 || n.nodeType === 8 || (n.nodeType === 3 && n.nodeValue.trim()));
            if (!kids.length) return `${pad}<${node.tagName}${attrs}/>\n`;
            if (kids.length === 1 && kids[0].nodeType === 3) return `${pad}<${node.tagName}${attrs}>${kids[0].nodeValue.trim()}</${node.tagName}>\n`;
            return `${pad}<${node.tagName}${attrs}>\n` + kids.map((k) => fmtNode(k, level + 1)).join('') + `${pad}</${node.tagName}>\n`;
          }
          return '';
        }
        function xmlToJson(node) {
          if (node.nodeType === 3) return node.nodeValue.trim();
          if (node.nodeType !== 1 && node.nodeType !== 9) return null;
          if (node.nodeType === 9) {
            const obj = {};
            Array.from(node.childNodes).filter((n) => n.nodeType === 1).forEach((n) => { obj[n.tagName] = xmlToJson(n); });
            return obj;
          }
          const obj = {};
          Array.from(node.attributes).forEach((a) => { obj['@' + a.name] = a.value; });
          const kids = Array.from(node.childNodes).filter((n) => n.nodeType === 1);
          const text = Array.from(node.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue.trim()).join('');
          if (text) obj['#text'] = text;
          kids.forEach((k) => {
            const v = xmlToJson(k);
            if (obj[k.tagName] === undefined) obj[k.tagName] = v;
            else if (!Array.isArray(obj[k.tagName])) obj[k.tagName] = [obj[k.tagName], v];
            else obj[k.tagName].push(v);
          });
          return obj;
        }
        function work(action) {
          const text = ta.value.trim();
          if (!text) { msg.textContent = 'Введите XML.'; return; }
          try {
            const doc = parseXML(text);
            let result = '';
            if (action === 'format') result = fmtNode(doc, 0).trim();
            else if (action === 'min') result = new XMLSerializer().serializeToString(doc).replace(/>\s+</g, '><').trim();
            else if (action === 'json') result = JSON.stringify(xmlToJson(doc), null, 2);
            else result = JSON.stringify(xmlToJson(doc));
            out.textContent = result;
            stat.textContent = `${fmtBytes(new Blob([result]).size)} · ${result.split('\n').length} строк`;
            msg.innerHTML = '<span class="ok-text">✓ XML корректен</span>';
          } catch (e) {
            out.textContent = '';
            msg.innerHTML = `<span class="error-text">✕ ${esc(e.message || e)}</span>`;
          }
        }
        $('#xFmt', root).onclick = () => work('format');
        $('#xMin', root).onclick = () => work('min');
        $('#xJson', root).onclick = () => work('json');
        $('#xCplx', root).onclick = () => work('jsonc');
        $('#xSave', root).onclick = () => { if (out.textContent) saveText('data.txt', out.textContent); };
        $('#xSample', root).onclick = () => {
          ta.value = `<?xml version="1.0" encoding="UTF-8"?>\n<catalog>\n  <book id="bk101">\n    <author>Герберт Шилдт</author>\n    <title>Java: руководство</title>\n    <price currency="RUB">1200</price>\n    <tags><tag>java</tag><tag>book</tag></tags>\n  </book>\n  <book id="bk102">\n    <author>Роберт Мартин</author>\n    <title>Чистый код</title>\n    <price currency="RUB">1500</price>\n  </book>\n</catalog>`;
          work('format');
        };
        ta.addEventListener('input', D.debounce(() => { if (ta.value.trim()) work('format'); }, 500));
      }
    }
  ]);
})();