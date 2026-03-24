const STATE_CREATED = 0
const STATE_FUNDED = 1
const STATE_DELIVERED = 2
const STATE_DISPUTED = 3
const STATE_COMPLETED = 4
const STATE_REFUNDED = 5
const STATE_CANCELLED = 6

const OP_DEPOSIT = 0x1
const OP_MARK_DELIVERED = 0x2
const OP_CONFIRM_COMPLETION = 0x3
const OP_OPEN_DISPUTE = 0x4
const OP_PLATFORM_RELEASE = 0x5
const OP_PLATFORM_REFUND = 0x6
const OP_CANCEL_BEFORE_FUNDING = 0x7
const OP_TIMEOUT_AFTER_REVIEW = 0x8
const OP_PLATFORM_RESOLVE_SPLIT = 0x9
const OP_REFUND_AFTER_DELIVERY_TIMEOUT = 0xA

const ERR_UNAUTHORIZED = 401
const ERR_INVALID_STATE = 402
const ERR_WRONG_AMOUNT = 403
const ERR_DEADLINE_REACHED = 404
const ERR_TIMEOUT_NOT_REACHED = 406
const ERR_INVALID_CONFIG = 407
const ERR_WRONG_SPLIT = 408

const RESOLUTION_NONE = 0
const RESOLUTION_CUSTOMER_CONFIRM = 1
const RESOLUTION_PLATFORM_RELEASE = 2
const RESOLUTION_PLATFORM_REFUND = 3
const RESOLUTION_PLATFORM_SPLIT = 4
const RESOLUTION_REVIEW_TIMEOUT = 5
const RESOLUTION_DELIVERY_TIMEOUT_REFUND = 6
const RESOLUTION_CANCELLED = 7

struct ParticipantAddresses {
    customer: address
    executor: address
}

struct PlatformAddresses {
    platformArbiter: address
    feeWallet: address
}

struct DealTerms {
    rewardAmount: coins
    feeAmount: coins
    fundingDeadline: uint32
    deliveryDeadline: uint32
    reviewDeadline: uint32
}

struct DealConfig {
    participants: Cell<ParticipantAddresses>
    platform: Cell<PlatformAddresses>
    terms: Cell<DealTerms>
}

struct Storage {
    config: Cell<DealConfig>
    state: uint8
    fundedAmount: coins
    customerPayout: coins
    executorPayout: coins
    feePayout: coins
    resolutionType: uint8
    finalizedAt: uint32
}

fun Storage.load() {
    return Storage.fromCell(contract.getData())
}

fun Storage.save(self) {
    contract.setData(self.toCell())
}

struct DealStateData {
    state: uint8
    customer: address
    executor: address
    platformArbiter: address
    feeWallet: address
    rewardAmount: coins
    feeAmount: coins
    totalAmount: coins
    fundingDeadline: uint32
    deliveryDeadline: uint32
    reviewDeadline: uint32
    fundedAmount: coins
    customerPayout: coins
    executorPayout: coins
    feePayout: coins
    resolutionType: uint8
    finalizedAt: uint32
}

fun DealTerms.totalAmount(self): coins {
    return self.rewardAmount + self.feeAmount
}

fun sendTon(dest: address, value: coins) {
    if (value == ton("0")) {
        return;
    }

    val outMsg = createMessage({
        bounce: BounceMode.NoBounce,
        value: value,
        dest: dest,
    });
    outMsg.send(SEND_MODE_PAY_FEES_SEPARATELY);
}

fun sendAllBalance(dest: address) {
    val outMsg = createMessage({
        bounce: BounceMode.NoBounce,
        value: ton("0"),
        dest: dest,
    });
    outMsg.send(SEND_MODE_CARRY_ALL_BALANCE | SEND_MODE_IGNORE_ERRORS);
}

fun validateConfig(config: DealConfig) {
    val participants = config.participants.load();
    val platform = config.platform.load();
    val terms = config.terms.load();

    assert (participants.customer != participants.executor) throw ERR_INVALID_CONFIG;
    assert (participants.customer != platform.platformArbiter) throw ERR_INVALID_CONFIG;
    assert (participants.executor != platform.platformArbiter) throw ERR_INVALID_CONFIG;
    assert (platform.platformArbiter != platform.feeWallet) throw ERR_INVALID_CONFIG;
    assert (terms.rewardAmount > ton("0")) throw ERR_INVALID_CONFIG;
    assert (terms.fundingDeadline < terms.deliveryDeadline) throw ERR_INVALID_CONFIG;
    assert (terms.deliveryDeadline < terms.reviewDeadline) throw ERR_INVALID_CONFIG;
}

