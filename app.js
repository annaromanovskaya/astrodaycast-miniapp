const STORAGE_KEYS = {
  provider: "ai_provider",
  baseUrl: "ai_base_url",
  apiKey: "ai_api_key",
  model: "ai_model",
  extended: "ai_extended_analysis",
};

const PROVIDERS = {
  openrouter: {
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "google/gemma-4-26b-a4b-it:free",
      "openai/gpt-4.1-mini",
      "anthropic/claude-3.7-sonnet",
      "google/gemini-2.5-flash",
    ],
  },
  openai: {
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: ["gpt-4.1-mini", "gpt-4.1", "gpt-5-mini"],
  },
  anthropic: {
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    models: ["claude-3-5-haiku-latest", "claude-3-7-sonnet-latest"],
  },
  groq: {
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "moonshotai/kimi-k2-instruct-0905"],
  },
  gemini: {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: ["gemini-2.5-flash", "gemini-2.5-pro"],
  },
};

const ALLOWED_TOPIC_TOKENS = [
  "погод",
  "облач",
  "ветер",
  "дожд",
  "снег",
  "туман",
  "небо",
  "звезд",
  "звёзд",
  "луна",
  "лун",
  "телескоп",
  "бинокл",
  "наблюд",
  "астро",
  "сияни",
  "аврор",
  "kp",
  "метеор",
  "персеид",
  "затм",
  "комет",
  "планет",
  "видно",
  "видимост",
  "ночь",
  "сводк",
  "одеть",
  "одетьс",
  "набрать",
  "брать",
];

const OFF_TOPIC_MESSAGE =
  "Я помогаю только с погодой, условиями наблюдений, Луной, видимостью неба и астрономическими событиями в AstroDaycast.";

const ui = {
  provider: document.getElementById("provider"),
  baseUrl: document.getElementById("baseUrl"),
  apiKey: document.getElementById("apiKey"),
  model: document.getElementById("model"),
  providerStatus: document.getElementById("providerStatus"),
  storageBadge: document.getElementById("storageBadge"),
  extendedAnalysis: document.getElementById("extendedAnalysis"),
  question: document.getElementById("question"),
  answer: document.getElementById("answer"),
  saveSettings: document.getElementById("saveSettings"),
  clearSettings: document.getElementById("clearSettings"),
  checkConnection: document.getElementById("checkConnection"),
  askAi: document.getElementById("askAi"),
  openSettings: document.getElementById("openSettings"),
  openChat: document.getElementById("openChat"),
  settingsScreen: document.getElementById("settingsScreen"),
  chatScreen: document.getElementById("chatScreen"),
  chatIntro: document.getElementById("chatIntro"),
};

let currentConfig = null;
let currentContext = null;
let storageMode = "local";
let currentSettings = {
  provider: "openrouter",
  baseUrl: PROVIDERS.openrouter.baseUrl,
  apiKey: "",
  model: "",
  extendedAnalysis: true,
};

function telegramInitData() {
  return window.Telegram?.WebApp?.initData || "";
}

