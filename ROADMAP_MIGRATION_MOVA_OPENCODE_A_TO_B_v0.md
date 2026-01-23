DOC 2 — ДОРОЖНАЯ КАРТА A → B

ROADMAP_MIGRATION_MOVA_OPENCODE_A_TO_B_v0.md

A — Текущее положение (зафиксировано)

MOVA полностью работает в Claude Code

Ядро вынесено в scripts/services

Контроль, безопасность и память реализованы

Архитектура зрелая, но привязана к Claude hooks

ЭТАП 1 — Подготовка адаптера (Infrastructure)

Цель: создать каркас OpenCode-адаптера без изменения логики

Шаги:

Добавить каталог adapters/opencode/

Добавить .opencode/plugins/mova.ts (пустой, но загружаемый)

Подключить плагин через OpenCode config

Проверить, что OpenCode стартует без ошибок

Результат:
OpenCode видит MOVA-плагин, но ничего ещё не делает

ЭТАП 2 — Lifecycle интеграция

Цель: привязать события OpenCode к MOVA scripts

Шаги:

Реализовать хуки:

session.created

session.deleted

session.compacted

Прокинуть события в mova-observe.js

Убедиться, что создаётся episode старта/завершения

Результат:
OpenCode-сессия = MOVA-сессия (на уровне эпизодов)

ЭТАП 3 — Tool enforcement (ключевой)

Цель: вернуть контроль, ради которого существует MOVA

Шаги:

Подключить tool.execute.before

Вызвать:

mova-security.js

mova-guard.js

Реализовать жёсткий BLOCK при нарушении policy

Подключить tool.execute.after → mova-observe.js

Результат:
Любой tool либо:

разрешён + зафиксирован

либо заблокирован + зафиксирован

ЭТАП 4 — Командный UX

Цель: восстановить управляемость через команды

Шаги:

Добавить .opencode/commands/mova/init.md

Добавить .opencode/commands/mova/status.md

Добавить .opencode/commands/mova/export.md

Проверить работу через TUI

Результат:
Пользователь управляет MOVA в OpenCode так же, как в Claude

ЭТАП 5 — Инвариантность и доказательства

Цель: доказать, что миграция не сломала систему

Шаги:

Выполнить одинаковый сценарий:

через Claude

через OpenCode

Сравнить episodes

Зафиксировать результат

Результат:
Proof of Behavioral Invariance

B — Целевое состояние (итог)

OpenCode = основной локальный исполнитель MOVA

Claude Code = дополнительный адаптер

Ядро MOVA едино

Контроль, безопасность и память сохранены

Платформенная зависимость снята