fun surplusAmount(storage: Storage, terms: DealTerms): coins {
    return storage.fundedAmount - terms.totalAmount()
}

fun completeSettlement(storage: Storage, state: uint8, resolutionType: uint8, customerPayout: coins, executorPayout: coins, feePayout: coins) {
    storage.state = state;
    storage.customerPayout = customerPayout;
    storage.executorPayout = executorPayout;
    storage.feePayout = feePayout;
    storage.resolutionType = resolutionType;
    storage.finalizedAt = blockchain.now();
    storage.save();
}

fun settle(config: DealConfig, storage: Storage, state: uint8, resolutionType: uint8, customerPayout: coins, executorPayout: coins, feePayout: coins) {
    val participants = config.participants.load();

    completeSettlement(storage, state, resolutionType, customerPayout, executorPayout, feePayout);
    sendTon(participants.customer, customerPayout);
    sendTon(participants.executor, executorPayout);
    sendTon(config.platform.load().feeWallet, feePayout);
    sendAllBalance(participants.customer);
}

fun settleRelease(config: DealConfig, storage: Storage, resolutionType: uint8) {
    val terms = config.terms.load();
    val customerPayout = surplusAmount(storage, terms);
    settle(config, storage, STATE_COMPLETED, resolutionType, customerPayout, terms.rewardAmount, terms.feeAmount);
}

fun settleRefund(config: DealConfig, storage: Storage, resolutionType: uint8) {
    settle(config, storage, STATE_REFUNDED, resolutionType, storage.fundedAmount, ton("0"), ton("0"));
}

fun settleSplit(config: DealConfig, storage: Storage, customerAmount: coins, executorAmount: coins) {
    val terms = config.terms.load();

    assert (customerAmount + executorAmount + terms.feeAmount == terms.totalAmount()) throw ERR_WRONG_SPLIT;

    val customerPayout = customerAmount + surplusAmount(storage, terms);
    settle(config, storage, STATE_COMPLETED, RESOLUTION_PLATFORM_SPLIT, customerPayout, executorAmount, terms.feeAmount);
}

