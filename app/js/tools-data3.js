/* DevSuite Pro — diff & regex */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast } = D;

  function diffSeq(a, b, eq) {
    const n = a.length, m = b.length, w = m + 1;
    if (n * m > 6000000) throw new Error('Слишком большой объём для точного diff (лимит ~6 млн ячеек). Уменьшите текст.');
    const dp = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i * w + j] = eq(a[i], b[j])
          ? dp[(i + 1) * w + j + 1] + 1
          : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
      }
    }
    const out = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (eq(a[i], b[j])) { out.push({ t: 'eq', a: a[i], b: b[j] }); i++; j++; }
      else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) out.push({ t: 'del', a: a[i++] });
      else out.push({ t: 'add', b: b[j++] });
    }
    while (i < n) out.push({ t: 'del', a: a[i++] });
    while (j < m) out.push({ t: 'add', b: b[j++] });
    return out;
  }

  function inlineDiff(a, b) {
    const ta = a.split(/(\s+)/), tb = b.split(/(\s+)/);
    let parts;
    try { parts = diffSeq(ta, tb, (x, y) => x === y); }
    catch (_) { return { left: esc(a), right: esc(b) }; }
    let left = '', right = '';
    for (const p of parts) {
      if (p.t === 'eq') { left += esc(p.a); right += esc(p.b); }
      else if (p.t === 'del') left += `<del>${esc(p.a)}</del>`;
      else right += `<ins>${esc(p.b)}</ins>`;
    }
    return { left, right };
  }

  D.registerTools([
    {
      id: 'diff', name: 'Diff Checker', icon: '±', cat: 'data',
      desc: 'Построчное и пословное сравнение текстов с подсветкой изменений',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="dRun">Сравнить</button>
            <button class="btn" id="dSwap">⇄ Поменять</button>
            <label class="check"><input type="checkbox" id="dWs"> игнорировать пробелы</label>
            <label class="check"><input type="checkbox" id="dCase"> игнорировать регистр</label>
            <label class="check"><input type="checkbox" id="dWord"> пословно</label>
            <span class="spacer"></span>
            <button class="btn btn-ghost" id="dSample">Пример</button>
          </div>
          <div class="split">
            <div><div class="out-label"><span class="label">Оригинал</span></div>
              <textarea id="dA" class="mono" style="min-height:210px" spellcheck="false" placeholder="Первая версия текста..."></textarea></div>
            <div><div class="out-label"><span class="label">Изменённая версия</span></div>
              <textarea id="dB" class="mono" style="min-height:210px" spellcheck="false" placeholder="Вторая версия текста..."></textarea></div>
          </div>
          <div class="out-label mt"><span class="label">Результат</span><span class="row" id="dStats"></span></div>
          <div class="diff-view" id="dOut"><div class="empty-state">Нажмите «Сравнить»</div></div>`;
        const A = $('#dA', root), B = $('#dB', root), out = $('#dOut', root), stats = $('#dStats', root);

        function run() {
          const a = A.value, b = B.value;
          if (a === b) { out.innerHTML = '<div class="empty-state">Тексты идентичны</div>'; stats.innerHTML = '<span class="chip ok">без изменений</span>'; return; }
          const norm = (s) => {
            let x = String(s);
            if ($('#dWs', root).checked) x = x.replace(/\s+/g, ' ').trim();
            if ($('#dCase', root).checked) x = x.toLowerCase();
            return x;
          };
          try {
            if ($('#dWord', root).checked) {
              const ta = a.split(/(\s+)/), tb = b.split(/(\s+)/);
              const parts = diffSeq(ta, tb, (x, y) => norm(x) === norm(y));
              let leftHtml = '', rightHtml = '', add = 0, del = 0;
              for (const p of parts) {
                if (p.t === 'eq') { leftHtml += esc(p.a); rightHtml += esc(p.b); }
                else if (p.t === 'del') { leftHtml += `<del>${esc(p.a)}</del>`; del++; }
                else { rightHtml += `<ins>${esc(p.b)}</ins>`; add++; }
              }
              out.innerHTML = `<div style="padding:12px"><div class="hint mb">Слева — удалённое, справа — добавленное</div><div class="split"><div class="code" style="max-height:420px">${leftHtml}</div><div class="code" style="max-height:420px">${rightHtml}</div></div></div>`;
              stats.innerHTML = `<span class="chip ok">+${add} слов</span><span class="chip err">−${del} слов</span>`;
            } else {
              const la = a.split(/\r?\n/), lb = b.split(/\r?\n/);
              const parts = diffSeq(la, lb, (x, y) => norm(x) === norm(y));
              let html = '';
              let lnA = 0, lnB = 0, add = 0, del = 0, same = 0;
              for (const p of parts) {
                if (p.t === 'eq') {
                  lnA++; lnB++; same++;
                  html += `<div class="diff-line"><span class="ln">${lnB}</span><span class="txt">${esc(p.b) || ' '}</span></div>`;
                } else if (p.t === 'del') {
                  lnA++; del++;
                  html += `<div class="diff-line del"><span class="ln">${lnA}</span><span class="txt">− ${esc(p.a) || ' '}</span></div>`;
                } else {
                  lnB++; add++;
                  html += `<div class="diff-line add"><span class="ln">${lnB}</span><span class="txt">+ ${esc(p.b) || ' '}</span></div>`;
                }
              }
              out.innerHTML = html;
              stats.innerHTML = `<span class="chip ok">+${add}</span><span class="chip err">−${del}</span><span class="chip">${same} без изменений</span>`;
            }
          } catch (e) { out.innerHTML = `<div class="empty-state error-text">${esc(e.message)}</div>`; }
        }

        $('#dRun', root).onclick = run;
        $('#dSwap', root).onclick = () => { const t = A.value; A.value = B.value; B.value = t; run(); };
        ['dWs', 'dCase', 'dWord'].forEach((id) => { $('#' + id, root).onchange = run; });
        $('#dSample', root).onclick = () => {
          A.value = 'DevSuite Pro 1.0\ntools: 30\napi: true\ntheme: dark\nsupport: windows';
          B.value = 'DevSuite Pro 1.1\ntools: 44\napi: true\ntheme: dark + light\nsupport: windows, android';
          run();
        };
      }
    },

    {
      id: 'regex', name: 'Regex Tester', icon: '.*', cat: 'data', badge: 'core',
      desc: 'Проверка регулярных выражений, группы, подсветка и замена',
      render(root) {
        root.innerHTML = `
          <div class="split-wide">
            <div>
              <div class="field mb">
                <span>Регулярное выражение</span>
                <div class="row" style="flex-wrap:nowrap">
                  <span class="mono muted">/</span>
                  <input id="rPattern" class="mono" placeholder="(\\w+)@(\\w+\\.\\w+)" spellcheck="false">
                  <span class="mono muted">/</span>
                  <input id="rFlags" class="mono" style="width:70px" value="gi" placeholder="gim">
                </div>
              </div>
              <div class="row mb">
                <label class="check"><input type="checkbox" data-flag="g" checked> g</label>
                <label class="check"><input type="checkbox" data-flag="i" checked> i</label>
                <label class="check"><input type="checkbox" data-flag="m"> m</label>
                <label class="check"><input type="checkbox" data-flag="s"> s</label>
                <label class="check"><input type="checkbox" data-flag="u"> u</label>
                <label class="check"><input type="checkbox" data-flag="y"> y</label>
                <span class="hint" id="rErr"></span>
              </div>
              <div class="field">
                <span>Тестовый текст</span>
                <textarea id="rText" class="mono" style="min-height:210px" spellcheck="false" placeholder="Вставьте текст для проверки..."></textarea>
              </div>
              <div class="out-label mt"><span class="label">Подсветка совпадений</span><span class="hint" id="rCount"></span></div>
              <div class="code" id="rHl" style="min-height:110px;max-height:260px"></div>
              <div class="field mt">
                <span>Замена</span>
                <input id="rRepl" class="mono" placeholder="$1@example.com — используйте $1, $2, $&">
              </div>
              <div class="out-label mt-sm"><span class="label">Результат замены</span><button class="btn btn-sm" data-copy-target="#rResult">Копировать</button></div>
              <div class="code" id="rResult"></div>
            </div>
            <div>
              <div class="panel-title">Совпадения <span class="hint" id="rTotal"></span></div>
              <div class="list" id="rMatches" style="max-height:420px;overflow:auto"><div class="hint">Нет данных</div></div>
              <div class="panel-title mt">Быстрые шаблоны</div>
              <div class="row">
                <button class="btn btn-sm" data-preset="email">Email</button>
                <button class="btn btn-sm" data-preset="url">URL</button>
                <button class="btn btn-sm" data-preset="ip">IPv4</button>
                <button class="btn btn-sm" data-preset="date">Дата</button>
                <button class="btn btn-sm" data-preset="hex">HEX цвет</button>
                <button class="btn btn-sm" data-preset="phone">Телефон</button>
              </div>
              <div class="hint mt">Совет: включите флаг g, чтобы найти все совпадения. Замена поддерживает $1…$9, $&amp; и $&lt;name&gt;.</div>
            </div>
          </div>`;
        const pat = $('#rPattern', root), flagsIn = $('#rFlags', root), text = $('#rText', root), err = $('#rErr', root),
          hl = $('#rHl', root), repl = $('#rRepl', root), result = $('#rResult', root), matches = $('#rMatches', root),
          count = $('#rCount', root), total = $('#rTotal', root);

        function currentFlags() { return flagsIn.value.replace(/[^gimsuy]/g, ''); }
        function syncFlags() {
          flagsIn.value = Array.from(root.querySelectorAll('[data-flag]')).filter((c) => c.checked).map((c) => c.dataset.flag).join('');
          run();
        }
        root.querySelectorAll('[data-flag]').forEach((c) => { c.onchange = syncFlags; });
        flagsIn.addEventListener('input', () => {
          const f = currentFlags();
          root.querySelectorAll('[data-flag]').forEach((c) => { c.checked = f.includes(c.dataset.flag); });
          run();
        });

        function run() {
          err.textContent = '';
          const pattern = pat.value;
          if (!pattern) { hl.textContent = ''; matches.innerHTML = '<div class="hint">Введите шаблон</div>'; count.textContent = ''; total.textContent = ''; result.textContent = ''; return; }
          let re;
          try { re = new RegExp(pattern, currentFlags()); }
          catch (e) { err.innerHTML = `<span class="error-text">${esc(e.message)}</span>`; return; }
          const src = text.value;
          let list = [];
          try {
            const gre = new RegExp(pattern, currentFlags().includes('g') ? currentFlags() : currentFlags() + 'g');
            let m, guard = 0;
            while ((m = gre.exec(src)) !== null) {
              list.push({ value: m[0], index: m.index, groups: m.slice(1), named: m.groups || null });
              if (m[0].length === 0) gre.lastIndex++;
              if (++guard > 5000) break;
            }
          } catch (e) { err.innerHTML = `<span class="error-text">${esc(e.message)}</span>`; return; }

          let html = '', last = 0;
          for (const m of list) {
            if (m.index < last) continue;
            html += esc(src.slice(last, m.index));
            if (!m.value) html += '<mark class="zero" title="пустое совпадение">|</mark>';
            else html += `<mark>${esc(m.value)}</mark>`;
            last = m.index + m.value.length;
          }
          html += esc(src.slice(last));
          hl.innerHTML = src ? html : '<span class="hint">Введите текст</span>';
          count.textContent = list.length + ' совпадений';
          total.textContent = list.length ? `(${list.length})` : '';
          matches.innerHTML = list.length ? list.map((m, i) => `
            <div class="list-item" style="align-items:flex-start">
              <span class="chip accent">${i + 1}</span>
              <div class="grow">
                <div class="mono" style="word-break:break-all">${esc(m.value) || '<span class="muted">∅ (пусто)</span>'}</div>
                <div class="hint">индекс ${m.index}${m.groups.length ? ' · группы: ' + m.groups.map((g) => esc(g === undefined ? '—' : g)).join(' | ') : ''}</div>
              </div>
            </div>`).join('') : '<div class="hint">Совпадений нет</div>';

          try {
            result.textContent = src.replace(re, repl.value);
          } catch (e) { result.textContent = 'Ошибка замены: ' + e.message; }
        }

        pat.addEventListener('input', D.debounce(run, 200));
        text.addEventListener('input', D.debounce(run, 250));
        repl.addEventListener('input', D.debounce(run, 250));

        const presets = {
          email: ['([\\w.+-]+)@([\\w-]+\\.[\\w.]+)', 'alice@example.com, bob.smith@mail.ru, invalid@'],
          url: ['https?:\\/\\/[^\\s"\'<>]+', 'Сайт: https://devsuite.pro/docs?x=1 и http://localhost:8080/api'],
          ip: ['\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', 'IP: 192.168.1.1, 10.0.0.255, 999.1.1.1'],
          date: ['\\b(\\d{4})-(\\d{2})-(\\d{2})\\b', 'Даты: 2026-11-19, 2024-01-05, 19.11.2026'],
          hex: ['#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b', 'Цвета: #7c5cff, #22d3ee, #fff, #12345'],
          phone: ['\\+?7?[\\s(-]?\\d{3}[\\s)-]?\\d{3}[\\s-]?\\d{2}[\\s-]?\\d{2}', 'Телефоны: +7 999 123-45-67, 8 (800) 555-35-35']
        };
        root.querySelectorAll('[data-preset]').forEach((b) => {
          b.onclick = () => {
            const p = presets[b.dataset.preset];
            if (!p) return;
            pat.value = p[0]; text.value = p[1]; repl.value = '';
            flagsIn.value = 'g'; syncFlags();
          };
        });
      }
    }
  ]);
})();
