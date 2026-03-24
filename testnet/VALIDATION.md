# Testnet Validation

Ниже зафиксированы два live smoke-теста `SecureTaskDealV1`, прогнанные в `TON testnet` реальными on-chain транзакциями.

## Роли

- `customer`: `0QDo-GKwzCMTmn1ZMZEYOzFpZch0SSuTolI7PjaVEyoMM7Mh`
- `executor`: `0QBvIWGe5aoVxG_OQtCHq-M6JRJhIEsanIVCZOqVJ9PYSO-H`
- `platformArbiter`: `0QCv7b8PPgxZiR2wZIle3ETxRxCcmeT-nK_OkWpC6kqj1VQO`
- `feeWallet`: `0QBERERERERERERERERERERERERERERERERERERERERERIwv`

## Scenario 1: Dispute -> Split Resolution

- Contract: [`kQDcMlZKHkGRwgYK1uXUIkV2Gp5g09wMUbZMDmFC2Q2RLNvj`](https://testnet.tonviewer.com/kQDcMlZKHkGRwgYK1uXUIkV2Gp5g09wMUbZMDmFC2Q2RLNvj)
- Flow: `deploy -> deposit -> markDelivered -> openDispute -> platformResolveSplit`
- Deposit: `0.05 TON`
- Result state: `COMPLETED`
- Resolution type: `platformSplit`
- Customer payout: `0.01 TON`
- Executor payout: `0.03 TON`
- Fee payout: `0.01 TON`
- Contract balance after settlement: `0 TON`

## Scenario 2: Happy Path

- Contract: [`kQBHNOBTWI0y6FTZomAQrgjHEd-tc56nyhiJt8mDh0eBzq4H`](https://testnet.tonviewer.com/kQBHNOBTWI0y6FTZomAQrgjHEd-tc56nyhiJt8mDh0eBzq4H)
- Flow: `deploy -> deposit -> markDelivered -> confirmCompletion`
- Deposit: `0.05 TON`
- Result state: `COMPLETED`
- Resolution type: `customerConfirm`
- Customer payout: `0 TON`
- Executor payout: `0.04 TON`
- Fee payout: `0.01 TON`
- Contract balance after settlement: `0 TON`

## What Was Confirmed On-Chain

- contract deployment in `TON testnet`
- role separation for `customer`, `executor`, `platformArbiter`, `feeWallet`
- funding flow
- delivery confirmation by executor
- dispute opening by customer
- split settlement by arbiter
- happy-path completion by customer
- fee distribution to separate `feeWallet`
- getter metadata matches the actual settlement outcome
