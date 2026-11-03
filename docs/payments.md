# Подключение платёжного провайдера

Вся работа с оплатой изолирована в `src/lib/payments/`.

## Как устроено

1. `createOrder(userId, sku, locale)` создаёт `Order` (PENDING) с ценой из `catalog.ts`. Цены всегда берутся на сервере.
2. Провайдер получает заказ через `checkout()` и возвращает URL оплаты (или `null`, если оплата прошла сразу).
3. После подтверждения оплаты вызывается `fulfillOrder(orderId)`. Функция идемпотентна: заказ переводится в PAID ровно один раз, после чего начисляются монеты или продлевается VIP.

## ЮKassa (пример)

```ts
// src/lib/payments/yookassa.ts
export const YooKassaProvider: PaymentProvider = {
  name: "yookassa",
  async checkout(order) {
    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${process.env.YOOKASSA_SHOP_ID}:${process.env.YOOKASSA_SECRET}`).toString("base64"),
        "Idempotence-Key": order.id,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: (order.amountCents / 100).toFixed(2), currency: order.currency },
        confirmation: { type: "redirect", return_url: `${process.env.APP_URL}/me/wallet` },
        capture: true,
        description: order.description,
        metadata: { orderId: order.id },
      }),
    });
    const data = await res.json();
    return data.confirmation.confirmation_url;
  },
};
```

Webhook (`src/app/api/payments/yookassa/route.ts`): проверьте подлинность события (IP-allowlist ЮKassa или повторный запрос `GET /v3/payments/{id}`), затем при `payment.succeeded` вызовите `fulfillOrder(event.object.metadata.orderId)`.

## Stripe

Используйте Checkout Session с `metadata.orderId` и `success_url`. В webhook проверьте подпись (`stripe.webhooks.constructEvent`) и при `checkout.session.completed` вызовите `fulfillOrder`.

## Включение

В `getProvider()` (`src/lib/payments/index.ts`) верните ваш провайдер, когда заданы его ключи, и уберите `ALLOW_MOCK_PAYMENTS` из продакшн-окружения.

Рекуррентные VIP-подписки (автопродление) — следующий шаг: сохранять `payment_method_id` и продлевать подписку по cron.