fun onInternalMessage(in: InMessage) {
    var storage = lazy Storage.load();
    val config = storage.config.load();
    validateConfig(config);

    if (in.body.isEmpty()) {
        return;
    }

    assert (in.body.remainingBitsCount() >= 32) throw 0xFFFF;

    var body = in.body;
    val opcode = body.loadUint(32);

    if (opcode == OP_DEPOSIT) {
        val participants = config.participants.load();
        val terms = config.terms.load();

        assert (in.senderAddress == participants.customer) throw ERR_UNAUTHORIZED;
        assert (storage.state == STATE_CREATED) throw ERR_INVALID_STATE;
        assert (blockchain.now() < terms.fundingDeadline) throw ERR_DEADLINE_REACHED;
        assert (in.valueCoins >= terms.totalAmount()) throw ERR_WRONG_AMOUNT;

        storage.state = STATE_FUNDED;
        storage.fundedAmount = in.valueCoins;
        storage.save();
        return;
    }

    if (opcode == OP_MARK_DELIVERED) {
        val participants = config.participants.load();
        val terms = config.terms.load();

        assert (in.senderAddress == participants.executor) throw ERR_UNAUTHORIZED;
        assert (storage.state == STATE_FUNDED) throw ERR_INVALID_STATE;
        assert (blockchain.now() <= terms.deliveryDeadline) throw ERR_DEADLINE_REACHED;

        storage.state = STATE_DELIVERED;
        storage.save();
        return;
    }

    if (opcode == OP_CONFIRM_COMPLETION) {
        val participants = config.participants.load();

        assert (in.senderAddress == participants.customer) throw ERR_UNAUTHORIZED;
        assert (storage.state == STATE_DELIVERED) throw ERR_INVALID_STATE;

        settleRelease(config, storage, RESOLUTION_CUSTOMER_CONFIRM);
        return;
    }

    if (opcode == OP_OPEN_DISPUTE) {
        val participants = config.participants.load();
        val terms = config.terms.load();

        assert (in.senderAddress == participants.customer || in.senderAddress == participants.executor) throw ERR_UNAUTHORIZED;
        assert (storage.state == STATE_FUNDED || storage.state == STATE_DELIVERED) throw ERR_INVALID_STATE;

        if (storage.state == STATE_FUNDED) {
            assert (blockchain.now() > terms.deliveryDeadline) throw ERR_TIMEOUT_NOT_REACHED;
        }

        if (storage.state == STATE_DELIVERED) {
            assert (blockchain.now() <= terms.reviewDeadline) throw ERR_DEADLINE_REACHED;
        }

        storage.state = STATE_DISPUTED;
        storage.save();
        return;
    }

    if (opcode == OP_PLATFORM_RELEASE) {
        val platform = config.platform.load();

        assert (in.senderAddress == platform.platformArbiter) throw ERR_UNAUTHORIZED;
        assert (storage.state == STATE_DISPUTED) throw ERR_INVALID_STATE;

        settleRelease(config, storage, RESOLUTION_PLATFORM_RELEASE);
        return;
    }

    if (opcode == OP_PLATFORM_REFUND) {
        val platform = config.platform.load();

        assert (in.senderAddress == platform.platformArbiter) throw ERR_UNAUTHORIZED;
        assert (storage.state == STATE_DISPUTED) throw ERR_INVALID_STATE;

        settleRefund(config, storage, RESOLUTION_PLATFORM_REFUND);
        return;
    }

    if (opcode == OP_CANCEL_BEFORE_FUNDING) {
        val participants = config.participants.load();
        val platform = config.platform.load();
        val terms = config.terms.load();

        assert (storage.state == STATE_CREATED) throw ERR_INVALID_STATE;

        if (blockchain.now() < terms.fundingDeadline) {
            assert (in.senderAddress == participants.customer || in.senderAddress == platform.platformArbiter) throw ERR_UNAUTHORIZED;
        }

        completeSettlement(storage, STATE_CANCELLED, RESOLUTION_CANCELLED, ton("0"), ton("0"), ton("0"));
        return;
    }

    if (opcode == OP_TIMEOUT_AFTER_REVIEW) {
        val terms = config.terms.load();

        assert (storage.state == STATE_DELIVERED) throw ERR_INVALID_STATE;
        assert (blockchain.now() >= terms.reviewDeadline) throw ERR_TIMEOUT_NOT_REACHED;

        settleRelease(config, storage, RESOLUTION_REVIEW_TIMEOUT);
        return;
    }

    if (opcode == OP_PLATFORM_RESOLVE_SPLIT) {
        val platform = config.platform.load();
        val customerAmount = body.loadCoins();
        val executorAmount = body.loadCoins();

        assert (in.senderAddress == platform.platformArbiter) throw ERR_UNAUTHORIZED;
        assert (storage.state == STATE_DISPUTED) throw ERR_INVALID_STATE;

        settleSplit(config, storage, customerAmount, executorAmount);
        return;
    }

    if (opcode == OP_REFUND_AFTER_DELIVERY_TIMEOUT) {
        val terms = config.terms.load();

        assert (storage.state == STATE_FUNDED) throw ERR_INVALID_STATE;
        assert (blockchain.now() > terms.deliveryDeadline) throw ERR_TIMEOUT_NOT_REACHED;

        settleRefund(config, storage, RESOLUTION_DELIVERY_TIMEOUT_REFUND);
        return;
    }

    throw 0xFFFF;
}

fun onBouncedMessage(in: InMessageBounced) {
    return;
}

get fun dealState(): DealStateData {
    val storage = lazy Storage.load();
    val config = storage.config.load();
    val participants = config.participants.load();
    val platform = config.platform.load();
    val terms = config.terms.load();
    validateConfig(config);

    return {
        state: storage.state,
        customer: participants.customer,
        executor: participants.executor,
        platformArbiter: platform.platformArbiter,
        feeWallet: platform.feeWallet,
        rewardAmount: terms.rewardAmount,
        feeAmount: terms.feeAmount,
        totalAmount: terms.totalAmount(),
        fundingDeadline: terms.fundingDeadline,
        deliveryDeadline: terms.deliveryDeadline,
        reviewDeadline: terms.reviewDeadline,
        fundedAmount: storage.fundedAmount,
        customerPayout: storage.customerPayout,
        executorPayout: storage.executorPayout,
        feePayout: storage.feePayout,
        resolutionType: storage.resolutionType,
        finalizedAt: storage.finalizedAt,
    };
}
