/* DevSuite Pro — system, settings, about */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, store, saveText, fmtBytes, fmtDate } = D;

  function uptimeText(sec) {
    sec = Math.floor(Number(sec) || 0);
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    return (d ? d + ' д ' : '') + (h ? h + ' ч ' : '') + m + ' мин';
  }
  function openExternal(url) {
    if (window.devsuite) window.devsuite.openExternal(url);
    else window.open(url, '_blank', 'noopener');
  }
  function row(label, value, copyable) {
    return `<div class="list-item"><span class="grow"><span class="hint">${esc(label)}</span><div class="mono" style="word-break:break-all">${esc(value == null || value === '' ? '—' : value)}</div></span>${copyable ? `<button class="btn btn-sm" data-copy="${esc(String(value == null ? '' : value))}">⧉</button>` : ''}</div>`;
  }

  D.registerTools([
    {
      id: 'sysinfo', name: 'System Info', icon: '▤', cat: 'system',
      desc: 'Платформа, CPU, память, экран, сеть, версии Electron и WebView',
      render(root) {
        root.innerHTML = `
          <div class="toolbar mb">
            <button class="btn btn-primary" id="siRefresh">Обновить</button>
            <button class="btn" id="siCopy">Копировать отчёт</button>
            <span class="spacer"></span>
            <span class="hint" id="siTime"></span>
          </div>
          <div id="siHero" class="grid-2 mb"></div>
          <div class="split">
            <div>
              <div class="panel-soft"><div class="panel-title">Устройство</div><div id="siDevice" class="list"></div></div>
              <div class="panel-soft mt"><div class="panel-title">Экран и ввод</div><div id="siScreen" class="list"></div></div>
            </div>
            <div>
              <div class="panel-soft"><div class="panel-title">Память</div><div id="siMemory" class="list"></div></div>
              <div class="panel-soft mt"><div class="panel-title">Сеть</div><div id="siNetwork" class="list"></div></div>
              <div class="panel-soft mt"><div class="panel-title">Приложение</div><div id="siApp" class="list"></div></div>
            </div>
          </div>
          <div class="panel-soft mt">
            <div class="panel-title">Сетевые интерфейсы</div>
            <div id="siIfaces" class="hint">Нет данных</div>
          </div>`;
        let report = '';

        async function load() {
          const nav = navigator;
          const items = [];
          const now = new Date();
          $('#siTime', root).textContent = 'обновлено ' + now.toLocaleTimeString('ru-RU');

          let sys = null;
          if (window.devsuite) {
            try { sys = await window.devsuite.systemInfo(); } catch (_) {}
          }
          const platform = sys ? sys.platform : (nav.userAgentData ? nav.userAgentData.platform : nav.platform);
          const cores = nav.hardwareConcurrency || '—';
          const mem = nav.deviceMemory ? nav.deviceMemory + ' GB (оценка)' : (sys ? fmtBytes(sys.memoryTotal) : '—');
          const screenText = `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio}x`;
          const lang = nav.language || '—';
          const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '—';

          const hero = [
            ['Платформа', sys ? `${sys.platform} · ${sys.arch}` : D.platformLabel, '▤'],
            ['Устройство', sys ? sys.hostname : (nav.userAgentData ? nav.userAgentData.platform : 'Web'), '⌂'],
            ['Ядер CPU', String(cores), '⚙'],
            ['Память', mem, '▦'],
            ['Экран', screenText, '▭'],
            ['Часовой пояс', tz, '◷']
          ];
          $('#siHero', root).innerHTML = hero.map(([k, v, i]) => `<div class="panel-soft"><div class="row"><div class="tool-icon" style="flex-basis:32px;height:32px;font-size:14px">${i}</div><div><div class="hint">${esc(k)}</div><div class="mono" style="font-size:13px">${esc(v)}</div></div></div></div>`).join('');

          $('#siDevice', root).innerHTML = [
            ['ОС', sys ? `${sys.platform} ${sys.release}` : nav.platform],
            ['Архитектура', sys ? sys.arch : '—'],
            ['Имя устройства', sys ? sys.hostname : '—'],
            ['Пользователь', sys ? sys.user : '—'],
            ['Язык', lang],
            ['Локаль приложения', sys ? sys.locale : '—'],
            ['User-Agent', nav.userAgent]
          ].map(([k, v]) => row(k, v)).join('');

          $('#siScreen', root).innerHTML = [
            ['Разрешение', `${window.screen.width}×${window.screen.height}`],
            ['Доступная область', `${window.screen.availWidth}×${window.screen.availHeight}`],
            ['Pixel ratio', String(window.devicePixelRatio)],
            ['Цветовая глубина', window.screen.colorDepth + ' bit'],
            ['Touch points', String(nav.maxTouchPoints || 0)],
            ['Ориентация', window.screen.orientation ? window.screen.orientation.type : '—']
          ].map(([k, v]) => row(k, v)).join('');

          let storageLine = '—';
          try {
            if (nav.storage && nav.storage.estimate) {
              const est = await nav.storage.estimate();
              storageLine = `${fmtBytes(est.usage || 0)} из ${fmtBytes(est.quota || 0)}`;
            }
          } catch (_) {}
          $('#siMemory', root).innerHTML = [
            ['Всего RAM', sys ? fmtBytes(sys.memoryTotal) : (nav.deviceMemory ? nav.deviceMemory + ' GB' : '—')],
            ['Свободно RAM', sys ? fmtBytes(sys.memoryFree) : '—'],
            ['Использовано', sys ? fmtBytes(sys.memoryTotal - sys.memoryFree) : '—'],
            ['Uptime системы', sys ? uptimeText(sys.uptime) : '—'],
            ['Локальное хранилище', storageLine],
            ['Storage API', nav.storage && nav.storage.estimate ? 'доступен' : 'нет']
          ].map(([k, v]) => row(k, v)).join('');

          const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
          $('#siNetwork', root).innerHTML = [
            ['Online', nav.onLine ? 'да' : 'нет'],
            ['Тип соединения', conn ? (conn.effectiveType || conn.type || '—') : '—'],
            ['Скорость', conn && conn.downlink ? conn.downlink + ' Mbps' : '—'],
            ['RTT', conn && conn.rtt != null ? conn.rtt + ' мс' : '—'],
            ['Экономия трафика', conn && conn.saveData ? 'включена' : 'нет'],
            ['WebSocket', 'доступен']
          ].map(([k, v]) => row(k, v)).join('');

          const appRows = [
            ['Режим', D.platformLabel],
            ['Версия DevSuite', sys ? sys.appVersion : '1.0.0'],
            ['Инструментов', String(D.tools.length)],
            ['Electron', sys && sys.versions ? (sys.versions.electron || '—') : (window.devsuite ? window.devsuite.versions.electron : '—')],
            ['Chrome', (sys && sys.versions ? sys.versions.chrome : (window.devsuite ? window.devsuite.versions.chrome : nav.userAgent.match(/Chrome\/([\d.]+)/) ? nav.userAgent.match(/Chrome\/([\d.]+)/)[1] : '—'))],
            ['Node', sys && sys.versions ? (sys.versions.node || '—') : (window.devsuite ? window.devsuite.versions.node : '—')]
          ];
          if (sys && sys.paths) {
            appRows.push(['EXE', sys.paths.exe]);
            appRows.push(['UserData', sys.paths.userData]);
            appRows.push(['Downloads', sys.paths.downloads]);
          }
          $('#siApp', root).innerHTML = appRows.map(([k, v]) => row(k, v, k === 'EXE' || k === 'UserData')).join('');

          if (sys && sys.interfaces) {
            const entries = Object.entries(sys.interfaces).filter(([, list]) => list.length);
            $('#siIfaces', root).innerHTML = entries.length ? `<table class="kv-table">${entries.map(([name, list]) => list.map((n, i) => `<tr><td>${i === 0 ? esc(name) : ''}</td><td class="mono">${esc(n.address)}</td><td class="hint">${esc(n.family)}${n.internal ? ' · internal' : ''}</td><td class="mono hint">${esc(n.mac || '')}</td></tr>`).join('')).join('')}</table>` : '<span class="hint">Интерфейсы не найдены</span>';
          } else {
            $('#siIfaces', root).innerHTML = '<span class="hint">Детальная информация об интерфейсах доступна в EXE-версии.</span>';
          }

          report = [
            'DevSuite Pro — System Report',
            'Generated: ' + now.toISOString(),
            '',
            ...hero.map(([k, v]) => `${k}: ${v}`),
            '',
            ...appRows.map(([k, v]) => `${k}: ${v}`),
            '',
            'User-Agent: ' + nav.userAgent
          ].join('\n');
        }
        $('#siRefresh', root).onclick = load;
        $('#siCopy', root).onclick = () => copy(report || 'Нет данных', 'Отчёт скопирован');
        load();
      }
    },

    {
      id: 'settings', name: 'Settings', icon: '⚙', cat: 'system', hidden: true,
      desc: 'Тема, акцент, плотность интерфейса, экспорт и импорт всех настроек',
      render(root) {
        const theme = store.get('ui.theme', 'dark');
        const accent = store.get('ui.accent', '#7c5cff');
        const compact = store.get('ui.compact', false);
        const reduceMotion = store.get('ui.reduceMotion', false);
        const recents = store.get('ui.recentsEnabled', true) !== false;
        root.innerHTML = `
          <div class="split">
            <div>
              <div class="panel-soft">
                <div class="panel-title">Внешний вид</div>
                <div class="form-grid">
                  <div class="field"><span>Тема</span>
                    <select id="setTheme">
                      <option value="dark" ${theme === 'dark' ? 'selected' : ''}>Тёмная</option>
                      <option value="light" ${theme === 'light' ? 'selected' : ''}>Светлая</option>
                      <option value="system" ${theme === 'system' ? 'selected' : ''}>Как в системе</option>
                    </select>
                  </div>
                  <div class="field"><span>Плотность</span>
                    <select id="setCompact">
                      <option value="false" ${!compact ? 'selected' : ''}>Обычная</option>
                      <option value="true" ${compact ? 'selected' : ''}>Компактная</option>
                    </select>
                  </div>
                </div>
                <div class="field mt"><span>Акцентный цвет</span>
                  <div class="row" id="setAccents">
                    ${[['#7c5cff', ' violet'], ['#06b6d4', ' cyan'], ['#22c55e', ' green'], ['#f59e0b', ' amber'], ['#ec4899', ' pink'], ['#ef4444', ' red']].map(([c, n]) => `<button class="btn btn-sm" data-accent="${c}" style="border-color:${c};${accent === c ? 'box-shadow:0 0 0 2px ' + c + ' inset' : ''}"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c};margin-right:6px"></span>${n}</button>`).join('')}
                  </div>
                </div>
                <div class="stack mt">
                  <label class="check"><input type="checkbox" id="setMotion" ${reduceMotion ? 'checked' : ''}> уменьшить анимации</label>
                  <label class="check"><input type="checkbox" id="setRecents" ${recents ? 'checked' : ''}> показывать недавние инструменты на главной</label>
                </div>
              </div>

              <div class="panel-soft mt">
                <div class="panel-title">Хранилище и данные</div>
                <div class="hint" id="setStorage">—</div>
                <div class="toolbar mt">
                  <button class="btn btn-primary btn-sm" id="setExport">Экспорт всех настроек</button>
                  <button class="btn btn-sm" id="setImportBtn">Импорт из JSON</button>
                  <input type="file" id="setImport" accept="application/json,.json" hidden>
                  <button class="btn btn-sm btn-danger" id="setClearAll">Удалить все данные</button>
                </div>
                <div class="hint mt-sm">Экспорт включает историю HTTP-запросов, настройки AI и Telegram. Файл содержит токены и пароли — храните его в безопасном месте.</div>
              </div>

              <div class="panel-soft mt">
                <div class="panel-title">Ключи и сессии</div>
                <div class="list">
                  <div class="list-item"><span class="grow">AI API-ключи</span><code class="mono" id="setAiKeys">—</code><button class="btn btn-sm" id="setClearAi">Удалить</button></div>
                  <div class="list-item"><span class="grow">Telegram Bot Token</span><code class="mono" id="setTgKey">—</code><button class="btn btn-sm" id="setClearTg">Удалить</button></div>
                  <div class="list-item"><span class="grow">История HTTP</span><code class="mono" id="setHttpHist">—</code><button class="btn btn-sm" id="setClearHttp">Удалить</button></div>
                </div>
              </div>
            </div>

            <div>
              <div class="panel-soft">
                <div class="panel-title">Сочетания клавиш</div>
                <table class="kv-table">
                  <tr><td><kbd>Ctrl</kbd> + <kbd>K</kbd></td><td>Поиск инструментов</td></tr>
                  <tr><td><kbd>Enter</kbd></td><td>Отправить запрос / сообщение</td></tr>
                  <tr><td><kbd>Shift</kbd> + <kbd>Enter</kbd></td><td>Новая строка в чате</td></tr>
                  <tr><td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td><td>Отправить HTTP-запрос из тела</td></tr>
                  <tr><td><kbd>Esc</kbd></td><td>Закрыть поиск / палитру</td></tr>
                  <tr><td><kbd>F12</kbd></td><td>DevTools (только EXE)</td></tr>
                </table>
              </div>
              <div class="panel-soft mt">
                <div class="panel-title">О хранилище</div>
                <div class="hint" style="line-height:1.6">Все данные хранятся локально в <span class="mono">localStorage</span> WebView/Electron. Приложение не имеет собственного сервера и не отправляет данные куда-либо, кроме API, которые вы укажете сами (AI-провайдер, Telegram, HTTP-клиент, DNS-over-HTTPS).</div>
                <div class="hint mt">В EXE папка профиля: <span class="mono" id="setPath">—</span></div>
                <button class="btn btn-sm mt" id="setOpenData" style="display:none">Открыть папку данных</button>
              </div>
              <div class="panel-soft mt">
                <div class="panel-title">Сброс интерфейса</div>
                <div class="hint">Вернуть тему, акцент, плотность и недавние к стандартным значениям.</div>
                <button class="btn btn-sm mt" id="setResetUi">Сбросить интерфейс</button>
              </div>
            </div>
          </div>`;

        function refresh() {
          const all = store.all();
          const size = D.utf8(JSON.stringify(all)).length;
          $('#setStorage', root).textContent = `${store.keys().length} ключей · ${fmtBytes(size)} · ${D.platformLabel}`;
          const keys = store.get('ai.keys', {});
          const providers = Object.keys(keys).filter((k) => keys[k]);
          $('#setAiKeys', root).textContent = providers.length ? providers.join(', ') : 'не заданы';
          $('#setTgKey', root).textContent = store.get('tg.token', '') ? 'задан' : 'не задан';
          const hist = store.get('http.history', []);
          $('#setHttpHist', root).textContent = hist.length + ' записей';
        }
        refresh();

        function applyInstant() {
          store.set('ui.theme', $('#setTheme', root).value);
          store.set('ui.compact', $('#setCompact', root).value === 'true');
          store.set('ui.reduceMotion', $('#setMotion', root).checked);
          store.set('ui.recentsEnabled', $('#setRecents', root).checked);
          if (D.setTheme) D.setTheme($('#setTheme', root).value);
          document.body.classList.toggle('compact', $('#setCompact', root).value === 'true');
          document.body.classList.toggle('reduce-motion', $('#setMotion', root).checked);
        }
        ['setTheme', 'setCompact', 'setMotion', 'setRecents'].forEach((id) => { $('#' + id, root).onchange = applyInstant; });
        root.querySelectorAll('[data-accent]').forEach((b) => {
          b.onclick = () => {
            store.set('ui.accent', b.dataset.accent);
            if (D.setAccent) D.setAccent(b.dataset.accent);
            root.querySelectorAll('[data-accent]').forEach((x) => { x.style.boxShadow = x === b ? '0 0 0 2px ' + b.dataset.accent + ' inset' : ''; });
            toast('Акцент изменён', 'ok');
          };
        });

        $('#setExport', root).onclick = () => {
          const payload = { app: 'DevSuite Pro', version: '1.0.0', exportedAt: new Date().toISOString(), data: store.all() };
          saveText('devsuite-settings.json', JSON.stringify(payload, null, 2), 'application/json');
        };
        $('#setImportBtn', root).onclick = () => $('#setImport', root).click();
        $('#setImport', root).addEventListener('change', async () => {
          const f = $('#setImport', root).files[0];
          if (!f) return;
          try {
            const text = await D.readFile(f, 'text');
            const obj = JSON.parse(text);
            const data = obj && obj.data && typeof obj.data === 'object' ? obj.data : obj;
            if (!data || typeof data !== 'object') throw new Error('Неверный формат');
            if (!confirm('Импортировать ' + Object.keys(data).length + ' ключей? Текущие настройки с этими ключами будут перезаписаны.')) return;
            Object.entries(data).forEach(([k, v]) => store.set(k, v));
            toast('Настройки импортированы, перезагрузка…', 'ok');
            setTimeout(() => location.reload(), 700);
          } catch (e) { toast('Импорт не удался: ' + e.message, 'err'); }
        });
        $('#setClearAll', root).onclick = () => {
          if (!confirm('Удалить ВСЕ локальные данные DevSuite (ключи, историю, настройки)? Это действие необратимо.')) return;
          store.clear();
          toast('Все данные удалены', 'ok');
          setTimeout(() => location.reload(), 600);
        };
        $('#setClearAi', root).onclick = () => { store.del('ai.keys'); toast('AI-ключи удалены'); refresh(); };
        $('#setClearTg', root).onclick = () => { store.del('tg.token'); toast('Telegram-токен удалён'); refresh(); };
        $('#setClearHttp', root).onclick = () => { store.del('http.history'); toast('История HTTP удалена'); refresh(); };
        $('#setResetUi', root).onclick = () => {
          ['ui.theme', 'ui.accent', 'ui.compact', 'ui.reduceMotion', 'ui.recentsEnabled'].forEach((k) => store.del(k));
          if (D.setTheme) D.setTheme('dark');
          if (D.setAccent) D.setAccent('#7c5cff');
          document.body.classList.remove('compact', 'reduce-motion');
          toast('Интерфейс сброшен');
          $('#setTheme', root).value = 'dark';
          $('#setCompact', root).value = 'false';
          $('#setMotion', root).checked = false;
          $('#setRecents', root).checked = true;
        };
        if (window.devsuite) {
          window.devsuite.systemInfo().then((s) => {
            if (s && s.paths) {
              $('#setPath', root).textContent = s.paths.userData;
              const btn = $('#setOpenData', root);
              btn.style.display = '';
              btn.onclick = () => window.devsuite.showItem(s.paths.userData);
            }
          }).catch(() => {});
        }
      }
    },

    {
      id: 'about', name: 'About', icon: 'ⓘ', cat: 'system', hidden: true,
      desc: 'Версия, возможности, технологии и ссылки на документацию API',
      render(root) {
        const byCat = {};
        D.tools.forEach((t) => { byCat[t.cat] = (byCat[t.cat] || 0) + 1; });
        const catRows = D.CATEGORIES.map((c) => `<tr><td>${c.icon} ${esc(c.name)}</td><td class="mono">${byCat[c.id] || 0}</td><td class="hint">${esc(c.desc)}</td></tr>`).join('');
        root.innerHTML = `
          <div class="hero" style="margin-bottom:20px">
            <div class="row" style="gap:14px">
              <div class="tool-icon" style="flex-basis:58px;height:58px;border-radius:16px;font-size:24px;background:linear-gradient(135deg,rgba(124,92,255,.3),rgba(34,211,238,.18))">⌘</div>
              <div>
                <h1 style="margin:0;font-size:28px">DevSuite <em>Pro</em></h1>
                <div class="hint">Версия 1.0.0 · ${esc(D.platformLabel)} · ${D.tools.length} инструментов</div>
              </div>
            </div>
            <p style="margin-top:16px">Набор инструментов разработчика: API-клиент, AI-чат, Telegram Bot, WebSocket, кодирование, данные, генераторы и справочники. Всё работает локально, без собственного бэкенда.</p>
            <div class="hero-stats">
              <div class="stat"><b>${D.tools.length}</b><span>инструментов</span></div>
              <div class="stat"><b>${D.CATEGORIES.length}</b><span>категорий</span></div>
              <div class="stat"><b>100%</b><span>offline UI</span></div>
              <div class="stat"><b>v1.0.0</b><span>сборка 2026</span></div>
            </div>
            <div class="hero-actions" style="margin-top:20px">
              <button class="btn btn-primary" id="abStart">На главную</button>
              <button class="btn" id="abSettings">Настройки</button>
              <button class="btn" id="abCopy">Скопировать сведения</button>
            </div>
          </div>
          <div class="grid-2">
            <div class="panel-soft">
              <div class="panel-title">Инструменты по категориям</div>
              <table class="kv-table">${catRows}</table>
            </div>
            <div>
              <div class="panel-soft">
                <div class="panel-title">Технологии</div>
                <div class="list">
                  <div class="list-item"><span class="grow">UI</span><span class="chip accent">HTML · CSS · Vanilla JS</span></div>
                  <div class="list-item"><span class="grow">EXE</span><span class="chip">Electron 33</span></div>
                  <div class="list-item"><span class="grow">APK</span><span class="chip">Android WebView · Java</span></div>
                  <div class="list-item"><span class="grow">Отключённые библиотеки</span><span class="chip">marked · js-yaml · qrcode · jsQR · JsBarcode</span></div>
                  <div class="list-item"><span class="grow">Криптография</span><span class="chip">WebCrypto · AES-GCM · PBKDF2</span></div>
                </div>
              </div>
              <div class="panel-soft mt">
                <div class="panel-title">Документация API</div>
                <div class="stack">
                  <button class="btn btn-sm" data-open="https://core.telegram.org/bots/api">Telegram Bot API</button>
                  <button class="btn btn-sm" data-open="https://platform.openai.com/docs/api-reference">OpenAI API</button>
                  <button class="btn btn-sm" data-open="https://docs.anthropic.com/en/api">Anthropic API</button>
                  <button class="btn btn-sm" data-open="https://ai.google.dev/gemini-api/docs">Google Gemini API</button>
                  <button class="btn btn-sm" data-open="https://developer.mozilla.org/ru/docs/Web/API/WebSocket">MDN WebSocket</button>
                </div>
              </div>
            </div>
          </div>
          <div class="panel-soft mt">
            <div class="panel-title">Безопасность</div>
            <div class="hint" style="line-height:1.7">Токены и ключи хранятся в локальном хранилище приложения и отправляются только тем сервисам, для которых вы их указали. Приложение не собирает телеметрию. Для совместного использования устройства используйте отдельный профиль ОС и удаляйте ключи в настройках.</div>
          </div>`;
        $('#abStart', root).onclick = () => { location.hash = '#/'; };
        $('#abSettings', root).onclick = () => { if (D.openTool) D.openTool('settings'); };
        $('#abCopy', root).onclick = () => copy(`DevSuite Pro 1.0.0\n${D.platformLabel}\nИнструментов: ${D.tools.length}\nКатегорий: ${D.CATEGORIES.length}`, 'Сведения скопированы');
        root.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => openExternal(b.dataset.open); });
      }
    }
  ]);
})();
