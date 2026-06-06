# Contributing to bolt-new-local

AI-powered full-stack web development in the browser — работает на Remix, Cloudflare Pages и WebContainer API.

---

## Требования

| Инструмент | Версия |
|---|---|
| Node.js | >= 18.18.0 |
| pnpm | 9.4.0 |

---

## Быстрый старт

```bash
git clone https://github.com/ivanm696/bolt-new-local.git
cd bolt-new-local
pnpm install
cp .env.example .env
```

Открой `.env` и добавь один из ключей:

```env
# Вариант 1: Anthropic Claude 3.5 Sonnet (платный)
# https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=sk-ant-...

# Вариант 2: Groq — llama-3.3-70b-versatile (БЕСПЛАТНО)
# https://console.groq.com/keys
GROQ_API_KEY=gsk_...
```

> Если задан только `GROQ_API_KEY` — Groq выбирается автоматически.
> Если заданы оба — приоритет у Anthropic.

```bash
pnpm dev   # → http://localhost:5173
```

---

## Скрипты

| Команда | Что делает |
|---|---|
| `pnpm dev` | Dev-сервер через Vite + Wrangler |
| `pnpm build` | Сборка (Remix → `build/client` + `build/server`) |
| `pnpm start` | Запуск собранного через Wrangler Pages |
| `pnpm preview` | `build` + `start` одной командой |
| `pnpm test` | Vitest (unit-тесты) |
| `pnpm typecheck` | `tsc` — проверка TypeScript |
| `pnpm deploy` | Деплой на Cloudflare Pages через Wrangler |

---

## Архитектура

### Точки входа

| Файл | Назначение |
|---|---|
| `functions/[[path]].ts` | Cloudflare Pages Function — точка входа для всех запросов, проксирует в Remix |
| `load-context.ts` | Типизирует `AppLoadContext` — пробрасывает `context.cloudflare.env` (переменные окружения) в роуты |
| `worker-configuration.d.ts` | Интерфейс `Env` — `ANTHROPIC_API_KEY`, `GROQ_API_KEY` |
| `wrangler.toml` | Конфиг Cloudflare Pages: имя проекта, `nodejs_compat`, папка сборки |

### API роуты (`app/routes/`)

| Файл | Метод | Назначение |
|---|---|---|
| `api.chat.ts` | POST | Стриминг ответов AI. Использует `SwitchableStream` для автопродолжения при достижении лимита токенов |
| `api.enhancer.ts` | POST | Улучшение пользовательского промпта через AI. Возвращает `Response` с `result.textStream` |
| `_index.tsx` | GET | Главная страница (новый чат) |
| `chat.$id.tsx` | GET | Страница существующего чата по ID |

### LLM слой (`app/lib/.server/llm/`)

> Весь этот код выполняется **только на сервере** (Cloudflare Worker).

| Файл | Назначение |
|---|---|
| `api-key.ts` | `getAPIKey(env, provider)` — достаёт ключ из `process.env` или Cloudflare env. `getProvider(env)` — авто-определение провайдера |
| `model.ts` | `getModel(apiKey, provider)` — возвращает `LanguageModel`. Anthropic через `@ai-sdk/anthropic`, Groq через `@ai-sdk/openai` с `baseURL: groq.com` |
| `stream-text.ts` | `streamText(messages, env, options?)` — главная функция стриминга. Определяет провайдер, получает модель, вызывает `_streamText` из пакета `ai` |
| `switchable-stream.ts` | `SwitchableStream extends TransformStream` — позволяет переключать источник стрима на лету (нужно для автопродолжения длинных ответов) |
| `prompts.ts` | `getSystemPrompt()` — системный промпт для AI (инструкции по генерации кода) |
| `constants.ts` | `MAX_TOKENS`, `MAX_RESPONSE_SEGMENTS` — лимиты для стриминга |

### Runtime (`app/lib/runtime/`)

