/* DevSuite Pro — AI chat (OpenAI-compatible, Anthropic, Gemini) */
(function () {
  'use strict';
  const D = window.DS;
  const { esc, $, toast, copy, store, saveText } = D;

  const PRESETS = {
    openai: { name: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', kind: 'openai', key: true },
    deepseek: { name: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', kind: 'openai', key: true },
    openrouter: { name: 'OpenRouter', base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', kind: 'openai', key: true },
    groq: { name: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', kind: 'openai', key: true },
    mistral: { name: 'Mistral', base: 'https://api.mistral.ai/v1', model: 'mistral-large-latest', kind: 'openai', key: true },
    together: { name: 'Together', base: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', kind: 'openai', key: true },
    ollama: { name: 'Ollama (local)', base: 'http://localhost:11434/v1', model: 'llama3.2', kind: 'openai', key: false },
    lmstudio: { name: 'LM Studio (local)', base: 'http://localhost:1234/v1', model: 'local-model', kind: 'openai', key: false },
    anthropic: { name: 'Anthropic', base: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest', kind: 'anthropic', key: true },
    gemini: { name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash', kind: 'gemini', key: true },
    custom: { name: 'Custom (OpenAI-compatible)', base: 'https://api.example.com/v1', model: 'model-name', kind: 'openai', key: true }
  };

  const SUGGESTIONS = [
    'Объясни, что делает этот код, простыми словами',
    'Напиши SQL-запрос с JOIN и GROUP BY',
    'Придумай регулярное выражение для email',
    'Составь JSON-схему для REST API'
  ];

  D.registerTools([
    {
      id: 'ai', name: 'AI Chat', icon: '✧', cat: 'api', badge: 'core',
      desc: 'Чат с OpenAI, DeepSeek, OpenRouter, Groq, Anthropic, Gemini и локальными LLM',
      render(root) {
        const saved = store.get('ai.settings', { provider: 'openai', temperature: 0.7, maxTokens: 2048, stream: true, system: '' });
        const keys = store.get('ai.keys', {});
        const provider = PRESETS[saved.provider] ? saved.provider : 'openai';
        const preset = PRESETS[provider];
        let messages = store.get('ai.messages', []);
        if (!Array.isArray(messages)) messages = [];
        let streaming = false;
        let currentRequest = null;
        let lastUsage = '';

        root.innerHTML = `
          <details class="panel-soft mb" id="aiSettings" ${messages.length ? '' : 'open'}>
            <summary style="cursor:pointer;font-weight:700;font-size:13px">Настройки подключения <span class="hint" style="font-weight:400" id="aiProvLabel">${esc(preset.name)}</span></summary>
            <div class="form-grid mt">
              <div class="field"><span>Провайдер</span><select id="aiProvider">${Object.entries(PRESETS).map(([id, p]) => `<option value="${id}" ${id === provider ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
              <div class="field"><span>Модель</span><input id="aiModel" class="mono" value="${esc(saved.model || preset.model)}" list="aiModels"><datalist id="aiModels"><option value="gpt-4o-mini"><option value="gpt-4o"><option value="deepseek-chat"><option value="deepseek-reasoner"><option value="claude-3-5-sonnet-latest"><option value="gemini-2.0-flash"><option value="llama-3.3-70b-versatile"></datalist></div>
              <div class="field" style="grid-column:span 2"><span>Base URL</span><input id="aiBase" class="mono" value="${esc(saved.base || preset.base)}"></div>
              <div class="field" style="grid-column:span 2"><span>API Key</span><input id="aiKey" class="mono" type="password" value="${esc(keys[provider] || '')}" placeholder="${preset.key ? 'sk-...' : 'не требуется для локальной модели'}"></div>
              <div class="field"><span>Temperature</span><input id="aiTemp" type="number" min="0" max="2" step="0.1" value="${esc(saved.temperature ?? 0.7)}"></div>
              <div class="field"><span>Max tokens</span><input id="aiMax" type="number" min="64" max="32768" step="64" value="${esc(saved.maxTokens || 2048)}"></div>
              <label class="check" style="margin-top:15px"><input type="checkbox" id="aiStream" ${saved.stream !== false ? 'checked' : ''}> streaming</label>
              <label class="check" style="margin-top:15px"><input type="checkbox" id="aiShowKey"> показать ключ</label>
            </div>
            <div class="field mt"><span>System prompt</span><textarea id="aiSystem" class="mono" style="min-height:70px" placeholder="Ты — полезный ассистент...">${esc(saved.system || '')}</textarea></div>
            <div class="hint mt-sm">Ключи хранятся только на устройстве (localStorage) и отправляются напрямую выбранному провайдеру. Для локальных моделей запустите Ollama или LM Studio.</div>
          </details>

          <div class="panel" style="padding:0;overflow:hidden">
            <div class="row-between" style="padding:11px 15px;border-bottom:1px solid var(--border-soft)">
              <div class="row">
                <span class="chip accent" id="aiModelChip">${esc(saved.model || preset.model)}</span>
                <span class="hint" id="aiUsage">${messages.length ? messages.length + ' сообщений' : 'новый чат'}</span>
              </div>
              <div class="row">
                <button class="btn btn-sm" id="aiExport">Экспорт .md</button>
                <button class="btn btn-sm" id="aiClear">Новый чат</button>
              </div>
            </div>
            <div class="chat-box">
              <div class="chat-messages" id="aiMessages"></div>
              <div class="chat-compose">
                <textarea id="aiInput" placeholder="Спросите что угодно…  (Enter — отправить, Shift+Enter — новая строка)" spellcheck="false"></textarea>
                <div class="chat-actions">
                  <button class="btn btn-primary" id="aiSend">Отправить ➤</button>
                  <button class="btn btn-danger" id="aiStop" style="display:none">■ Стоп</button>
                  <button class="btn btn-ghost btn-sm" id="aiRegen" title="Повторить последний ответ">↻</button>
                  <span class="hint">Модель: <b id="aiModelMini">${esc(saved.model || preset.model)}</b></span>
                </div>
              </div>
            </div>
          </div>`;

        const providerSel = $('#aiProvider', root), base = $('#aiBase', root), model = $('#aiModel', root), key = $('#aiKey', root),
          temp = $('#aiTemp', root), maxTokens = $('#aiMax', root), streamBox = $('#aiStream', root), system = $('#aiSystem', root),
          messagesEl = $('#aiMessages', root), input = $('#aiInput', root), sendBtn = $('#aiSend', root), stopBtn = $('#aiStop', root);

        function currentKind() { return PRESETS[providerSel.value].kind; }

        function renderMessages() {
          if (!messages.length) {
            messagesEl.innerHTML = `
              <div class="msg">
                <div class="msg-avatar">✦</div>
                <div>
                  <div class="msg-bubble">
                    <p><b>DevSuite AI Chat</b></p>
                    <p>Подключите любой OpenAI-совместимый API, Anthropic или Gemini. Ключ и история остаются на устройстве.</p>
                    <p class="hint">Попробуйте:</p>
                    <div class="row" style="margin-top:4px">${SUGGESTIONS.map((s, i) => `<button class="btn btn-sm" data-sugg="${i}">${esc(s)}</button>`).join('')}</div>
                  </div>
                </div>
              </div>`;
            messagesEl.querySelectorAll('[data-sugg]').forEach((b) => { b.onclick = () => { input.value = SUGGESTIONS[b.dataset.sugg]; input.focus(); }; });
          } else {
            messagesEl.innerHTML = messages.map((m, i) => {
              const isUser = m.role === 'user';
              return `<div class="msg ${isUser ? 'user' : ''}" data-mid="${i}">
                <div class="msg-avatar">${isUser ? '🧑' : '✦'}</div>
                <div style="min-width:0">
                  <div class="msg-bubble">${isUser ? esc(m.content).replace(/\n/g, '<br>') : D.renderMarkdown(m.content)}</div>
                  <div class="msg-meta">${isUser ? 'вы' : 'assistant'}${!isUser ? ' · <button class="btn btn-ghost btn-sm" style="height:18px;padding:0 4px" data-msgcopy="' + i + '">копировать</button>' : ''}</div>
                </div>
              </div>`;
            }).join('');
            messagesEl.querySelectorAll('[data-msgcopy]').forEach((b) => { b.onclick = () => copy(messages[b.dataset.msgcopy].content); });
          }
          $('#aiUsage', root).textContent = lastUsage || (messages.length ? messages.length + ' сообщений' : 'новый чат');
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function persist() {
          store.set('ai.messages', messages.slice(-100));
          store.set('ai.settings', getSettings());
          const keysMap = store.get('ai.keys', {});
          keysMap[providerSel.value] = key.value;
          store.set('ai.keys', keysMap);
        }
        function getSettings() {
          return {
            provider: providerSel.value, base: base.value.trim(), model: model.value.trim(),
            temperature: Number(temp.value), maxTokens: Number(maxTokens.value),
            stream: streamBox.checked, system: system.value
          };
        }
        function applyProvider() {
          const p = PRESETS[providerSel.value];
          const keysMap = store.get('ai.keys', {});
          base.value = p.base;
          model.value = p.model;
          key.value = keysMap[providerSel.value] || '';
          $('#aiProvLabel', root).textContent = p.name;
          $('#aiModelChip', root).textContent = p.model;
          $('#aiModelMini', root).textContent = p.model;
          key.placeholder = p.key ? 'sk-...' : 'не требуется для локальной модели';
        }
        providerSel.onchange = applyProvider;
        model.oninput = () => { $('#aiModelChip', root).textContent = model.value; $('#aiModelMini', root).textContent = model.value; };
        $('#aiShowKey', root).onchange = () => { key.type = $('#aiShowKey', root).checked ? 'text' : 'password'; };
        [base, model, key, temp, maxTokens, streamBox, system].forEach((el) => el.addEventListener('input', D.debounce(persist, 400)));

        function errorMessage(data, fallback) {
          if (!data) return fallback;
          if (typeof data === 'string') return data.slice(0, 800);
          if (data.error) return typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
          if (data.message) return data.message;
          return fallback || JSON.stringify(data).slice(0, 800);
        }

        function buildRequest(settings, history) {
          const kind = PRESETS[settings.provider].kind;
          const headers = { 'Content-Type': 'application/json' };
          let url = settings.base.replace(/\/+$/, '');
          let body;
          if (kind === 'openai') {
            if (!/\/chat\/completions$/.test(url)) url += '/chat/completions';
            headers['Authorization'] = 'Bearer ' + key.value.trim();
            const msgs = [];
            if (settings.system.trim()) msgs.push({ role: 'system', content: settings.system.trim() });
            history.slice(-24).forEach((m) => msgs.push({ role: m.role, content: m.content }));
            body = { model: settings.model, messages: msgs, temperature: settings.temperature, stream: settings.stream };
            if (settings.maxTokens) body.max_tokens = settings.maxTokens;
          } else if (kind === 'anthropic') {
            if (!/\/messages$/.test(url)) url += '/messages';
            headers['x-api-key'] = key.value.trim();
            headers['anthropic-version'] = '2023-06-01';
            headers['anthropic-dangerous-direct-browser-access'] = 'true';
            body = {
              model: settings.model, max_tokens: settings.maxTokens || 2048,
              temperature: settings.temperature, stream: settings.stream,
              messages: history.slice(-24).filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }))
            };
            if (settings.system.trim()) body.system = settings.system.trim();
          } else {
            const method = settings.stream ? 'streamGenerateContent?alt=sse&key=' : 'generateContent?key=';
            url = `${url}/models/${encodeURIComponent(settings.model)}:${method}${encodeURIComponent(key.value.trim())}`;
            const contents = history.slice(-24).filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
            body = { contents, generationConfig: { temperature: settings.temperature, maxOutputTokens: settings.maxTokens || 2048 } };
            if (settings.system.trim()) body.systemInstruction = { parts: [{ text: settings.system.trim() }] };
          }
          return { url, headers, body, kind };
        }

        function extractFull(kind, data) {
          if (!data) return '';
          if (kind === 'openai') return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content || '' : '';
          if (kind === 'anthropic') return Array.isArray(data.content) ? data.content.map((c) => c.text || '').join('') : '';
          if (kind === 'gemini') {
            const c = data.candidates && data.candidates[0];
            if (!c || !c.content || !c.content.parts) return '';
            return c.content.parts.map((p) => p.text || '').join('');
          }
          return '';
        }
        function extractUsage(kind, data) {
          if (!data) return '';
          if (kind === 'openai' && data.usage) return `${data.usage.total_tokens || (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0)} токенов`;
          if (kind === 'anthropic' && data.usage) return `${(data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)} токенов`;
          if (kind === 'gemini' && data.usageMetadata) return `${data.usageMetadata.totalTokenCount || 0} токенов`;
          return '';
        }

        async function send(userText) {
          if (streaming) return;
          if (!userText && !messages.length) return;
          const settings = getSettings();
          if (!settings.model) { toast('Укажите модель', 'err'); return; }
          if (PRESETS[settings.provider].key && !key.value.trim()) { toast('Укажите API Key', 'err'); $('#aiSettings', root).open = true; key.focus(); return; }
          if (userText) messages.push({ role: 'user', content: userText });
          if (!messages.length || messages[messages.length - 1].role !== 'user') return;
          const history = messages.slice();
          const assistant = { role: 'assistant', content: '' };
          messages.push(assistant);
          const index = messages.length - 1;
          renderMessages();
          const bubble = messagesEl.querySelector(`[data-mid="${index}"] .msg-bubble`);
          if (bubble) bubble.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
          streaming = true; sendBtn.disabled = true; stopBtn.style.display = '';
          input.disabled = true;
          let acc = '';
          let full = '';
          let kind = '';
          let finished = false;
          let sse = null;
          lastUsage = '';

          function paint() {
            if (bubble) { bubble.textContent = acc; bubble.classList.add('streaming'); }
            messagesEl.scrollTop = messagesEl.scrollHeight;
          }
          function append(text) {
            if (!text) return;
            acc += text; paint();
          }
          function finish(note) {
            if (finished) return;
            finished = true;
            streaming = false; sendBtn.disabled = false; stopBtn.style.display = 'none';
            input.disabled = false; input.focus();
            if (note) acc += (acc ? '\n\n' : '') + note;
            assistant.content = acc || '(пустой ответ)';
            messages[index] = assistant;
            renderMessages();
            if (lastUsage) $('#aiUsage', root).textContent = lastUsage;
            persist();
          }
          function fail(message) {
            if (finished) return;
            finished = true;
            streaming = false; sendBtn.disabled = false; stopBtn.style.display = 'none';
            input.disabled = false;
            assistant.content = '⚠ ' + message;
            messages[index] = assistant;
            renderMessages();
            persist();
          }

          try {
            const req = buildRequest(settings, history);
            kind = req.kind;
            if (settings.stream) {
              sse = D.makeSSEParser((ev) => {
                if (!ev.data || ev.data === '[DONE]') return;
                let data;
                try { data = JSON.parse(ev.data); } catch (_) { return; }
                if (data.error) { fail(errorMessage(data)); try { currentRequest.abort(); } catch (_) {} return; }
                if (kind === 'openai') {
                  const d = data.choices && data.choices[0] && data.choices[0].delta;
                  if (d && d.content) append(d.content);
                  if (data.usage) lastUsage = extractUsage(kind, data);
                } else if (kind === 'anthropic') {
                  if (data.type === 'content_block_delta' && data.delta && data.delta.text) append(data.delta.text);
                  if (data.type === 'message_delta' && data.usage) lastUsage = `${(data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)} токенов`;
                  if (data.type === 'error') fail(errorMessage(data));
                } else if (kind === 'gemini') {
                  append(extractFull(kind, data));
                  if (data.usageMetadata) lastUsage = extractUsage(kind, data);
                }
              });
            }
            currentRequest = D.requestStream({ method: 'POST', url: req.url, headers: req.headers, body: JSON.stringify(req.body), timeout: 180000 }, {
              onResponse(meta) {
                if (meta.status >= 400) lastUsage = 'HTTP ' + meta.status;
              },
              onText(chunk) {
                full += chunk;
                if (sse) sse.feed(chunk);
              },
              onEnd(meta) {
                currentRequest = null;
                if (finished) return;
                if (meta.status >= 400) {
                  let msg = '';
                  try { msg = errorMessage(JSON.parse(full)); } catch (_) { msg = full.slice(0, 500); }
                  fail(`HTTP ${meta.status}${msg ? ': ' + msg : ''}`);
                  return;
                }
                if (!acc) {
                  try {
                    const data = JSON.parse(full);
                    if (data.error) { fail(errorMessage(data)); return; }
                    acc = extractFull(kind, data) || '';
                    lastUsage = extractUsage(kind, data) || lastUsage;
                  } catch (_) {
                    const cleaned = full.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter((x) => x && x !== '[DONE]');
                    if (cleaned.length && !acc) {
                      acc = cleaned.map((x) => { try { return extractFull(kind, JSON.parse(x)); } catch (_) { return ''; } }).join('');
                    }
                  }
                }
                finish();
              },
              onError(e) {
                currentRequest = null;
                if (e.aborted) { finish('_остановлено_'); return; }
                let msg = e.message || String(e);
                if (/Failed to fetch/i.test(msg)) msg = 'Сетевая ошибка. Проверьте Base URL, ключ и доступ к провайдеру.';
                fail(msg);
              }
            });
          } catch (e) {
            fail(e.message);
          }
        }

        sendBtn.onclick = () => {
          const text = input.value.trim();
          if (!text) return;
          input.value = '';
          send(text);
        };
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
        });
        stopBtn.onclick = () => { if (currentRequest) currentRequest.abort(); };
        $('#aiRegen', root).onclick = () => {
          if (streaming) return;
          let lastUser = -1;
          for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') { lastUser = i; break; }
          if (lastUser === -1) { toast('Нет сообщений для повтора', 'err'); return; }
          while (messages.length > lastUser + 1) messages.pop();
          renderMessages();
          // отправить без добавления нового user
          const text = messages[lastUser].content;
          messages.pop();
          send(text);
        };
        $('#aiClear', root).onclick = () => {
          if (messages.length && !confirm('Начать новый чат? Текущая история будет удалена.')) return;
          messages = []; lastUsage = ''; store.set('ai.messages', []); renderMessages();
        };
        $('#aiExport', root).onclick = () => {
          if (!messages.length) { toast('Чат пуст', 'err'); return; }
          const md = '# DevSuite AI Chat\n\n' + messages.map((m) => `## ${m.role === 'user' ? 'Вы' : 'Assistant'}\n\n${m.content}`).join('\n\n---\n\n');
          saveText('ai-chat.md', md, 'text/markdown');
        };
        ['aiRegen', 'aiClear', 'aiExport'].forEach((id) => { /* listeners уже назначены */ });
        applyProvider();
        base.value = saved.base || preset.base;
        model.value = saved.model || preset.model;
        renderMessages();
        persist();
      }
    }
  ]);
})();
