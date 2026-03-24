# AIJob TON Escrow

Smart contract package for the `Secure Deal` flow in `AIJob`.

This repository contains the on-chain escrow contract, TypeScript wrappers, deployment scripts, and tests used to secure one AIJob task with one TON contract.

## Current Status

- Public contract line: `V1`
- Current implementation: hardened second-iteration state machine inside the `V1` contract line
- Language: `Tolk`
- Tooling: `@ton/blueprint`, `@ton/core`, `Jest`

## What The Contract Does

- locks the customer deposit on-chain
- stores customer, executor, platform arbiter, and fee wallet addresses
- tracks funding, delivery, dispute, and settlement states
- supports happy-path completion
- supports platform refund, release, and split resolution
- keeps settlement metadata in getters for UI and audit

## Product Model

- one task = one escrow contract
- customer always funds the deal
- executor is selected at task creation time
- deal amount is immutable after secure deal creation
- platform fee is a separate amount
- dispute analysis can happen off-chain, but the final fund movement is executed on-chain by the platform arbiter

## Repository Structure

- `contracts/secure_task_deal_v1.tolk` - main contract source
- `contracts/docs/STATE_MACHINE.md` - state machine and transitions
- `contracts/docs/OFFCHAIN_BOUNDARY.md` - on-chain vs off-chain split
- `contracts/TESTNET_DEPLOY.md` - testnet deployment notes
- `wrappers/` - TypeScript wrappers and compile entrypoint
- `scripts/` - deployment script
- `tests/` - sandbox tests
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

See also:

- `contracts/TESTNET_DEPLOY.md`
- `testnet/VALIDATION.md`

## Verified On Testnet

The repository includes live validation for:

- `dispute -> split resolution`
- `happy path: deposit -> delivered -> confirmCompletion`
- separate `customer`, `executor`, `platformArbiter`, and `feeWallet`

Explorer-linked report:

- `testnet/VALIDATION.md`

## Integration Notes For AIJob / Lovable

The contract should not be used directly from a public frontend as the main source of truth.

Recommended architecture:

- `Lovable frontend` for task UI and wallet prompts
- `backend / edge functions` for contract config, payload generation, and state sync
- `Supabase or backend DB` for tasks, deal status, dispute summaries, and event history
- `TON` for escrow execution and final settlement

Important:

- keep `platformArbiter` and `feeWallet` as different addresses
- do not store private keys in frontend code
- treat the AI dispute agent as an off-chain recommender, not as the on-chain arbiter

## Notes

- The contract repository is intentionally scoped to TON escrow logic.
- Business logic, chats, AI analysis, and moderation workflows belong to the off-chain application layer.
