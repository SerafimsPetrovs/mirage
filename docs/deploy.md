# Деплой

## Вариант A — один сервер (VPS), SQLite

Подходит для старта и для сотен тысяч просмотров в месяц.

```bash
git clone … && cd platform
npm ci
cp .env.example .env    # задайте SESSION_SECRET (openssl rand -hex 32), уберите ALLOW_MOCK_PAYMENTS после подключения оплаты
npx prisma migrate deploy
npm run db:seed         # только для демо
npm run build
npm start               # за nginx/caddy с HTTPS
```

- Папки `prisma/` (БД) и `storage/` (загрузки) должны лежать на постоянном диске и попадать в бэкапы.
- nginx: `client_max_body_size 600m;` для загрузки видео.
- Процесс-менеджер: pm2 или systemd.

## Вариант B — масштабирование

1. **БД → PostgreSQL**: в `prisma/schema.prisma` поменяйте `provider = "postgresql"`, задайте `DATABASE_URL`, выполните `npx prisma migrate dev` для новой миграции.
2. **Видео → объектное хранилище + CDN** (S3, Yandex Object Storage, Cloudflare R2). В `src/lib/files.ts` замените `saveUpload` на загрузку в бакет, а в `/api/stream` отдавайте подписанную ссылку с коротким сроком жизни вместо файла с диска.
3. **Транскодинг в HLS** (ffmpeg / Mux / Cloudflare Stream): адаптивный битрейт для мобильных сетей.
4. Статика и постеры кешируются CDN (`/api/poster/*` уже отдаёт `Cache-Control: public`).

## Чеклист перед запуском

- [ ] `SESSION_SECRET` уникальный и длинный
- [ ] Подключён реальный платёжный провайдер, `ALLOW_MOCK_PAYMENTS` удалён
- [ ] HTTPS (cookie сессии становятся `secure` в продакшене)
- [ ] Бэкапы БД и `storage/`
- [ ] Юридические тексты (оферта, политика конфиденциальности) на `/about#terms`
