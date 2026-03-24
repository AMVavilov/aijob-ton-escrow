import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Cell, toNano } from '@ton/core';
import { compile } from '@ton/blueprint';
import '@ton/test-utils';

import {
    SecureTaskDealV1,
    SecureTaskDealV1Config,
    SecureTaskDealV1ResolutionTypes,
    SecureTaskDealV1States,
} from '../wrappers/SecureTaskDealV1';

describe('SecureTaskDealV1', () => {
    const rewardAmount = toNano('5');
    const feeAmount = toNano('0.15');
    const totalAmount = toNano('5.15');
    const fundedAmount = toNano('5.20');
    const fundedSurplus = toNano('0.05');

    let code: Cell;
    let baseConfig: SecureTaskDealV1Config;

    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let customer: SandboxContract<TreasuryContract>;
    let executor: SandboxContract<TreasuryContract>;
    let platform: SandboxContract<TreasuryContract>;
    let feeWallet: SandboxContract<TreasuryContract>;
    let secureTaskDealV1: SandboxContract<SecureTaskDealV1>;

    beforeAll(async () => {
        code = await compile('SecureTaskDealV1');
    });

    const configFrom = (cfg: {
        customer: SandboxContract<TreasuryContract>;
        executor: SandboxContract<TreasuryContract>;
        platform: SandboxContract<TreasuryContract>;
        feeWallet: SandboxContract<TreasuryContract>;
    }): SecureTaskDealV1Config => ({
        customer: cfg.customer.address,
        executor: cfg.executor.address,
        platformArbiter: cfg.platform.address,
        feeWallet: cfg.feeWallet.address,
        rewardAmount,
        feeAmount,
        fundingDeadline: 1_900_000_000,
        deliveryDeadline: 1_900_086_400,
        reviewDeadline: 1_900_172_800,
    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        deployer = await blockchain.treasury('deployer');
        customer = await blockchain.treasury('customer');
        executor = await blockchain.treasury('executor');
        platform = await blockchain.treasury('platform');
        feeWallet = await blockchain.treasury('fee-wallet');
        baseConfig = configFrom({ customer, executor, platform, feeWallet });

        secureTaskDealV1 = blockchain.openContract(
            SecureTaskDealV1.createFromConfig(baseConfig, code),
        );

        const deployResult = await secureTaskDealV1.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: secureTaskDealV1.address,
            deploy: true,
            success: true,
        });
    });

    async function fundDeal() {
        return secureTaskDealV1.sendDeposit(customer.getSender(), fundedAmount);
    }

    async function fundAndDeliver() {
        await fundDeal();
        return secureTaskDealV1.sendMarkDelivered(executor.getSender(), toNano('0.05'));
    }

    it('deploys with expected initial state and settlement metadata', async () => {
        const state = await secureTaskDealV1.getDealState();

        expect(state.state).toBe(SecureTaskDealV1States.created);
        expect(state.customer.equals(customer.address)).toBe(true);
        expect(state.executor.equals(executor.address)).toBe(true);
        expect(state.platformArbiter.equals(platform.address)).toBe(true);
        expect(state.feeWallet.equals(feeWallet.address)).toBe(true);
        expect(state.rewardAmount).toEqual(rewardAmount);
        expect(state.feeAmount).toEqual(feeAmount);
        expect(state.totalAmount).toEqual(totalAmount);
        expect(state.fundedAmount).toEqual(toNano('0'));
        expect(state.customerPayout).toEqual(toNano('0'));
        expect(state.executorPayout).toEqual(toNano('0'));
        expect(state.feePayout).toEqual(toNano('0'));
        expect(state.resolutionType).toBe(SecureTaskDealV1ResolutionTypes.none);
        expect(state.finalizedAt).toBe(0);
    });

    it('rejects invalid config on deploy', async () => {
        const invalidContract = blockchain.openContract(
            SecureTaskDealV1.createFromConfig(
                {
                    ...baseConfig,
                    executor: customer.address,
                },
                code,
            ),
        );

        const result = await invalidContract.sendDeploy(deployer.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: deployer.address,
            to: invalidContract.address,
            deploy: true,
            success: false,
            exitCode: 407,
        });
    });

    it('moves to FUNDED after customer deposit and stores funded amount', async () => {
        const depositResult = await fundDeal();

        expect(depositResult.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: true,
        });

        const state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.funded);
        expect(state.fundedAmount).toEqual(fundedAmount);
    });

    it('completes happy path, records payouts, and returns surplus to customer', async () => {
        await fundAndDeliver();

        const confirmResult = await secureTaskDealV1.sendConfirmCompletion(
            customer.getSender(),
            toNano('0.05'),
        );

        expect(confirmResult.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: true,
        });
        expect(confirmResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: customer.address,
            success: true,
        });
        expect(confirmResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: executor.address,
            success: true,
        });
        expect(confirmResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: feeWallet.address,
            success: true,
        });

        const state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.completed);
        expect(state.customerPayout).toEqual(fundedSurplus);
        expect(state.executorPayout).toEqual(rewardAmount);
        expect(state.feePayout).toEqual(feeAmount);
        expect(state.resolutionType).toBe(SecureTaskDealV1ResolutionTypes.customerConfirm);
        expect(state.finalizedAt).toBeGreaterThan(0);
    });

    it('opens dispute after delivery and lets platform release funds', async () => {
        await fundAndDeliver();

        const disputeResult = await secureTaskDealV1.sendOpenDispute(customer.getSender(), toNano('0.05'));

        expect(disputeResult.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: true,
        });

        let state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.disputed);

        const releaseResult = await secureTaskDealV1.sendPlatformRelease(
            platform.getSender(),
            toNano('0.05'),
        );

        expect(releaseResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: executor.address,
            success: true,
        });
        expect(releaseResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: feeWallet.address,
            success: true,
        });

        state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.completed);
        expect(state.customerPayout).toEqual(fundedSurplus);
        expect(state.executorPayout).toEqual(rewardAmount);
        expect(state.feePayout).toEqual(feeAmount);
        expect(state.resolutionType).toBe(SecureTaskDealV1ResolutionTypes.platformRelease);
    });

    it('opens dispute after delivery and lets platform refund customer', async () => {
        await fundAndDeliver();
        await secureTaskDealV1.sendOpenDispute(executor.getSender(), toNano('0.05'));

        const refundResult = await secureTaskDealV1.sendPlatformRefund(
            platform.getSender(),
            toNano('0.05'),
        );

        expect(refundResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: customer.address,
            success: true,
        });

        const state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.refunded);
        expect(state.customerPayout).toEqual(fundedAmount);
        expect(state.executorPayout).toEqual(toNano('0'));
        expect(state.feePayout).toEqual(toNano('0'));
        expect(state.resolutionType).toBe(SecureTaskDealV1ResolutionTypes.platformRefund);
    });

    it('supports split resolution via platform arbiter', async () => {
        await fundAndDeliver();
        await secureTaskDealV1.sendOpenDispute(customer.getSender(), toNano('0.05'));

        const splitResult = await secureTaskDealV1.sendPlatformResolveSplit(
            platform.getSender(),
            toNano('2'),
            toNano('3'),
            toNano('0.05'),
        );

        expect(splitResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: customer.address,
            success: true,
        });
        expect(splitResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: executor.address,
            success: true,
        });
        expect(splitResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: feeWallet.address,
            success: true,
        });

        const state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.completed);
        expect(state.customerPayout).toEqual(toNano('2.05'));
        expect(state.executorPayout).toEqual(toNano('3'));
        expect(state.feePayout).toEqual(feeAmount);
        expect(state.resolutionType).toBe(SecureTaskDealV1ResolutionTypes.platformSplit);
    });

    it('refunds after delivery timeout if work was never delivered', async () => {
        await fundDeal();
        blockchain.now = baseConfig.deliveryDeadline + 10;

        const refundResult = await secureTaskDealV1.sendRefundAfterDeliveryTimeout(
            platform.getSender(),
            toNano('0.05'),
        );

        expect(refundResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: customer.address,
            success: true,
        });

        const state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.refunded);
        expect(state.customerPayout).toEqual(fundedAmount);
        expect(state.resolutionType).toBe(SecureTaskDealV1ResolutionTypes.deliveryTimeoutRefund);
    });

    it('allows opening dispute from FUNDED after delivery deadline passes', async () => {
        await fundDeal();
        blockchain.now = baseConfig.deliveryDeadline + 1;

        const result = await secureTaskDealV1.sendOpenDispute(customer.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: true,
        });

        const state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.disputed);
    });

    it('releases by timeout after review deadline', async () => {
        await fundAndDeliver();
        blockchain.now = baseConfig.reviewDeadline + 10;

        const timeoutResult = await secureTaskDealV1.sendTimeoutAfterReview(
            platform.getSender(),
            toNano('0.05'),
        );

        expect(timeoutResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: executor.address,
            success: true,
        });
        expect(timeoutResult.transactions).toHaveTransaction({
            from: secureTaskDealV1.address,
            to: feeWallet.address,
            success: true,
        });

        const state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.completed);
        expect(state.resolutionType).toBe(SecureTaskDealV1ResolutionTypes.reviewTimeout);
    });

    it('allows cancellation before funding', async () => {
        const result = await secureTaskDealV1.sendCancelBeforeFunding(customer.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: true,
        });

        const state = await secureTaskDealV1.getDealState();
        expect(state.state).toBe(SecureTaskDealV1States.cancelled);
        expect(state.resolutionType).toBe(SecureTaskDealV1ResolutionTypes.cancelled);
    });

    it('allows permissionless cancellation before funding after funding deadline', async () => {
        blockchain.now = baseConfig.fundingDeadline + 10;

        const result = await secureTaskDealV1.sendCancelBeforeFunding(executor.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: executor.address,
            to: secureTaskDealV1.address,
            success: true,
        });
    });

    it('rejects deposit from non-customer', async () => {
        const result = await secureTaskDealV1.sendDeposit(executor.getSender(), fundedAmount);

        expect(result.transactions).toHaveTransaction({
            from: executor.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 401,
        });
    });

    it('rejects deposit smaller than total amount', async () => {
        const result = await secureTaskDealV1.sendDeposit(customer.getSender(), toNano('5.10'));

        expect(result.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 403,
        });
    });

    it('rejects markDelivered before funding', async () => {
        const result = await secureTaskDealV1.sendMarkDelivered(executor.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: executor.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 402,
        });
    });

    it('rejects confirmCompletion from non-customer', async () => {
        await fundAndDeliver();

        const result = await secureTaskDealV1.sendConfirmCompletion(executor.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: executor.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 401,
        });
    });

    it('rejects platform release from non-arbiter', async () => {
        await fundAndDeliver();
        await secureTaskDealV1.sendOpenDispute(customer.getSender(), toNano('0.05'));

        const result = await secureTaskDealV1.sendPlatformRelease(customer.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 401,
        });
    });

    it('rejects timeout before review deadline', async () => {
        await fundAndDeliver();
        blockchain.now = baseConfig.reviewDeadline - 10;

        const result = await secureTaskDealV1.sendTimeoutAfterReview(platform.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: platform.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 406,
        });
    });

    it('rejects delivery timeout refund before deadline', async () => {
        await fundDeal();
        blockchain.now = baseConfig.deliveryDeadline - 10;

        const result = await secureTaskDealV1.sendRefundAfterDeliveryTimeout(
            customer.getSender(),
            toNano('0.05'),
        );

        expect(result.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 406,
        });
    });

    it('rejects dispute from FUNDED before delivery deadline', async () => {
        await fundDeal();

        const result = await secureTaskDealV1.sendOpenDispute(customer.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 406,
        });
    });

    it('rejects dispute from DELIVERED after review window closes', async () => {
        await fundAndDeliver();
        blockchain.now = baseConfig.reviewDeadline + 1;

        const result = await secureTaskDealV1.sendOpenDispute(customer.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 404,
        });
    });

    it('rejects invalid split amounts', async () => {
        await fundAndDeliver();
        await secureTaskDealV1.sendOpenDispute(customer.getSender(), toNano('0.05'));

        const result = await secureTaskDealV1.sendPlatformResolveSplit(
            platform.getSender(),
            toNano('2'),
            toNano('2.5'),
            toNano('0.05'),
        );

        expect(result.transactions).toHaveTransaction({
            from: platform.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 408,
        });
    });

    it('rejects repeated state-changing call after completion', async () => {
        await fundAndDeliver();
        await secureTaskDealV1.sendConfirmCompletion(customer.getSender(), toNano('0.05'));

        const result = await secureTaskDealV1.sendOpenDispute(customer.getSender(), toNano('0.05'));

        expect(result.transactions).toHaveTransaction({
            from: customer.address,
            to: secureTaskDealV1.address,
            success: false,
            exitCode: 402,
        });
    });
});
