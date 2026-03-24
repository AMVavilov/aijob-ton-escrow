import {
    Address,
    beginCell,
    Cell,
    Contract,
    ContractABI,
    contractAddress,
    ContractProvider,
    Sender,
    SendMode,
} from '@ton/core';

export const SecureTaskDealV1Opcodes = {
    deposit: 0x1,
    markDelivered: 0x2,
    confirmCompletion: 0x3,
    openDispute: 0x4,
    platformRelease: 0x5,
    platformRefund: 0x6,
    cancelBeforeFunding: 0x7,
    timeoutAfterReview: 0x8,
    platformResolveSplit: 0x9,
    refundAfterDeliveryTimeout: 0xA,
} as const;

export const SecureTaskDealV1States = {
    created: 0,
    funded: 1,
    delivered: 2,
    disputed: 3,
    completed: 4,
    refunded: 5,
    cancelled: 6,
} as const;

export const SecureTaskDealV1ResolutionTypes = {
    none: 0,
    customerConfirm: 1,
    platformRelease: 2,
    platformRefund: 3,
    platformSplit: 4,
    reviewTimeout: 5,
    deliveryTimeoutRefund: 6,
    cancelled: 7,
} as const;

export type SecureTaskDealV1Config = {
    customer: Address;
    executor: Address;
    platformArbiter: Address;
    feeWallet: Address;
    rewardAmount: bigint;
    feeAmount: bigint;
    fundingDeadline: number;
    deliveryDeadline: number;
    reviewDeadline: number;
    state?: number;
};

export type SecureTaskDealV1State = {
    state: number;
    customer: Address;
    executor: Address;
    platformArbiter: Address;
    feeWallet: Address;
    rewardAmount: bigint;
    feeAmount: bigint;
    totalAmount: bigint;
    fundingDeadline: number;
    deliveryDeadline: number;
    reviewDeadline: number;
    fundedAmount: bigint;
    customerPayout: bigint;
    executorPayout: bigint;
    feePayout: bigint;
    resolutionType: number;
    finalizedAt: number;
};

export function secureTaskDealV1ConfigToCell(config: SecureTaskDealV1Config): Cell {
    const participantsCell = beginCell()
        .storeAddress(config.customer)
        .storeAddress(config.executor)
        .endCell();

    const platformCell = beginCell()
        .storeAddress(config.platformArbiter)
        .storeAddress(config.feeWallet)
        .endCell();

    const termsCell = beginCell()
        .storeCoins(config.rewardAmount)
        .storeCoins(config.feeAmount)
        .storeUint(config.fundingDeadline, 32)
        .storeUint(config.deliveryDeadline, 32)
        .storeUint(config.reviewDeadline, 32)
        .endCell();

    const dealConfigCell = beginCell()
        .storeRef(participantsCell)
        .storeRef(platformCell)
        .storeRef(termsCell)
        .endCell();

    return beginCell()
        .storeRef(dealConfigCell)
        .storeUint(config.state ?? 0, 8)
        .storeCoins(0)
        .storeCoins(0)
        .storeCoins(0)
        .storeCoins(0)
        .storeUint(0, 8)
        .storeUint(0, 32)
        .endCell();
}

function opcodeBody(op: number) {
    return beginCell().storeUint(op, 32).endCell();
}

function splitOpcodeBody(op: number, customerAmount: bigint, executorAmount: bigint) {
    return beginCell()
        .storeUint(op, 32)
        .storeCoins(customerAmount)
        .storeCoins(executorAmount)
        .endCell();
}

export class SecureTaskDealV1 implements Contract {
    abi: ContractABI = { name: 'SecureTaskDealV1' };

    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static createFromAddress(address: Address) {
        return new SecureTaskDealV1(address);
    }

    static createFromConfig(config: SecureTaskDealV1Config, code: Cell, workchain = 0) {
        const data = secureTaskDealV1ConfigToCell(config);
        const init = { code, data };
        return new SecureTaskDealV1(contractAddress(workchain, init), init);
    }

    async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: beginCell().endCell(),
        });
    }

    async sendDeposit(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: opcodeBody(SecureTaskDealV1Opcodes.deposit),
        });
    }

    async sendMarkDelivered(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: opcodeBody(SecureTaskDealV1Opcodes.markDelivered),
        });
    }

    async sendConfirmCompletion(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: opcodeBody(SecureTaskDealV1Opcodes.confirmCompletion),
        });
    }

    async sendOpenDispute(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: opcodeBody(SecureTaskDealV1Opcodes.openDispute),
        });
    }

    async sendPlatformRelease(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: opcodeBody(SecureTaskDealV1Opcodes.platformRelease),
        });
    }

    async sendPlatformRefund(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: opcodeBody(SecureTaskDealV1Opcodes.platformRefund),
        });
    }

    async sendCancelBeforeFunding(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: opcodeBody(SecureTaskDealV1Opcodes.cancelBeforeFunding),
        });
    }

    async sendTimeoutAfterReview(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: opcodeBody(SecureTaskDealV1Opcodes.timeoutAfterReview),
        });
    }

    async sendPlatformResolveSplit(
        provider: ContractProvider,
        via: Sender,
        customerAmount: bigint,
        executorAmount: bigint,
        value: bigint,
    ) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: splitOpcodeBody(
                SecureTaskDealV1Opcodes.platformResolveSplit,
                customerAmount,
                executorAmount,
            ),
        });
    }

    async sendRefundAfterDeliveryTimeout(provider: ContractProvider, via: Sender, value: bigint) {
        await provider.internal(via, {
            value,
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: opcodeBody(SecureTaskDealV1Opcodes.refundAfterDeliveryTimeout),
        });
    }

    async getDealState(provider: ContractProvider): Promise<SecureTaskDealV1State> {
        const result = await provider.get('dealState', []);

        return {
            state: result.stack.readNumber(),
            customer: result.stack.readAddress(),
            executor: result.stack.readAddress(),
            platformArbiter: result.stack.readAddress(),
            feeWallet: result.stack.readAddress(),
            rewardAmount: result.stack.readBigNumber(),
            feeAmount: result.stack.readBigNumber(),
            totalAmount: result.stack.readBigNumber(),
            fundingDeadline: result.stack.readNumber(),
            deliveryDeadline: result.stack.readNumber(),
            reviewDeadline: result.stack.readNumber(),
            fundedAmount: result.stack.readBigNumber(),
            customerPayout: result.stack.readBigNumber(),
            executorPayout: result.stack.readBigNumber(),
            feePayout: result.stack.readBigNumber(),
            resolutionType: result.stack.readNumber(),
            finalizedAt: result.stack.readNumber(),
        };
    }
}
