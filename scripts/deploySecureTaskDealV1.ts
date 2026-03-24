import 'dotenv/config';

import { Address, toNano } from '@ton/core';
import { compile, NetworkProvider } from '@ton/blueprint';

import { SecureTaskDealV1 } from '../wrappers/SecureTaskDealV1';

function requireEnv(name: string) {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing required env var: ${name}`);
    }

    return value;
}

export async function run(provider: NetworkProvider) {
    const rewardTon = requireEnv('AIJOB_REWARD_TON');
    const feeTon = requireEnv('AIJOB_FEE_TON');

    const contract = provider.open(
        SecureTaskDealV1.createFromConfig(
            {
                customer: Address.parse(requireEnv('AIJOB_CUSTOMER_ADDRESS')),
                executor: Address.parse(requireEnv('AIJOB_EXECUTOR_ADDRESS')),
                platformArbiter: Address.parse(requireEnv('AIJOB_PLATFORM_ARBITER_ADDRESS')),
                feeWallet: Address.parse(requireEnv('AIJOB_FEE_WALLET_ADDRESS')),
                rewardAmount: toNano(rewardTon),
                feeAmount: toNano(feeTon),
                fundingDeadline: Number(requireEnv('AIJOB_FUNDING_DEADLINE')),
                deliveryDeadline: Number(requireEnv('AIJOB_DELIVERY_DEADLINE')),
                reviewDeadline: Number(requireEnv('AIJOB_REVIEW_DEADLINE')),
            },
            await compile('SecureTaskDealV1'),
        ),
    );

    console.log('Deploying SecureTaskDealV1');
    console.log(`Reward: ${rewardTon} TON`);
    console.log(`Fee: ${feeTon} TON`);
    console.log(`Predicted address: ${contract.address.toString()}`);

    await contract.sendDeploy(provider.sender(), toNano('0.05'));
    await provider.waitForDeploy(contract.address);

    console.log(`Deployed at: ${contract.address.toString()}`);
}
