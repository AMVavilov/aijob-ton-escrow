# State Machine `secure_task_deal_v1`

## Состояния

- `CREATED` — контракт создан, депозит ещё не внесён
- `FUNDED` — депозит внесён заказчиком
- `DELIVERED` — исполнитель отметил работу как выполненную
- `DISPUTED` — открыт спор
- `COMPLETED` — сделка завершена payout-сценарием:
  - `confirmCompletion`
  - `platformRelease`
  - `platformResolveSplit`
  - `timeoutAfterReview`
- `REFUNDED` — деньги возвращены заказчику:
  - `platformRefund`
  - `refundAfterDeliveryTimeout`
- `CANCELLED` — сделка отменена до пополнения

Дополнительно getter хранит `resolutionType`, чтобы отличать тип финального исхода.

## Переходы

`CREATED -> FUNDED`
- действие: `deposit`
- кто вызывает: заказчик

`CREATED -> CANCELLED`
- действие: `cancelBeforeFunding`
- кто вызывает:
  - до `fundingDeadline`: заказчик или площадка
  - после `fundingDeadline`: любой

`FUNDED -> DELIVERED`
- действие: `markDelivered`
- кто вызывает: исполнитель

`FUNDED -> DISPUTED`
- действие: `openDispute`
- кто вызывает: заказчик или исполнитель
- условие: `deliveryDeadline` уже истёк

`FUNDED -> REFUNDED`
- действие: `refundAfterDeliveryTimeout`
- кто вызывает: любой
- условие: `deliveryDeadline` уже истёк

`DELIVERED -> COMPLETED`
- действие: `confirmCompletion`
- кто вызывает: заказчик

`DELIVERED -> COMPLETED`
- действие: `timeoutAfterReview`
- кто вызывает: любой
- условие: review deadline истёк

`DELIVERED -> DISPUTED`
- действие: `openDispute`
- кто вызывает: заказчик или исполнитель
- условие: review deadline ещё не истёк

`DISPUTED -> COMPLETED`
- действие: `platformRelease`
- кто вызывает: площадка

`DISPUTED -> COMPLETED`
- действие: `platformResolveSplit`
- кто вызывает: площадка

`DISPUTED -> REFUNDED`
- действие: `platformRefund`
- кто вызывает: площадка

## Что важно для `v1`

- после `COMPLETED`, `REFUNDED`, `CANCELLED` сделка считается завершённой
- спор в `v1` может завершиться:
  - `release`
  - `refund`
  - `split resolution`
- delivery timeout больше не оставляет деньги в подвешенном состоянии
- surplus депозита не остаётся навсегда внутри контракта: он возвращается заказчику при settlement
- логика дедлайнов хранится on-chain, но сами причины решения формируются off-chain
