# AIJob TON Escrow

TON escrow smart contract package for the `Secure Deal` flow inside `AIJob`.

`AIJob` is a Telegram-first AI task workflow product. This repository contains the on-chain payment and settlement layer used when a task is created as a secure deal: one task, one executor, one escrow contract.

## Elevator Pitch

`AIJob TON Escrow` combines:

- task coordination and communication in `AIJob`
- AI-assisted dispute review off-chain
- final payment execution on `TON`

The goal is simple: keep deal terms explicit, lock funds on-chain, and give the platform a reliable settlement mechanism when work is completed or disputed.

## Why This Exists

Freelance and task-based work often breaks down at the payment stage:

- the customer wants delivery guarantees
- the executor wants funding guarantees
- disputes are messy because evidence lives in chats, files, and task history

This repository solves the payment layer of that problem. The contract keeps funds and enforces settlement rules. The product layer handles communication, AI analysis, moderation, and UX.

## Current Status

- public contract line: `V1`
- current implementation: hardened second-iteration state machine inside the `V1` contract line
- language: `Tolk`
- tooling: `@ton/blueprint`, `@ton/core`, `Jest`
- live validation: confirmed on `TON testnet`

## What The Current Contract Supports

- customer deposit locking
- executor delivery confirmation
- customer completion confirmation
- dispute opening
- platform release
- platform refund
- platform split resolution
- delivery timeout refund
- review timeout completion
- settlement metadata in getters for UI and audit

## Product Assumptions

- one task = one escrow contract
- customer always funds the deal
- executor is selected at task creation time
- deal terms are immutable after secure deal creation
- platform fee is stored separately from the executor reward
- AI can recommend a dispute outcome off-chain, but the final fund movement is executed by the platform arbiter on-chain

## How The Flow Works

1. A task is created in `AIJob` as a secure deal.
2. The customer funds the contract.
3. The executor marks the task as delivered.
4. The customer either confirms completion or opens a dispute.
5. If there is a dispute, the platform resolves it on-chain with:
   - `release`
   - `refund`
   - `split`

## What Lives On-Chain vs Off-Chain

On-chain:

- locked funds
- participant addresses
- deadlines
- state transitions
- final settlement

Off-chain:

- task text
- chat history
- attachments and evidence
- AI dispute analysis
- manual moderation workflow
- product notifications and UI

More detail:

- `contracts/docs/OFFCHAIN_BOUNDARY.md`

## Verified On Testnet

This repository already includes real testnet validation for:

- `dispute -> split resolution`
- `happy path: deposit -> delivered -> confirmCompletion`
- role separation for `customer`, `executor`, `platformArbiter`, and `feeWallet`

Explorer-linked report:

- `testnet/VALIDATION.md`

## Repository Structure

- `contracts/secure_task_deal_v1.tolk` - main contract source
- `contracts/docs/STATE_MACHINE.md` - state machine and transitions
- `contracts/docs/OFFCHAIN_BOUNDARY.md` - on-chain vs off-chain split
- `contracts/TESTNET_DEPLOY.md` - testnet deployment notes
- `wrappers/` - TypeScript wrappers and compile entrypoint
- `scripts/` - deployment script
- `tests/` - sandbox coverage for core flows
- `testnet/VALIDATION.md` - live testnet smoke-test report

## Quick Start

Install dependencies:

```bash
npm install
```

Build the contract:

```bash
npm run build
```

Run tests:

```bash
npm test -- SecureTaskDealV1
```

## Testnet Deployment

Prepare `.env` from `.env.testnet.example`, then run:

```bash
npm run deploy:testnet -- --tonconnect
```

or:

```bash
npm run deploy:testnet -- --mnemonic
```

Deployment and validation references:

- `contracts/TESTNET_DEPLOY.md`
- `testnet/VALIDATION.md`

## Integration Notes For AIJob / Lovable

This contract should not be treated as the main product backend and should not hold business logic that belongs to the app layer.

Recommended architecture:

- `Lovable frontend` for task UI and wallet prompts
- `backend / edge functions` for contract config, payload generation, and state sync
- `Supabase or backend DB` for tasks, deal status, dispute summaries, and event history
- `TON` for escrow execution and final settlement

Important:

- keep `platformArbiter` and `feeWallet` as different addresses
- do not store private keys in frontend code
- keep AI arbitration off-chain
- use the contract as a deterministic settlement engine, not as a chat or moderation system

## Scope

This repository is intentionally scoped to TON escrow logic only.

Business logic, chats, AI analysis, moderation workflows, and the main `AIJob` product experience belong to the off-chain application layer.
