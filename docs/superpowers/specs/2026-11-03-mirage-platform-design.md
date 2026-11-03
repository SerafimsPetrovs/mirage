# MIRAGE — стриминговая платформа для ИИ-сериалов

## 1. Цель
Netflix-подобная платформа для ИИ-контента (в первую очередь вертикальные шорт-дорамы по 1–3 мин, как китайские ИИ-сериалы), с монетизацией «подписка + монеты», студией авторов и админкой. Интерфейс RU + EN.

**Решения пользователя:** формат — оба, вертикальный главный; монетизация — VIP-подписка + монеты за серии; контент — админ + студия авторов; язык — RU/EN.

**Успех:** зритель может зарегистрироваться, листать вертикальную ленту, смотреть сериалы, упираться в пейвол, покупать монеты/VIP (mock-оплата), открывать серии; автор загружает сериал и серии, видит статистику и заработок; админ модерирует и управляет витриной.

## 2. Стек
- Next.js (App Router, Server Components, Server Actions) + TypeScript
- Tailwind CSS, lucide-react, next/font (Unbounded + Inter)
- Prisma + SQLite (dev; схема совместима с Postgres)
- Собственная авторизация: bcryptjs + сессии в БД, httpOnly cookie
- Видео: MP4 с HTTP Range через `/api/stream/[episodeId]` (локальное хранилище `storage/`) или внешний URL; HLS через hls.js при `.m3u8`
- Vitest для бизнес-логики

## 3. Роли
VIEWER, CREATOR, ADMIN. Зритель может подать заявку стать автором (одобряет админ).

## 4. Модель данных (Prisma)
User(id, email, passwordHash, name, avatarColor, role, coins, locale, createdAt)
Session(id, userId, expiresAt)
Subscription(userId unique, plan WEEK|MONTH|YEAR, status, currentPeriodEnd)
Series(id, slug, titleRu/En, descriptionRu/En, orientation VERTICAL|HORIZONTAL, posterUrl, backdropUrl, accentColor, genres(csv), tags, aiModels(csv), promptNotes, ageRating, status DRAFT|PENDING|PUBLISHED|REJECTED, featured, freeEpisodes, defaultCoinPrice, creatorId, views, createdAt)
Episode(id, seriesId, number, titleRu/En, durationSec, videoUrl, thumbnailUrl, coinPrice, views, createdAt)
Unlock(userId, episodeId) unique
CoinTransaction(id, userId, amount, reason, episodeId?, orderId?, createdAt)
Order(id, userId, kind COINS|VIP, sku, amountCents, currency, status, provider, createdAt) — идемпотентное зачисление
CreatorEarning(id, creatorId, episodeId, coins, createdAt)
WatchProgress(userId, episodeId, seriesId, positionSec, completed, updatedAt) unique(userId, episodeId)
ListItem(userId, seriesId) — «Моя полка»
Like(userId, episodeId)
Comment(id, userId, episodeId, body, createdAt, hidden)
Rating(userId, seriesId, value 1–5)
CheckIn(userId, day 'YYYY-MM-DD', streak, reward) unique(userId, day)
Poll(id, seriesId, questionRu/En, closesAt) + PollOption(id, pollId, labelRu/En) + PollVote(userId, pollId unique, optionId)
CreatorApplication(id, userId, message, status, createdAt)

## 5. Фишки (отличие от конкурентов)
1. **Вертикальная лента «Поток»** — свайп как в TikTok, автоплей, переход в сериал на следующую серию.
2. **«Как это сделано»** — у каждого сериала карточка ИИ-инструментов (Sora, Kling, Veo, Runway, Suno…) и заметки о промптах от автора.
3. **«Что дальше?»** — зрительские голосования за сюжет следующих серий.
4. **Ежедневный бонус** со стриком (7-дневный цикл наград монетами).
5. **Mood-подбор** — выбор настроения («Хочу мести», «Хочу плакать», «Хочу бабочек») → подборка по тегам.
6. **Топ-10 сегодня**, «Продолжить просмотр», «Новые серии».
7. **Авто-переход к следующей серии** + анлок прямо в плеере в один тап.

## 6. Страницы
Публичные: `/` (главная: hero, ряды, топ-10, mood), `/feed` (вертикальная лента), `/browse` (каталог с фильтрами), `/search`, `/series/[slug]`, `/watch/[episodeId]`, `/login`, `/register`, `/vip` (тарифы), `/coins` (пакеты).
Аккаунт: `/me` (профиль, история, полка, кошелёк, бонус), `/me/wallet`.
Студия: `/studio` (дашборд), `/studio/series/new`, `/studio/series/[id]` (редактирование, серии, загрузка, опросы).
Админ: `/admin` (метрики), `/admin/moderation`, `/admin/series`, `/admin/users`, `/admin/applications`.

## 7. Монетизация
- Первые `freeEpisodes` (по умолч. 5) бесплатно; далее `coinPrice` (по умолч. 30 монет) или VIP.
- Пакеты монет: 100/300+30/600+90/1500+300 (₽ и $).
- VIP: неделя / месяц / год.
- Доля автора 50% от монет за анлок.
- Оплата через интерфейс `PaymentProvider`; по умолчанию `MockProvider`. Подготовлены точки для Stripe/YooKassa.
Правила — в скилле handling-coins-and-unlocks.

## 8. Безопасность
Пароли bcrypt; сессии в БД, httpOnly SameSite=Lax cookie; проверки ролей на сервере в каждом action/route; доступ к видео проверяется в stream-роуте; валидация входа через zod; загрузка только video/mp4,webm и image/*, лимиты размера.

## 9. Демо-контент
Сид генерирует ~16 оригинальных сериалов (авторские названия/описания RU/EN), постеры — процедурные SVG-арты (`/api/poster/[slug]`), видео — открытые тестовые MP4 (Blender Foundation, CC-BY) как плейсхолдеры. Без использования чужих брендов.

## 10. Тестирование
Vitest: access, coins (списание, повторный анлок, недостаток монет), check-in streak, i18n plural. Ручная проверка UI через Playwright (скилл verifying-ui-in-browser).

## 11. Вне скоупа v1
Нативные приложения, реальный платёжный провайдер (только адаптер), транскодинг в HLS (нет ffmpeg), рекомендательная ML-модель (эвристики по жанрам/тегам), email-рассылки.
