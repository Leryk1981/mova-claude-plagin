DOC 1 — ТЕХНИЧЕСКОЕ ЗАДАНИЕ

TZ_MIGRATION_MOVA_CLAUDE_TO_OPENCODE_v0.md

1. Цель

Перестроить существующий проект mova-claude-plugin под платформу OpenCode,
без потери функциональности, логики и данных,
с сохранением Claude-адаптера как вторичного/legacy.

Результат:

MOVA функционирует на OpenCode как основной локальный исполнитель

Claude Code становится одним из адаптеров, а не платформой-якорем

2. Точка А (исходное состояние)

В репозитории уже реализовано:

2.1 Ядро MOVA (платформо-независимое)

Episode pipeline (.mova/episodes/**)

Guardrails + policy enforcement

Security detection (prompt/tool/file)

Human-in-the-Loop (HITL)

Presets + inheritance + backups

Retention / export

Observability (otel hooks)

Все это реализовано через:

scripts/mova-observe.js

scripts/mova-guard.js

scripts/mova-security.js

сервисные модули (EpisodeWriter, PresetManager и т.п.)

2.2 Claude-адаптер (текущий)

.claude-plugin/ manifest

hooks/hooks.json

slash-commands /mova:*

Claude lifecycle hooks (SessionStart, PreToolUse, PostToolUse, Stop)

3. Точка Б (целевое состояние)
3.1 OpenCode как основной исполнитель

В репозитории присутствует полноценный OpenCode-адаптер, обеспечивающий:

перехват lifecycle событий OpenCode

перехват выполнения инструментов (native tools)

вызов существующих MOVA-скриптов

запись эпизодов в тот же формат, что и ранее

enforce guardrails / security / HITL

3.2 Архитектурные принципы (обязательные)

Ядро MOVA не переписывается

OpenCode-слой = тонкий адаптер

OpenCode не хранит память → память только через MOVA episodes

Policy = deny-by-default

Любой side-effect → либо зафиксирован, либо заблокирован

4. Область работ (Scope)
Входит

OpenCode plugin (.opencode/plugins/mova.ts)

OpenCode custom commands (.opencode/commands/mova/*)

Адаптация входных данных под существующие MOVA scripts

Документированный mapping Claude → OpenCode

Совместное существование Claude и OpenCode адаптеров

Не входит

Рефакторинг core-логики MOVA

Изменение формата episodes

Оптимизация UX OpenCode (позже)

MCP/Cloud execution (отдельный этап)

5. Ограничения и требования

Node ≥ текущей версии проекта

OpenCode используется локально

Все скрипты должны уметь работать в non-interactive режиме

Ошибка guardrail = жёсткий блок выполнения

Любое блокирование фиксируется как episode

6. Критерии приёмки (Definition of Done)

Миграция считается завершённой, если:

OpenCode запускается с MOVA-плагином

Выполнение native tool:

проходит через tool.execute.before

либо разрешается, либо блокируется

После tool execution:

создаётся корректный episode

Команды mova:init, mova:status, mova:export работают

Claude-адаптер не сломан

Episode, созданный через OpenCode, структурно идентичен Claude-эпизоду

7. Артефакты

adapters/opencode/MAPPING_CLAUDE_TO_OPENCODE_v0.md

.opencode/plugins/mova.ts

.opencode/commands/mova/*.md

Episodes в .mova/episodes/**