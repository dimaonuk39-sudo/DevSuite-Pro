/* DevSuite Pro — Telegram Bot console */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, store, fmtDate } = D;

  const METHOD_DEFAULTS = {
    getMe: {},
    getUpdates: { offset: 0, limit: 10, timeout: 0 },
    sendMessage: { chat_id: '', text: 'Привет из DevSuite Pro!', parse_mode: 'HTML' },
    sendPhoto: { chat_id: '', photo: 'https://picsum.photos/600/400', caption: 'DevSuite' },
    sendDocument: { chat_id: '', document: 'https://example.com/file.pdf' },
    sendLocation: { chat_id: '', latitude: 55.7558, longitude: 37.6173 },
    sendPoll: { chat_id: '', question: 'DevSuite?', options: ['Да', 'Нет'] },
    sendChatAction: { chat_id: '', action: 'typing' },
    getChat: { chat_id: '' },
    getChatMemberCount: { chat_id: '' },
    getChatAdministrators: { chat_id: '' },
    setWebhook: { url: 'https://example.com/telegram/webhook' },
    deleteWebhook: { drop_pending_updates: false },
    getWebhookInfo: {},
    answerCallbackQuery: { callback_query_id: '' },
    editMessageText: { chat_id: '', message_id: 0, text: 'edited' },
    deleteMessage: { chat_id: '', message_id: 0 }
  };

  D.registerTools([
    {
      id: 'telegram', name: 'Telegram Bot', icon: '✈', cat: 'api', badge: 'core',
      desc: 'Проверка токена, отправка сообщений, getUpdates, webhook и Bot API',
      render(root) {
        root.innerHTML = `
          <div class="panel-soft mb">
            <div class="row">
              <div class="field" style="flex:1;min-width:240px"><span>Bot Token (от @BotFather)</span>
                <input id="tgToken" class="mono" type="password" placeholder="123456789:AAH..." value="${esc(store.get('tg.token', ''))}">
              </div>
              <label class="check" style="margin-top:15px"><input type="checkbox" id="tgShow"> показать</label>
              <button class="btn btn-primary" id="tgCheck" style="margin-top:15px">Проверить токен</button>
              <span class="hint" id="tgCheckMsg"></span>
            </div>
            <div class="hint mt-sm">Токен хранится локально. Не публикуйте его. Все запросы идут на api.telegram.org.</div>
          </div>
          <div id="tgBotInfo" class="mb"></div>
          <div data-tabgroup="tg">
            <div class="tabs">
              <button class="tab is-active" data-tab="message">Сообщение</button>
              <button class="tab" data-tab="api">Bot API</button>
              <button class="tab" data-tab="updates">Updates</button>
            </div>
            <div class="tab-pane is-active" data-pane="message">
              <div class="split-wide">
                <div>
                  <div class="form-grid">
                    <div class="field"><span>Chat ID / @username</span><input id="tgChat" class="mono" value="${esc(store.get('tg.chat', ''))}" placeholder="123456789 или @channel"></div>
                    <div class="field"><span>Parse mode</span><select id="tgParse"><option value="">без разметки</option><option value="HTML" selected>HTML</option><option value="MarkdownV2">MarkdownV2</option></select></div>
                  </div>
                  <div class="field mt"><span>Сообщение</span>
                    <textarea id="tgText" class="mono" style="min-height:130px" placeholder="Текст сообщения...">Привет! Это сообщение отправлено из <b>DevSuite Pro</b> 🚀</textarea>
                  </div>
                  <div class="toolbar mt">
                    <button class="btn btn-primary" id="tgSend">Отправить</button>
                    <label class="check"><input type="checkbox" id="tgNoPreview" checked> без превью ссылок</label>
                    <span class="hint" id="tgSendMsg"></span>
                  </div>
                </div>
                <div>
                  <div class="out-label"><span class="label">Лог чата</span><button class="btn btn-sm" id="tgClearLog">Очистить</button></div>
                  <div id="tgLog" class="list" style="max-height:420px;overflow:auto"><div class="hint">Отправьте сообщение — здесь появится ответ API.</div></div>
                </div>
              </div>
            </div>
            <div class="tab-pane" data-pane="api">
              <div class="split">
                <div>
                  <div class="field mb"><span>Метод Bot API</span>
                    <select id="tgMethod">${Object.keys(METHOD_DEFAULTS).map((m) => `<option>${m}</option>`).join('')}</select>
                  </div>
                  <div class="field"><span>JSON параметры</span>
                    <textarea id="tgParams" class="mono" style="min-height:220px" spellcheck="false"></textarea>
                  </div>
                  <div class="toolbar mt">
                    <button class="btn btn-primary" id="tgCall">Вызвать метод</button>
                    <span class="hint" id="tgCallMsg"></span>
                  </div>
                </div>
                <div>
                  <div class="out-label"><span class="label">Ответ</span><button class="btn btn-sm" data-copy-target="#tgResp">Копировать</button></div>
                  <div class="code" id="tgResp" style="min-height:260px;max-height:520px">—</div>
                  <div class="hint mt-sm">Документация: <a href="https://core.telegram.org/bots/api" data-ext="https://core.telegram.org/bots/api">core.telegram.org/bots/api</a></div>
                </div>
              </div>
            </div>
            <div class="tab-pane" data-pane="updates">
              <div class="toolbar mb">
                <button class="btn btn-primary" id="tgGetUpdates">Получить обновления</button>
                <label class="check"><input type="checkbox" id="tgAuto"> автообновление (3 с)</label>
                <button class="btn" id="tgClearUpdates">Очистить</button>
                <span class="spacer"></span>
                <span class="hint" id="tgOffset"></span>
              </div>
              <div id="tgUpdates" class="list"><div class="hint">Нажмите «Получить обновления». Сюда попадут новые сообщения боту, callback-запросы и посты каналов.</div></div>
            </div>
          </div>`;
        const token = $('#tgToken', root), info = $('#tgBotInfo', root);
        let updatesOffset = 0;
        let autoTimer = null;

        function saveToken() { store.set('tg.token', token.value.trim()); }
        token.addEventListener('input', D.debounce(saveToken, 300));
        $('#tgShow', root).onchange = () => { token.type = $('#tgShow', root).checked ? 'text' : 'password'; };

        async function api(method, params) {
          const t = token.value.trim();
          if (!t) throw new Error('Укажите Bot Token');
          if (!/^\d+:[\w-]+$/.test(t)) throw new Error('Токен выглядит некорректно (ожидается 123456:AA...)');
          const res = await D.http({
            method: 'POST',
            url: `https://api.telegram.org/bot${t}/${method}`,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params || {}),
            timeout: 90000
          });
          let data;
          try { data = JSON.parse(res.text); }
          catch (_) { throw new Error('Telegram вернул не JSON (HTTP ' + res.status + ')'); }
          if (!data.ok) {
            let msg = data.description || ('HTTP ' + res.status);
            if (res.status === 401) msg = 'Неверный Bot Token (401 Unauthorized)';
            throw new Error(msg);
          }
          return { result: data.result, raw: data, time: res.time };
        }

        $('#tgCheck', root).onclick = async () => {
          const msg = $('#tgCheckMsg', root);
          msg.textContent = 'Проверка…';
          try {
            const { result } = await api('getMe', {});
            saveToken();
            msg.innerHTML = '<span class="ok-text">✓ токен действителен</span>';
            info.innerHTML = `
              <div class="panel-soft">
                <div class="row-between">
                  <div class="row">
                    <div class="tool-icon" style="background:rgba(34,211,238,.1)">✈</div>
                    <div><b>@${esc(result.username || '—')}</b><div class="hint">${esc(result.first_name || '')} ${esc(result.last_name || '')}</div></div>
                  </div>
                  <div class="row">
                    <span class="chip ok">бот активен</span>
                    <span class="chip">id: ${result.id}</span>
                    <button class="btn btn-sm" id="tgCopyBot">⧉ username</button>
                  </div>
                </div>
                <div class="hint mt-sm">Группы: ${result.can_join_groups ? 'да' : 'нет'} · читает все сообщения: ${result.can_read_all_group_messages ? 'да' : 'нет'} · inline: ${result.supports_inline_queries ? 'да' : 'нет'}</div>
              </div>`;
            $('#tgCopyBot', root).onclick = () => copy('@' + result.username);
          } catch (e) {
            info.innerHTML = '';
            msg.innerHTML = `<span class="error-text">✕ ${esc(e.message)}</span>`;
          }
        };

        function addLog(kind, title, text, extra) {
          const log = $('#tgLog', root);
          if (log.querySelector('.hint') && !log.querySelector('.list-item')) log.innerHTML = '';
          const el = document.createElement('div');
          el.className = 'list-item';
          el.style.alignItems = 'flex-start';
          el.innerHTML = `<span class="chip ${kind === 'ok' ? 'ok' : kind === 'err' ? 'err' : 'accent'}" style="min-width:44px;justify-content:center">${kind === 'ok' ? '✓' : kind === 'err' ? '!' : '→'}</span>
            <div class="grow"><b>${esc(title)}</b><div class="hint" style="white-space:pre-wrap">${esc(text || '')}</div>${extra ? `<div class="hint">${esc(extra)}</div>` : ''}</div>
            <span class="hint" style="flex:0 0 52px;text-align:right">${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>`;
          log.prepend(el);
        }

        $('#tgSend', root).onclick = async () => {
          const chat = $('#tgChat', root).value.trim();
          const text = $('#tgText', root).value;
          const msg = $('#tgSendMsg', root);
          if (!chat) { msg.innerHTML = '<span class="error-text">Укажите chat_id</span>'; return; }
          if (!text) { msg.innerHTML = '<span class="error-text">Введите текст</span>'; return; }
          store.set('tg.chat', chat);
          msg.textContent = 'Отправка…';
          try {
            const params = { chat_id: chat, text: text };
            const pm = $('#tgParse', root).value;
            if (pm) params.parse_mode = pm;
            if ($('#tgNoPreview', root).checked) params.link_preview_options = { is_disabled: true };
            const { result, time } = await api('sendMessage', params);
            msg.innerHTML = `<span class="ok-text">✓ отправлено · message_id ${result.message_id}</span>`;
            addLog('ok', 'Вы → ' + chat, text, `${result.chat && result.chat.type ? 'chat: ' + result.chat.type : ''} · ${D.fmtMs(time)}`);
          } catch (e) {
            msg.innerHTML = `<span class="error-text">✕ ${esc(e.message)}</span>`;
            addLog('err', 'Ошибка отправки', e.message);
          }
        };

        $('#tgMethod', root).onchange = () => {
          $('#tgParams', root).value = JSON.stringify(METHOD_DEFAULTS[$('#tgMethod', root).value] || {}, null, 2);
        };
        $('#tgParams', root).value = JSON.stringify(METHOD_DEFAULTS.getMe, null, 2);
        $('#tgCall', root).onclick = async () => {
          const method = $('#tgMethod', root).value;
          let params;
          try { params = JSON.parse($('#tgParams', root).value || '{}'); }
          catch (e) { $('#tgCallMsg', root).innerHTML = `<span class="error-text">JSON: ${esc(e.message)}</span>`; return; }
          $('#tgCallMsg', root).textContent = 'Вызов…';
          try {
            const { result, raw, time } = await api(method, params);
            $('#tgResp', root).textContent = JSON.stringify(result, null, 2);
            $('#tgCallMsg', root).innerHTML = `<span class="ok-text">✓ ${method} · ${D.fmtMs(time)}</span>`;
            store.set('tg.token', token.value.trim());
          } catch (e) {
            $('#tgResp', root).textContent = 'Ошибка: ' + e.message;
            $('#tgCallMsg', root).innerHTML = `<span class="error-text">✕ ${esc(e.message)}</span>`;
          }
        };
        $('#tgMethod', root).dispatchEvent(new Event('change'));

        function renderUpdates(updates) {
          const box = $('#tgUpdates', root);
          if (!updates.length) { box.innerHTML = '<div class="hint">Нет новых обновлений</div>'; return; }
          box.innerHTML = updates.map((u) => {
            const msg = u.message || u.edited_message || u.channel_post || u.edited_channel_post || (u.callback_query && u.callback_query.message) || {};
            const from = msg.from || (u.callback_query && u.callback_query.from) || {};
            const chat = msg.chat || {};
            const text = msg.text || msg.caption || (u.callback_query ? '[callback] ' + u.callback_query.data : '[media]');
            const date = msg.date ? new Date(msg.date * 1000) : new Date();
            return `<div class="list-item" style="align-items:flex-start">
              <span class="chip accent">${esc((from.username || from.first_name || chat.title || 'chat').toString().slice(0, 14))}</span>
              <div class="grow">
                <div class="hint">chat_id: <b class="mono">${esc(chat.id || '—')}</b> · ${esc(chat.type || '')} · ${fmtDate(date)}</div>
                <div style="white-space:pre-wrap;margin-top:3px">${esc(text).slice(0, 900)}</div>
                <div class="hint">update_id: ${u.update_id}</div>
              </div>
              <button class="btn btn-sm" data-reply="${esc(chat.id || '')}">Ответить</button>
            </div>`;
          }).join('');
          box.querySelectorAll('[data-reply]').forEach((b) => {
            b.onclick = () => {
              $('#tgChat', root).value = b.dataset.reply;
              const tab = root.querySelector('[data-tabgroup="tg"] [data-tab="message"]');
              if (tab) tab.click();
            };
          });
        }

        async function getUpdates(silent) {
          if (autoTimer && !silent) { /* manual call while auto */ }
          try {
            const { result } = await api('getUpdates', { offset: updatesOffset, limit: 20, timeout: 0, allowed_updates: ['message', 'edited_message', 'channel_post', 'callback_query'] });
            if (result.length) {
              updatesOffset = Math.max(updatesOffset, ...result.map((u) => u.update_id + 1));
              renderUpdates(result.slice().reverse());
              $('#tgOffset', root).textContent = 'offset: ' + updatesOffset;
              toast(`Новых обновлений: ${result.length}`, 'ok');
            } else if (!silent) {
              $('#tgUpdates', root).innerHTML = '<div class="hint">Нет новых обновлений. Напишите боту в Telegram и проверьте снова.</div>';
              $('#tgOffset', root).textContent = 'offset: ' + updatesOffset;
            }
          } catch (e) {
            if (!silent) {
              $('#tgUpdates', root).innerHTML = `<div class="error-text">✕ ${esc(e.message)}</div>`;
              toast(e.message, 'err');
            }
          }
        }
        $('#tgGetUpdates', root).onclick = () => getUpdates(false);
        $('#tgClearUpdates', root).onclick = () => { $('#tgUpdates', root).innerHTML = '<div class="hint">Очищено</div>'; };
        $('#tgAuto', root).onchange = () => {
          if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
          if ($('#tgAuto', root).checked) {
            getUpdates(true);
            autoTimer = setInterval(() => {
              if (!document.body.contains(root)) { clearInterval(autoTimer); autoTimer = null; return; }
              if (!token.value.trim()) return;
              getUpdates(true);
            }, 3000);
          }
        };
        $('#tgClearLog', root).onclick = () => { $('#tgLog', root).innerHTML = '<div class="hint">Лог очищен</div>'; };
        root.querySelectorAll('[data-ext]').forEach((a) => {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            if (window.devsuite) window.devsuite.openExternal(a.dataset.ext);
            else window.open(a.dataset.ext, '_blank', 'noopener');
          });
        });
        if (token.value.trim()) setTimeout(() => $('#tgCheck', root).click(), 350);
      }
    }
  ]);
})();
