# Testnet Deploy `SecureTaskDealV1`

## Что нужно

- кошелёк для деплоя в TON testnet
- testnet TON на этом кошельке
- заполненный `.env` на основе `.env.testnet.example`

## Подготовка

1. Скопировать шаблон:

```bash
cp .env.testnet.example .env
```

2. Заполнить:

- `WALLET_MNEMONIC`
- `WALLET_VERSION`
- `WALLET_ID` или `SUBWALLET_NUMBER`
- `AIJOB_CUSTOMER_ADDRESS`
- `AIJOB_EXECUTOR_ADDRESS`
- `AIJOB_PLATFORM_ARBITER_ADDRESS`
- `AIJOB_FEE_WALLET_ADDRESS`
- `AIJOB_REWARD_TON`
- `AIJOB_FEE_TON`
- `AIJOB_FUNDING_DEADLINE`
- `AIJOB_DELIVERY_DEADLINE`
- `AIJOB_REVIEW_DEADLINE`

## Сборка

```bash
npm run build
```

## Деплой в testnet

Через TON Connect:

```bash
npm run deploy:testnet -- --tonconnect
```

Через mnemonic:

```bash
npm run deploy:testnet -- --mnemonic
```

## Что делает скрипт

- читает переменные из `.env`
- собирает init config сделки
- вычисляет адрес контракта
- отправляет deploy
- ждёт подтверждения деплоя

## Важно

- `reward + fee = total deposit`, который потом должен отправить заказчик
- если заказчик отправляет больше `reward + fee`, surplus возвращается ему при settlement
- дедлайны указываются в unix timestamp
- для каждой новой сделки создаётся новый контракт с новым config
- если `deliveryDeadline` сорван, можно открыть спор или вызвать `refundAfterDeliveryTimeout`
- спор площадка может завершить через `release`, `refund` или `split`

## Живые прогоны

Результаты реальных smoke-тестов в `TON testnet` вынесены в отдельный отчёт:

- [../testnet/VALIDATION.md](../testnet/VALIDATION.md)

В отчёте зафиксированы два сценария:

- `dispute -> split resolution`
- `happy path`