async function api(path) {
  const response = await fetch(path, {
    headers: {
      "X-Telegram-Init-Data": telegramInitData(),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

function renderAnswer(text) {
  ui.answer.textContent = text;
}

function isAstroDaycastQuestion(text) {
  const question = text.toLowerCase();
  return ALLOWED_TOPIC_TOKENS.some((token) => question.includes(token));
}

function providerConfig(providerId) {
  return PROVIDERS[providerId] || PROVIDERS.openrouter;
}

function switchScreen(target) {
  const showSettings = target === "settings";
  ui.settingsScreen.classList.toggle("is-active", showSettings);
  ui.chatScreen.classList.toggle("is-active", !showSettings);
  ui.openSettings.classList.toggle("is-active", showSettings);
  ui.openChat.classList.toggle("is-active", !showSettings);
}

function maskKey(key) {
  if (!key) {
    return "ключ не подключен";
  }
  if (key.length <= 8) {
    return "••••••••";
  }
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

function updateStorageBadge() {
  ui.storageBadge.textContent = storageMode === "secure" ? "SecureStorage" : "Локальное хранение";
}

function setProviderOptions() {
  ui.provider.innerHTML = Object.entries(PROVIDERS)
    .map(([value, item]) => `<option value="${value}">${item.label}</option>`)
    .join("");
}

function defaultModelForProvider(providerId) {
  const config = providerConfig(providerId);
  return config.models[0] || "";
}

function syncForm() {
  ui.provider.value = currentSettings.provider;
  ui.baseUrl.value = currentSettings.baseUrl || providerConfig(currentSettings.provider).baseUrl;
  ui.apiKey.value = currentSettings.apiKey;
  ui.model.value = currentSettings.model || defaultModelForProvider(currentSettings.provider);
  ui.extendedAnalysis.checked = Boolean(currentSettings.extendedAnalysis);
  updateStatusBox();
}

function updateStatusBox(extraLine = "") {
  const provider = providerConfig(currentSettings.provider);
  const lines = [];
  if (currentSettings.apiKey) {
    lines.push(`✓ ${provider.label} подключён`);
    lines.push(ui.model.value || currentSettings.model || defaultModelForProvider(currentSettings.provider));
    lines.push(`Base URL: ${ui.baseUrl.value || currentSettings.baseUrl || provider.baseUrl}`);
    lines.push(`Ключ: ${maskKey(currentSettings.apiKey)}`);
  } else {
    lines.push("Пока ничего не подключено.");
  }
  lines.push(
    storageMode === "secure"
      ? "Ключ будет храниться в SecureStorage Telegram."
      : "SecureStorage недоступен, используется локальное хранилище на этом устройстве."
  );
  if (extraLine) {
    lines.push(extraLine);
  }
  ui.providerStatus.textContent = lines.join("\n");
}

function webAppBridge(eventType, eventData) {
  const payload = JSON.stringify(eventData);
  if (window.TelegramWebviewProxy?.postEvent) {
    window.TelegramWebviewProxy.postEvent(eventType, payload);
    return true;
  }
  if (window.external?.notify) {
    window.external.notify(JSON.stringify({ eventType, eventData }));
    return true;
  }
  if (window.parent && window !== window.parent) {
    window.parent.postMessage(JSON.stringify({ eventType, eventData }), "*");
    return true;
  }
  return false;
}

function waitForEvent(eventName, reqId) {
  return new Promise((resolve, reject) => {
    const handler = (type, payload) => {
      if (type !== eventName && type !== "secure_storage_failed") {
        return;
      }
      if (!payload || payload.req_id !== reqId) {
        return;
      }
      window.Telegram.WebApp.offEvent(eventName, handler);
      window.Telegram.WebApp.offEvent("secure_storage_failed", handler);
      if (type === "secure_storage_failed") {
        reject(new Error(payload.error || "SecureStorage request failed"));
      } else {
        resolve(payload);
      }
    };
    window.Telegram.WebApp.onEvent(eventName, handler);
    window.Telegram.WebApp.onEvent("secure_storage_failed", handler);
  });
}

async function secureStorageSave(key, value) {
  if (!window.Telegram?.WebApp?.onEvent) {
    throw new Error("UNSUPPORTED");
  }
  const reqId = `save_${key}_${Date.now()}`;
  const promise = waitForEvent("secure_storage_key_saved", reqId);
  if (!webAppBridge("web_app_secure_storage_save_key", { req_id: reqId, key, value })) {
    throw new Error("UNSUPPORTED");
  }
  await promise;
}

async function secureStorageGet(key) {
  if (!window.Telegram?.WebApp?.onEvent) {
    throw new Error("UNSUPPORTED");
  }
  const reqId = `get_${key}_${Date.now()}`;
  const promise = waitForEvent("secure_storage_key_received", reqId);
  if (!webAppBridge("web_app_secure_storage_get_key", { req_id: reqId, key })) {
    throw new Error("UNSUPPORTED");
  }
  const payload = await promise;
  if (payload.can_restore && payload.value == null) {
    throw new Error("RESTORE_REQUIRED");
  }
  return payload.value || "";
}

async function secureStorageClear() {
  if (!window.Telegram?.WebApp?.onEvent) {
    throw new Error("UNSUPPORTED");
  }
  const reqId = `clear_${Date.now()}`;
  const promise = waitForEvent("secure_storage_cleared", reqId);
  if (!webAppBridge("web_app_secure_storage_clear", { req_id: reqId })) {
    throw new Error("UNSUPPORTED");
  }
  await promise;
}

function localSave(key, value) {
  localStorage.setItem(key, value);
}

function localGet(key) {
  return localStorage.getItem(key) || "";
}

function localClear() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

async function detectStorageMode() {
  try {
    await secureStorageGet(STORAGE_KEYS.provider);
    storageMode = "secure";
  } catch (error) {
    storageMode = "local";
  }
  updateStorageBadge();
}

async function loadSettings() {
  const defaults = {
    provider: "openrouter",
    baseUrl: PROVIDERS.openrouter.baseUrl,
    apiKey: "",
    model: currentConfig?.default_model || PROVIDERS.openrouter.models[0],
    extendedAnalysis: true,
  };
  try {
    if (storageMode === "secure") {
      const [provider, baseUrl, apiKey, model, extended] = await Promise.all([
        secureStorageGet(STORAGE_KEYS.provider),
        secureStorageGet(STORAGE_KEYS.baseUrl),
        secureStorageGet(STORAGE_KEYS.apiKey),
        secureStorageGet(STORAGE_KEYS.model),
        secureStorageGet(STORAGE_KEYS.extended),
      ]);
      currentSettings = {
        provider: provider || defaults.provider,
        baseUrl: baseUrl || providerConfig(provider || defaults.provider).baseUrl,
        apiKey,
        model: model || defaults.model,
        extendedAnalysis: extended ? extended === "1" : defaults.extendedAnalysis,
      };
      return;
    }
  } catch (error) {
    storageMode = "local";
    updateStorageBadge();
  }

  currentSettings = {
    provider: localGet(STORAGE_KEYS.provider) || defaults.provider,
    baseUrl:
      localGet(STORAGE_KEYS.baseUrl) ||
      providerConfig(localGet(STORAGE_KEYS.provider) || defaults.provider).baseUrl,
    apiKey: localGet(STORAGE_KEYS.apiKey),
    model: localGet(STORAGE_KEYS.model) || defaults.model,
    extendedAnalysis: (localGet(STORAGE_KEYS.extended) || "1") === "1",
  };
}

async function persistSettings() {
  currentSettings = {
    provider: ui.provider.value,
    baseUrl: ui.baseUrl.value.trim() || providerConfig(ui.provider.value).baseUrl,
    apiKey: ui.apiKey.value.trim(),
    model: ui.model.value,
    extendedAnalysis: ui.extendedAnalysis.checked,
  };

  if (storageMode === "secure") {
    try {
      await Promise.all([
        secureStorageSave(STORAGE_KEYS.provider, currentSettings.provider),
        secureStorageSave(STORAGE_KEYS.baseUrl, currentSettings.baseUrl),
        secureStorageSave(STORAGE_KEYS.apiKey, currentSettings.apiKey),
        secureStorageSave(STORAGE_KEYS.model, currentSettings.model),
        secureStorageSave(STORAGE_KEYS.extended, currentSettings.extendedAnalysis ? "1" : "0"),
      ]);
      updateStatusBox("Настройки сохранены в SecureStorage Telegram.");
      switchScreen("chat");
      return;
    } catch (error) {
      storageMode = "local";
      updateStorageBadge();
    }
  }

  localSave(STORAGE_KEYS.provider, currentSettings.provider);
  localSave(STORAGE_KEYS.baseUrl, currentSettings.baseUrl);
  localSave(STORAGE_KEYS.apiKey, currentSettings.apiKey);
  localSave(STORAGE_KEYS.model, currentSettings.model);
  localSave(STORAGE_KEYS.extended, currentSettings.extendedAnalysis ? "1" : "0");
  updateStatusBox("Настройки сохранены локально на этом устройстве.");
  switchScreen("chat");
}

async function clearSettings() {
  if (storageMode === "secure") {
    try {
      await secureStorageClear();
    } catch (error) {
      localClear();
    }
  } else {
    localClear();
  }

  currentSettings = {
    provider: "openrouter",
    baseUrl: providerConfig("openrouter").baseUrl,
    apiKey: "",
    model: defaultModelForProvider("openrouter"),
    extendedAnalysis: true,
  };
  syncForm();
  renderAnswer("Ключ и AI-настройки удалены с этого устройства.");
}

async function checkConnection() {
  const provider = providerConfig(ui.provider.value);
  const baseUrl = ui.baseUrl.value.trim() || provider.baseUrl;
  const apiKey = ui.apiKey.value.trim();
  const model = ui.model.value;

  if (!baseUrl || !model || !apiKey) {
    updateStatusBox("Сначала заполните Base URL, модель и API key.");
    return;
  }

  updateStatusBox("Проверяю подключение…");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (ui.provider.value === "anthropic") {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    delete headers.Authorization;
  }

  const endpoint =
    ui.provider.value === "anthropic"
      ? `${baseUrl.replace(/\/$/, "")}/messages`
      : `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  const body =
    ui.provider.value === "anthropic"
      ? {
          model,
          max_tokens: 32,
          messages: [{ role: "user", content: "Reply with: ok" }],
        }
      : {
          model,
          messages: [{ role: "user", content: "Reply with: ok" }],
          max_tokens: 32,
          temperature: 0,
        };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    updateStatusBox(`Подключение не удалось: ${response.status}.`);
    throw new Error(errorText || `Provider check failed with status ${response.status}`);
  }

  updateStatusBox(`✓ Подключено\n${provider.label}\n${model}`);
}

function composePrompt(question) {
  const instructions = currentSettings.extendedAnalysis
    ? "Дай расширенный, но компактный разбор с практическим советом."
    : "Ответь кратко и по делу.";
  return [
    "Ты AstroDaycast AI assistant.",
    "Отвечай по-русски, спокойно и практично.",
    "Ты отвечаешь только на темы AstroDaycast: погода, астропогода, условия наблюдений, облачность, Луна, видимость неба, северное сияние, метеорные потоки, затмения, астрономические события, одежда и советы для наблюдений.",
    "Если вопрос не относится к этим темам, вежливо откажись и скажи: " + OFF_TOPIC_MESSAGE,
    "Не выдумывай данные вне переданного контекста.",
    "Используй только переданный контекст AstroDaycast и не уходи в общие темы, не связанные с ботом.",
    instructions,
    "",
    "Структурированные данные AstroDaycast:",
    JSON.stringify(currentContext, null, 2),
    "",
    `Вопрос пользователя: ${question}`,
  ].join("\n");
}

async function fetchContextIfNeeded() {
  if (currentContext) {
    return currentContext;
  }
  currentContext = await api("/api/ai/context");
  return currentContext;
}

async function directLlmCall() {
  const providerId = ui.provider.value;
  const provider = providerConfig(providerId);
  const baseUrl = ui.baseUrl.value.trim() || provider.baseUrl;
  const apiKey = ui.apiKey.value.trim();
  const model = ui.model.value;
  const question = ui.question.value.trim();

  if (!baseUrl || !model || !apiKey) {
    renderAnswer("Сначала заполните Base URL, модель и API key на экране AI-настроек.");
    switchScreen("settings");
    return;
  }
  if (!question) {
    renderAnswer("Напишите вопрос для AstroDaycast AI.");
    return;
  }
  if (!isAstroDaycastQuestion(question)) {
    renderAnswer(OFF_TOPIC_MESSAGE);
    return;
  }

  await fetchContextIfNeeded();
  renderAnswer("Запрашиваю ответ у выбранной модели…");

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  let endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  let body = {
    model,
    messages: [
      {
        role: "system",
        content: "Ты аккуратный астрономический ассистент. Отвечай только на основе переданного контекста.",
      },
      {
        role: "user",
        content: composePrompt(question),
      },
    ],
    temperature: 0.4,
  };

  if (providerId === "anthropic") {
    endpoint = `${provider.baseUrl.replace(/\/$/, "")}/messages`;
    endpoint = `${baseUrl.replace(/\/$/, "")}/messages`;
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    delete headers.Authorization;
    body = {
      model,
      max_tokens: 700,
      messages: [{ role: "user", content: composePrompt(question) }],
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const text =
    providerId === "anthropic"
      ? payload.content?.find((item) => item.type === "text")?.text
      : payload.choices?.[0]?.message?.content;
  renderAnswer(text || "Пустой ответ от модели.");
}

function bindEvents() {
  ui.provider.addEventListener("change", () => {
    const provider = providerConfig(ui.provider.value);
    ui.baseUrl.value = provider.baseUrl;
    if (!ui.model.value.trim() || ui.model.value === defaultModelForProvider(currentSettings.provider)) {
      ui.model.value = provider.models[0];
    }
    updateStatusBox();
  });

  ui.saveSettings.addEventListener("click", () => {
    persistSettings().catch((error) => renderAnswer(error.message));
  });

  ui.clearSettings.addEventListener("click", () => {
    clearSettings().catch((error) => renderAnswer(error.message));
  });

  ui.checkConnection.addEventListener("click", () => {
    checkConnection().catch((error) => renderAnswer(error.message));
  });

  ui.askAi.addEventListener("click", () => {
    directLlmCall().catch((error) => renderAnswer(error.message));
  });

  ui.openSettings.addEventListener("click", () => switchScreen("settings"));
  ui.openChat.addEventListener("click", () => switchScreen("chat"));

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      ui.question.value = chip.dataset.prompt || "";
    });
  });
}

async function bootstrap() {
  window.Telegram?.WebApp?.ready();
  window.Telegram?.WebApp?.expand();
  setProviderOptions();
  bindEvents();

  try {
    currentConfig = await api("/api/miniapp/config");
    await detectStorageMode();
    await loadSettings();
    syncForm();
    renderAnswer(currentConfig?.privacy_note || "AstroDaycast AI готов.");
  } catch (error) {
    await detectStorageMode();
    syncForm();
    renderAnswer(error.message || "Не удалось инициализировать Mini App.");
  }
}

bootstrap();