| Файл | Назначение |
|---|---|
| `message-parser.ts` | Парсит стриминговые ответы AI — выделяет `<boltArtifact>` и `<boltAction>` теги в реальном времени |
| `action-runner.ts` | `ActionRunner` — выполняет actions из AI: `shell` (запуск команд в WebContainer) и `file` (запись файлов) |
| `message-parser.spec.ts` | Unit-тесты парсера (24 теста) |

### Хранилища состояния (`app/lib/stores/`) — Nanostores

| Файл | Что хранит |
|---|---|
| `workbench.ts` | `WorkbenchStore` — главный стор. Координирует редактор, файлы, превью, терминал. Каждые 30 сек проверяет изменения в локальной папке |
| `files.ts` | `FilesStore` — карта файлов WebContainer (`/home/project/...`) |
| `editor.ts` | `EditorStore` — текущий документ, позиции скролла, несохранённые изменения |
| `previews.ts` | `PreviewsStore` — URL превью из WebContainer портов |
| `terminal.ts` | `TerminalStore` — xterm.js терминал, подключённый к WebContainer |
| `chat.ts` | ID текущего чата, описание |
| `settings.ts` | Пользовательские настройки |
| `theme.ts` | Тёмная/светлая тема |

### Персистентность (`app/lib/persistence/`)

| Файл | Назначение |
|---|---|
| `db.ts` | IndexedDB — `openDatabase()`, `getMessages()`, `setMessages()`, `getNextId()`, `getUrlId()` |
| `useChatHistory.ts` | React-хук — загружает историю чата при открытии, сохраняет после каждого сообщения |
| `fileSystem.ts` | File System Access API — `selectDirectory()`, `writeFile()`, `readFile()`, `checkForFileChanges()`, синхронизация `.boltnew.json` |
| `index.ts` | Реэкспорт публичного API персистентности |
| `ChatDescription.client.tsx` | Inline-редактирование названия чата в сайдбаре |

### WebContainer (`app/lib/webcontainer/`)

| Файл | Назначение |
|---|---|
| `index.ts` | Singleton `webcontainer: Promise<WebContainer>` — буtstraps WebContainer один раз, переиспользуется через HMR |
| `auth.client.ts` | Авторизация WebContainer API |

### Компоненты (`app/components/`)

```
chat/
  BaseChat.tsx          — Layout чата (инпут + сообщения)
  Chat.client.tsx        — Логика чата: useChat(@ai-sdk/react), стриминг, история
  Messages.client.tsx    — Список сообщений
  Artifact.tsx           — Отображение артефакта (код + действия)
  AssistantMessage.tsx   — Рендер Markdown ответа AI
  UserMessage.tsx        — Сообщение пользователя

workbench/
  Workbench.client.tsx   — Панель с редактором, превью и терминалом
  EditorPanel.tsx        — CodeMirror + файловое дерево
  FileTree.tsx           — Дерево файлов WebContainer
  Preview.tsx            — iframe превью + управление портами
  terminal/Terminal.tsx  — xterm.js терминал

header/
  Header.tsx             — Шапка: лого + кнопки
  HeaderActionButtons.client.tsx — Кнопки: открыть папку, скачать проект

sidebar/
  Menu.client.tsx        — История чатов
  HistoryItem.tsx        — Элемент истории (переименование, удаление)
```

---

## Добавить AI провайдера

1. `worker-configuration.d.ts` — добавь ключ в `Env`
2. `app/lib/.server/llm/api-key.ts` — добавь тип и логику в `getAPIKey` / `getProvider`
3. `app/lib/.server/llm/model.ts` — добавь инициализацию модели в `getModel`
4. `.env.example` — добавь переменную с комментарием

---

## Деплой на Cloudflare Pages

```bash
npx wrangler login
pnpm deploy
```

В Cloudflare Dashboard добавь переменные окружения:
**Settings → Environment Variables** → `ANTHROPIC_API_KEY` или `GROQ_API_KEY`

---

## Тесты

```bash
pnpm test       # запуск
pnpm typecheck  # TypeScript проверка
```

Тесты: `app/lib/runtime/message-parser.spec.ts` — 24 теста парсера AI-ответов.
