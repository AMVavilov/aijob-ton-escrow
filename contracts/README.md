# Smart Contracts for `AI Job Secure Deal`

Папка содержит on-chain часть для сценария `Secure Deal` в `AI Job`.

## Текущая версия

- `secure_task_deal_v1.tolk`

## Архитектурный принцип

- одна сделка = один контракт
- контракт хранит деньги и исполняет правила payout / refund
- бот анализирует переписку off-chain
- площадка принимает финальное on-chain решение при споре
- getter хранит settlement metadata для UI и аудита

## Что поддерживает `v1`

- депозит от заказчика
- отметка о выполнении от исполнителя
- подтверждение выполнения заказчиком
- открытие спора после доставки
- открытие спора после срыва delivery deadline
- финальный `release` площадкой
- финальный `refund` площадкой
- `split resolution` площадкой
- отмена до депозита
- permissionless отмена до депозита после funding deadline
- refund после срыва delivery deadline
- `timeout release` после истечения review deadline
- комиссия платформы как отдельная сумма
- возврат deposit surplus заказчику на settlement

## Что не поддерживает `v1`

- partial refunds
- milestone payments
- несколько исполнителей
- on-chain AI arbitration

## Файлы

- [secure_task_deal_v1.tolk](./secure_task_deal_v1.tolk) — исходник контракта
- [docs/STATE_MACHINE.md](./docs/STATE_MACHINE.md) — логика состояний
- [docs/OFFCHAIN_BOUNDARY.md](./docs/OFFCHAIN_BOUNDARY.md) — граница между on-chain и off-chain логикой
- [TESTNET_DEPLOY.md](./TESTNET_DEPLOY.md) — пошаговый сценарий деплоя в testnet
- [../testnet/VALIDATION.md](../testnet/VALIDATION.md) — live smoke-тесты в `TON testnet`

## Логика денег

- `rewardAmount` — сколько должен получить исполнитель
- `feeAmount` — комиссия платформы
- `totalAmount` — сколько вносит заказчик

Формула:

`totalAmount = rewardAmount + feeAmount`

## Базовый flow

1. Заказчик вносит депозит
2. Исполнитель отмечает задачу как выполненную
3. Заказчик подтверждает результат
4. Контракт отправляет:
   - `rewardAmount` исполнителю
   - `feeAmount` платформе

Если возникает спор:

1. Сделка переводится в `DISPUTED`
2. Бот делает off-chain summary
3. Площадка принимает финальное решение:
   - `platformRelease`
   - `platformRefund`
   - `platformResolveSplit`

Если исполнитель не уложился в `deliveryDeadline`:

1. Стороны могут открыть спор
2. Или любой может вызвать `refundAfterDeliveryTimeout`
3. Контракт вернёт заказчику весь внесённый депозит

## Локальная работа

Установить зависимости:

```bash
npm install
```

Собрать контракт:

```bash
npm run build
```

Прогнать тесты:

```bash
npm test -- SecureTaskDealV1
```

## Переменные окружения для деплоя

Шаблон лежит в:

- `./.env.testnet.example`

Основные переменные:

- `AIJOB_CUSTOMER_ADDRESS`
- `AIJOB_EXECUTOR_ADDRESS`
- `AIJOB_PLATFORM_ARBITER_ADDRESS`
- `AIJOB_FEE_WALLET_ADDRESS`
- `AIJOB_REWARD_TON`
- `AIJOB_FEE_TON`
- `AIJOB_FUNDING_DEADLINE`
- `AIJOB_DELIVERY_DEADLINE`
- `AIJOB_REVIEW_DEADLINE`

Для mnemonic-деплоя также нужны:

- `WALLET_MNEMONIC`
- `WALLET_VERSION`
- `WALLET_ID` или `SUBWALLET_NUMBER`

## Testnet deploy

Через alias-команду:

```bash
npm run deploy:testnet -- --tonconnect
```

или

```bash
npm run deploy:testnet -- --mnemonic
```

Скрипт деплоя:

- читает `.env`
- валидирует обязательные поля
- выводит предсказанный адрес контракта
- отправляет deploy
- ждёт подтверждения в сети

## Что подтверждено в сети

- сценарий `dispute -> split resolution`
- сценарий `happy path`
- раздельные роли `customer`, `executor`, `platformArbiter`, `feeWallet`
- payout metadata в getter после финального settlement

Подробный отчёт со ссылками на explorer лежит в [../testnet/VALIDATION.md](../testnet/VALIDATION.md).

## Что помнить при интеграции

- один контракт = одна сделка
- новый `init config` даёт новый адрес контракта
- заказчик должен отправлять депозит не меньше `reward + fee`
- если депозит больше `reward + fee`, surplus возвращается заказчику на settlement
- getter `dealState()` хранит `fundedAmount`, payout-поля, `resolutionType`, `finalizedAt`
