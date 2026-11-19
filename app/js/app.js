/* DevSuite Pro — application shell, routing, command palette */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, $$, toast, store } = D;

  const view = $('#view');
  const sidebar = $('#sidebar');
  const scrim = $('#scrim');
  const palette = $('#palette');
  const paletteInput = $('#paletteInput');
  const paletteResults = $('#paletteResults');
  const paletteCount = $('#paletteCount');
  const crumbs = $('#crumbs');

  let pItems = [];
  let pIndex = 0;

  /* ------------------------------ theme ------------------------------ */
  function effectiveTheme() {
    const t = store.get('ui.theme', 'dark');
    if (t === 'system') {
      try { return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch (_) { return 'dark'; }
    }
    return t === 'light' ? 'light' : 'dark';
  }
  function applyTheme() {
    const light = effectiveTheme() === 'light';
    document.body.classList.toggle('light', light);
    const btn = $('#themeBtn');
    if (btn) { btn.textContent = light ? '☀' : '◐'; btn.title = light ? 'Тёмная тема' : 'Светлая тема'; }
  }
  function setTheme(t) {
    store.set('ui.theme', ['dark', 'light', 'system'].includes(t) ? t : 'dark');
    applyTheme();
  }
  function rgba(hex, alpha) {
    const h = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(h)) return 'rgba(124, 92, 255, ' + alpha + ')';
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  function setAccent(hex) {
    const color = /^#[0-9a-f]{6}$/i.test(String(hex)) ? hex : '#7c5cff';
    store.set('ui.accent', color);
    document.body.style.setProperty('--accent', color);
    document.body.style.setProperty('--accent-soft', rgba(color, document.body.classList.contains('light') ? .1 : .14));
    document.documentElement.style.setProperty('--accent', color);
  }
  function applyUiPrefs() {
    applyTheme();
    setAccent(store.get('ui.accent', '#7c5cff'));
    document.body.classList.toggle('compact', !!store.get('ui.compact', false));
    document.body.classList.toggle('reduce-motion', !!store.get('ui.reduceMotion', false));
  }

  /* --------------------------- navigation --------------------------- */
  function visibleTools() { return D.tools.filter((t) => !t.hidden); }
  function toolsOfCat(id) { return visibleTools().filter((t) => t.cat === id); }

  function buildSidebar() {
    const box = $('#navCategories');
    box.innerHTML = D.CATEGORIES.map((c) => {
      const count = toolsOfCat(c.id).length;
      return `<button class="nav-item" data-cat="${c.id}">
        <span class="nav-ico">${esc(c.icon)}</span><span>${esc(c.name)}</span>
        <span class="nav-count">${count}</span>
      </button>`;
    }).join('');
    $('#toolCountLabel').textContent = `${visibleTools().length} инструментов · v1.0.0`;
    $('#platformLabel').textContent = D.platformLabel;
  }

  function setActiveNav(kind, id) {
    $$('.nav-item', sidebar).forEach((b) => b.classList.remove('is-active'));
    if (kind === 'home') {
      const b = $('[data-nav="home"]', sidebar); if (b) b.classList.add('is-active');
      return;
    }
    if (kind === 'settings' || kind === 'about') {
      const b = $('[data-nav="' + kind + '"]', sidebar); if (b) b.classList.add('is-active');
      return;
    }
    if (kind === 'cat') {
      const b = $('[data-cat="' + id + '"]', sidebar); if (b) b.classList.add('is-active');
    }
  }

  function setCrumbs(parts) {
    crumbs.innerHTML = parts.map((p, i) => {
      if (i === parts.length - 1) return `<b>${esc(p.name)}</b>`;
      const attr = p.tool ? ` data-tool="${esc(p.tool)}"` : p.cat ? ` data-goto-cat="${esc(p.cat)}"` : '';
      return `<span style="cursor:${attr ? 'pointer' : 'default'}"${attr}>${esc(p.name)}</span><span class="sep">/</span>`;
    }).join('');
  }

  function closeSidebar() { document.body.classList.remove('nav-open'); }

  /* ----------------------------- home ----------------------------- */
  function toolCard(t) {
    return `<button class="tool-card" data-tool="${esc(t.id)}">
      <div class="tool-icon">${esc(t.icon || '•')}</div>
      <div class="tool-meta"><b>${esc(t.name)}</b><span>${esc(t.desc || '')}</span></div>
      ${t.badge ? `<span class="badge">${esc(t.badge)}</span>` : ''}
    </button>`;
  }

  function renderHome() {
    setActiveNav('home');
    setCrumbs([{ name: 'Главная' }]);
    document.title = 'DevSuite Pro — инструменты разработчика';

    const quick = [
      ['http', '⇄', 'HTTP Client', 'REST, GraphQL, cURL, история'],
      ['ai', '✦', 'AI Chat', 'OpenAI, DeepSeek, Gemini, Ollama'],
      ['telegram', '✈', 'Telegram Bot', 'Отправка, getUpdates, webhook'],
      ['ws', '⇆', 'WebSocket', 'ws:// и wss:// в реальном времени'],
      ['json', '{}', 'JSON Studio', 'Формат, дерево, JSONPath'],
      ['jwt', '◇', 'JWT Decoder', 'Header, payload, подпись'],
      ['hash', '#', 'Hash & HMAC', 'MD5, SHA, файлы'],
      ['qr', '▣', 'QR Generator', 'PNG и Wi-Fi шаблоны']
    ].filter(([id]) => D.toolMap.has(id));

    const favIds = store.get('ui.favorites', []);
    const favorites = (Array.isArray(favIds) ? favIds : []).map((id) => D.toolMap.get(id)).filter((t) => t && !t.hidden);
    const recentIds = store.get('ui.recentTools', []);
    const recents = (Array.isArray(recentIds) ? recentIds : []).map((id) => D.toolMap.get(id)).filter((t) => t && !t.hidden);
    const showRecents = store.get('ui.recentsEnabled', true) !== false;

    const sections = D.CATEGORIES.map((c) => {
      const list = toolsOfCat(c.id);
      if (!list.length) return '';
      return `<section>
        <div class="section-head">
          <h2><span class="sec-ico">${esc(c.icon)}</span>${esc(c.name)}</h2>
          <span class="hint">${list.length} ${list.length === 1 ? 'инструмент' : list.length < 5 ? 'инструмента' : 'инструментов'} · ${esc(c.desc)}</span>
        </div>
        <div class="tool-grid">${list.map(toolCard).join('')}</div>
      </section>`;
    }).join('');

    view.innerHTML = `<div class="page">
      <div class="hero">
        <h1>Инструменты, которые <em>всегда под рукой</em></h1>
        <p>${visibleTools().length} инструментов разработчика в одном приложении: API-клиент с потоковыми ответами, AI-чат, Telegram-бот, WebSocket, работа с JSON/YAML/XML, криптография, генераторы и справочники. Все вычисления — локально.</p>
        <div class="hero-actions">
          <button class="btn btn-primary" data-tool="http">⇄ Открыть HTTP Client</button>
          <button class="btn" data-tool="ai">✦ AI Chat</button>
          <button class="btn" data-tool="telegram">✈ Telegram Bot</button>
          <button class="btn btn-ghost" id="homeSearch">⌕ Поиск инструментов <kbd>Ctrl K</kbd></button>
        </div>
        <div class="hero-stats">
          <div class="stat"><b>${visibleTools().length}</b><span>инструментов</span></div>
          <div class="stat"><b>${D.CATEGORIES.length}</b><span>категорий</span></div>
          <div class="stat"><b>${esc(D.isDesktop ? 'EXE' : D.isAndroid ? 'APK' : 'Web')}</b><span>${esc(D.platformLabel)}</span></div>
          <div class="stat"><b>offline</b><span>данные не уходят без запроса</span></div>
        </div>
      </div>

      <div class="quick-grid">
        ${quick.map(([id, ico, name, desc]) => `<button class="quick-card" data-tool="${id}">
          <div class="q-ico">${esc(ico)}</div><b>${esc(name)}</b><span>${esc(desc)}</span>
        </button>`).join('')}
      </div>

      ${showRecents && recents.length ? `<section>
        <div class="section-head">
          <h2><span class="sec-ico">◷</span>Недавние</h2>
          <button class="btn btn-ghost btn-sm" id="clearRecents">Очистить</button>
        </div>
        <div class="tool-grid">${recents.slice(0, 8).map(toolCard).join('')}</div>
      </section>` : ''}

      ${favorites.length ? `<section>
        <div class="section-head"><h2><span class="sec-ico">★</span>Избранное</h2><span class="hint">${favorites.length} инструментов</span></div>
        <div class="tool-grid">${favorites.map(toolCard).join('')}</div>
      </section>` : ''}

      ${sections}

      <div class="panel-soft mt">
        <div class="row-between">
          <div>
            <div class="panel-title" style="margin:0">DevSuite Pro · v1.0.0</div>
            <div class="hint">Клавиши: Ctrl+K — поиск, Esc — закрыть палитру. В EXE доступны DevTools по F12.</div>
          </div>
          <div class="row">
            <button class="btn btn-sm" data-tool="sysinfo">▤ Система</button>
            <button class="btn btn-sm" data-tool="settings">⚙ Настройки</button>
            <button class="btn btn-sm" data-tool="about">ⓘ О программе</button>
          </div>
        </div>
      </div>
    </div>`;

    const hs = $('#homeSearch');
    if (hs) hs.onclick = openPalette;
    const cr = $('#clearRecents');
    if (cr) cr.onclick = () => { store.set('ui.recentTools', []); renderHome(); };
    view.scrollTop = 0;
  }

  /* --------------------------- category --------------------------- */
  function renderCategory(catId) {
    const cat = D.CATEGORIES.find((c) => c.id === catId);
    if (!cat) { location.hash = '#/'; return; }
    setActiveNav('cat', cat.id);
    setCrumbs([{ name: 'Главная' }, { name: cat.name }]);
    document.title = cat.name + ' — DevSuite Pro';
    const list = toolsOfCat(cat.id);
    view.innerHTML = `<div class="page">
      <div class="tool-head">
        <div class="tool-icon">${esc(cat.icon)}</div>
        <div><h1 class="tool-title">${esc(cat.name)}</h1><div class="tool-desc">${esc(cat.desc)}</div></div>
        <div class="tool-head-actions"><span class="chip">${list.length} инструментов</span></div>
      </div>
      ${list.length ? `<div class="tool-grid">${list.map(toolCard).join('')}</div>` : '<div class="empty-state">В этой категории пока нет инструментов</div>'}
    </div>`;
    view.scrollTop = 0;
  }

  /* ----------------------------- tool ----------------------------- */
  function isFavorite(id) { return (store.get('ui.favorites', []) || []).includes(id); }
  function setFavorite(id, on) {
    let list = store.get('ui.favorites', []);
    if (!Array.isArray(list)) list = [];
    if (on) { if (!list.includes(id)) list.unshift(id); }
    else list = list.filter((x) => x !== id);
    store.set('ui.favorites', list);
  }
  function addRecent(id) {
    let list = store.get('ui.recentTools', []);
    if (!Array.isArray(list)) list = [];
    list = [id].concat(list.filter((x) => x !== id)).slice(0, 16);
    store.set('ui.recentTools', list);
  }

  function renderTool(tool) {
    const special = tool.id === 'settings' || tool.id === 'about';
    setActiveNav(special ? tool.id : 'cat', special ? tool.id : tool.cat);
    const cat = D.CATEGORIES.find((c) => c.id === tool.cat);
    setCrumbs([{ name: 'Главная' }, { name: cat ? cat.name : 'Прочее', cat: tool.cat }, { name: tool.name }]);
    document.title = tool.name + ' — DevSuite Pro';
    const fav = isFavorite(tool.id);
    view.innerHTML = `<div class="page">
      <div class="tool-head">
        <div class="tool-icon">${esc(tool.icon || '•')}</div>
        <div style="min-width:0">
          <h1 class="tool-title">${esc(tool.name)} ${tool.badge ? `<span class="badge">${esc(tool.badge)}</span>` : ''}</h1>
          <div class="tool-desc">${esc(tool.desc || '')}</div>
        </div>
        <div class="tool-head-actions">
          <button class="btn btn-ghost btn-sm" id="toolFav" title="Добавить в избранное">${fav ? '★ В избранном' : '☆ В избранное'}</button>
          <button class="btn btn-ghost btn-sm" id="toolLink" title="Скопировать ссылку">⧉ Ссылка</button>
        </div>
      </div>
      <div class="tool-body" id="toolBody"></div>
    </div>`;
    const body = $('#toolBody');
    try {
      tool.render(body);
    } catch (e) {
      body.innerHTML = `<div class="panel-soft"><div class="panel-title">Ошибка инструмента</div>
        <div class="error-text">${esc(e && e.message ? e.message : String(e))}</div>
        <pre class="code mt" style="max-height:260px">${esc(e && e.stack ? e.stack : '')}</pre>
        <button class="btn mt" id="toolReload">Перезагрузить</button></div>`;
      const rb = $('#toolReload'); if (rb) rb.onclick = () => location.reload();
      console.error('[DevSuite] tool render failed:', tool.id, e);
    }
    const favBtn = $('#toolFav');
    if (favBtn) favBtn.onclick = () => {
      const next = !isFavorite(tool.id);
      setFavorite(tool.id, next);
      favBtn.textContent = next ? '★ В избранном' : '☆ В избранное';
      toast(next ? 'Добавлено в избранное' : 'Удалено из избранного', 'ok');
    };
    const linkBtn = $('#toolLink');
    if (linkBtn) linkBtn.onclick = () => D.copy(location.href, 'Ссылка скопирована');
    addRecent(tool.id);
    view.scrollTop = 0;
  }

  function openTool(id) {
    const tool = D.toolMap.get(id);
    if (!tool) { toast('Инструмент не найден: ' + id, 'err'); return; }
    closePalette();
    closeSidebar();
    const hash = '#/t/' + encodeURIComponent(id);
    if (location.hash === hash) renderTool(tool);
    else location.hash = hash;
  }

  /* ---------------------------- routing ---------------------------- */
  function route() {
    const hash = location.hash || '#/';
    let m = /^#\/t\/([^/]+)\/?$/.exec(hash);
    if (m) {
      const tool = D.toolMap.get(decodeURIComponent(m[1]));
      if (tool) { renderTool(tool); return; }
      renderHome();
      toast('Инструмент не найден', 'err');
      return;
    }
    m = /^#\/c\/([^/]+)\/?$/.exec(hash);
    if (m) { renderCategory(decodeURIComponent(m[1])); return; }
    renderHome();
  }

  /* ---------------------------- palette ---------------------------- */
  function search(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) {
      return D.tools.slice().sort((a, b) => (b.badge === 'core' ? 1 : 0) - (a.badge === 'core' ? 1 : 0) || a.name.localeCompare(b.name, 'ru'));
    }
    const scored = [];
    for (const t of D.tools) {
      const name = t.name.toLowerCase(), id = t.id.toLowerCase(), desc = (t.desc || '').toLowerCase(), cat = t.catName.toLowerCase();
      let s = -1;
      if (name === q || id === q) s = 100;
      else if (name.startsWith(q)) s = 85;
      else if (id.startsWith(q)) s = 75;
      else if (name.includes(q)) s = 65;
      else if (id.includes(q)) s = 55;
      else if (desc.includes(q)) s = 40;
      else if (cat.includes(q)) s = 25;
      if (s > 0) scored.push({ t, s });
    }
    scored.sort((a, b) => b.s - a.s || a.t.name.localeCompare(b.t.name, 'ru'));
    return scored.map((x) => x.t);
  }

  function renderPalette(q) {
    pItems = search(q).slice(0, 40);
    pIndex = 0;
    paletteCount.textContent = pItems.length ? pItems.length + ' найдено' : '';
    if (!pItems.length) {
      paletteResults.innerHTML = '<div class="palette-empty">Ничего не найдено. Попробуйте «json», «api», «telegram» или «hash».</div>';
      return;
    }
    paletteResults.innerHTML = pItems.map((t, i) => `<div class="p-result ${i === 0 ? 'sel' : ''}" data-palette-tool="${esc(t.id)}">
      <span class="tool-icon">${esc(t.icon || '•')}</span>
      <div style="min-width:0"><b>${esc(t.name)}</b><span>${esc(t.desc || '')}</span></div>
      <span class="p-cat">${esc(t.catName)}</span>
    </div>`).join('');
  }
  function movePalette(delta) {
    if (!pItems.length) return;
    pIndex = (pIndex + delta + pItems.length) % pItems.length;
    $$('.p-result', paletteResults).forEach((el, i) => el.classList.toggle('sel', i === pIndex));
    const sel = $('.p-result.sel', paletteResults);
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    palette.hidden = false;
    paletteInput.value = '';
    renderPalette('');
    setTimeout(() => { try { paletteInput.focus(); } catch (_) {} }, 20);
  }
  function closePalette() {
    palette.hidden = true;
    paletteInput.value = '';
  }

  paletteInput.addEventListener('input', D.debounce(() => renderPalette(paletteInput.value), 60));
  palette.addEventListener('mousedown', (e) => {
    const row = e.target.closest('[data-palette-tool]');
    if (row) { e.preventDefault(); openTool(row.dataset.paletteTool); return; }
    if (e.target.closest('[data-close-palette]')) closePalette();
  });
  paletteResults.addEventListener('mouseover', (e) => {
    const row = e.target.closest('[data-palette-tool]');
    if (!row) return;
    const rows = $$('.p-result', paletteResults);
    pIndex = rows.indexOf(row);
    rows.forEach((el, i) => el.classList.toggle('sel', i === pIndex));
  });

  /* ------------------------- global events ------------------------- */
  const nav = $('#sidebarNav');
  nav.addEventListener('click', (e) => {
    const catBtn = e.target.closest('[data-cat]');
    if (catBtn) { location.hash = '#/c/' + encodeURIComponent(catBtn.dataset.cat); closeSidebar(); return; }
    const navBtn = e.target.closest('[data-nav]');
    if (!navBtn) return;
    const key = navBtn.dataset.nav;
    if (key === 'home') location.hash = '#/';
    else if (key === 'settings' || key === 'about') openTool(key);
    closeSidebar();
  });

  view.addEventListener('click', (e) => {
    const toolEl = e.target.closest('[data-tool]');
    if (toolEl) { openTool(toolEl.dataset.tool); return; }
    const catEl = e.target.closest('[data-goto-cat]');
    if (catEl) { location.hash = '#/c/' + encodeURIComponent(catEl.dataset.gotoCat); return; }
    if (e.target.closest('[data-home]')) { location.hash = '#/'; }
  });

  crumbs.addEventListener('click', (e) => {
    const toolEl = e.target.closest('[data-tool]');
    if (toolEl) { openTool(toolEl.dataset.tool); return; }
    const catEl = e.target.closest('[data-goto-cat]');
    if (catEl) location.hash = '#/c/' + encodeURIComponent(catEl.dataset.gotoCat);
  });

  $('#menuBtn').onclick = () => {
    document.body.classList.toggle('nav-open');
  };
  scrim.onclick = closeSidebar;
  $('#brand').onclick = () => { location.hash = '#/'; closeSidebar(); };
  $('#searchTrigger').onclick = openPalette;
  $('#aiQuick').onclick = () => openTool('ai');

  $('#themeBtn').onclick = () => {
    setTheme(document.body.classList.contains('light') ? 'dark' : 'light');
  };

  document.addEventListener('keydown', (e) => {
    const k = String(e.key || '').toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'k') {
      e.preventDefault();
      if (palette.hidden) openPalette(); else closePalette();
      return;
    }
    if (!palette.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (pItems[pIndex]) openTool(pItems[pIndex].id);
        else if (pItems.length === 1) openTool(pItems[0].id);
      }
      return;
    }
    if (e.key === 'Escape' && document.body.classList.contains('nav-open')) closeSidebar();
  });

  try {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (store.get('ui.theme', 'dark') === 'system') applyTheme();
    });
  } catch (_) {}

  window.addEventListener('hashchange', route);

  /* ----------------------------- init ----------------------------- */
  buildSidebar();
  applyUiPrefs();
  D.openTool = openTool;
  D.openPalette = openPalette;
  D.setTheme = setTheme;
  D.setAccent = setAccent;
  D.navigateHome = () => { location.hash = '#/'; };
  route();
})();
