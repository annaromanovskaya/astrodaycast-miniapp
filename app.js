const storageKey = "astrodaycast-miniapp-settings";

const ui = {
  baseUrl: document.getElementById("baseUrl"),
  model: document.getElementById("model"),
  apiKey: document.getElementById("apiKey"),
  profile: document.getElementById("profile"),
  contextPreview: document.getElementById("contextPreview"),
  question: document.getElementById("question"),
  answer: document.getElementById("answer"),
  saveSettings: document.getElementById("saveSettings"),
  clearSettings: document.getElementById("clearSettings"),
  refreshContext: document.getElementById("refreshContext"),
  askAi: document.getElementById("askAi"),
  insertSummary: document.getElementById("insertSummary"),
};

let currentContext = null;
let currentConfig = null;

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

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
}

function saveSettings() {
  const settings = {
    baseUrl: ui.baseUrl.value.trim(),
    model: ui.model.value.trim(),
    apiKey: ui.apiKey.value.trim(),
  };
  localStorage.setItem(storageKey, JSON.stringify(settings));
  renderAnswer("Настройки сохранены только на этом устройстве.");
}

function clearSettings() {
  localStorage.removeItem(storageKey);
  ui.apiKey.value = "";
  renderAnswer("Локальный ключ удален с устройства.");
}

function hydrateSettings(settings) {
  ui.baseUrl.value = settings.baseUrl || currentConfig?.default_base_url || "";
  ui.model.value = settings.model || currentConfig?.default_model || "";
  ui.apiKey.value = settings.apiKey || "";
}

function renderProfile(data) {
  ui.profile.textContent =
    `${data.profile.city} · ${data.profile.timezone}\n` +
    `Bortle ${data.profile.bortle}\n` +
    `Рассылка: будни ${data.profile.weekday_time}, выходные ${data.profile.weekend_time}`;
}

function renderContext(context) {
  ui.contextPreview.textContent = JSON.stringify(context, null, 2);
}

function renderAnswer(text) {
  ui.answer.textContent = text;
}

function composePrompt(question) {
  return [
    "Ты AstroDaycast AI assistant.",
    "Отвечай по-русски, кратко и практично.",
    "Не выдумывай данные вне переданного контекста.",
    "",
    "Контекст AstroDaycast:",
    JSON.stringify(currentContext, null, 2),
    "",
    `Вопрос пользователя: ${question}`,
  ].join("\n");
}

async function directLlmCall() {
  const baseUrl = ui.baseUrl.value.trim();
  const model = ui.model.value.trim();
  const apiKey = ui.apiKey.value.trim();
  const question = ui.question.value.trim();

  if (!baseUrl || !model || !apiKey) {
    renderAnswer("Сначала заполни базовый URL, модель и API key.");
    return;
  }
  if (!currentContext) {
    renderAnswer("Контекст еще не загружен.");
    return;
  }
  if (!question) {
    renderAnswer("Напиши вопрос для AI.");
    return;
  }

  renderAnswer("Запрашиваю ответ у выбранного AI-провайдера…");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "Ты аккуратный астрономический ассистент. Отвечай только на основе контекста.",
        },
        {
          role: "user",
          content: composePrompt(question),
        },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const text = payload.choices?.[0]?.message?.content || "Пустой ответ от модели.";
  renderAnswer(text);
}

async function refreshData() {
  currentConfig = await api("/api/miniapp/config");
  hydrateSettings(loadSettings());

  const [profile, context] = await Promise.all([
    api("/api/me"),
    api("/api/ai/context"),
  ]);
  currentContext = context;
  renderProfile(profile);
  renderContext(context);
}

function bindEvents() {
  ui.saveSettings.addEventListener("click", saveSettings);
  ui.clearSettings.addEventListener("click", clearSettings);
  ui.refreshContext.addEventListener("click", () => {
    refreshData().catch((error) => renderAnswer(error.message));
  });
  ui.askAi.addEventListener("click", () => {
    directLlmCall().catch((error) => renderAnswer(error.message));
  });
  ui.insertSummary.addEventListener("click", () => {
    if (!currentContext?.digest_preview_html) {
      return;
    }
    ui.question.value = `Вот утренняя сводка:\n${currentContext.digest_preview_html}\n\nОбъясни ее простыми словами.`;
  });
  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      ui.question.value = chip.dataset.prompt || "";
    });
  });
}

async function bootstrap() {
  window.Telegram?.WebApp?.ready();
  window.Telegram?.WebApp?.expand();
  bindEvents();
  try {
    await refreshData();
    renderAnswer(currentConfig?.privacy_note || "Готово.");
  } catch (error) {
    renderAnswer(error.message);
    ui.profile.textContent = "Не удалось загрузить профиль из AstroDaycast.";
    ui.contextPreview.textContent = "Контекст недоступен.";
  }
}

bootstrap();
