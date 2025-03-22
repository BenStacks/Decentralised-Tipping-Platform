import { Clarinet, Tx, Chain, Account, types } from 'https://deno.land/x/clarinet@v0.14.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

const CONTRACT_ADDRESS = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const CONTRACT_NAME = 'tip-stacks';
const CONTRACT_IDENTIFIER = `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`;

// Helper function to calculate platform fee - should match contract's calculation
function calculatePlatformFee(amount: number): number
{
    return Math.floor((amount * 5) / 100); // 5% fee
}

Clarinet.test({
    name: "Ensure that tipping works correctly with proper fee calculation",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const sender = accounts.get('wallet_1')!;
        const recipient = accounts.get('wallet_2')!;
        const tipAmount = 10000000; // 10 STX
        const platformFee = calculatePlatformFee(tipAmount);
        const actualTipAmount = tipAmount - platformFee;

        // Initial balances
        const senderInitialBalance = sender.balance;
        const recipientInitialBalance = recipient.balance;
        const deployerInitialBalance = deployer.balance;

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'tip',
                [
                    types.principal(recipient.address),
                    types.uint(tipAmount),
                    types.ascii("STX")
                ],
                sender.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Check that the sender's balance decreased by the full amount
        const senderNewBalance = chain.getAssetsMaps().assets[sender.address]['STX'];
        assertEquals(senderNewBalance, senderInitialBalance - tipAmount);

        // Check that the recipient's balance increased by tip amount minus fee
        const recipientNewBalance = chain.getAssetsMaps().assets[recipient.address]['STX'];
        assertEquals(recipientNewBalance, recipientInitialBalance + actualTipAmount);

        // Check that the contract owner received the fee
        const deployerNewBalance = chain.getAssetsMaps().assets[deployer.address]['STX'];
        assertEquals(deployerNewBalance, deployerInitialBalance + platformFee);

        // Verify user stats were updated correctly
        // For sender
        const senderStats = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-user-tip-stats',
            [types.principal(sender.address)],
            sender.address
        );
        const senderStatsResult = senderStats.result.expectTuple();
        assertEquals(senderStatsResult['total-tips-sent'], types.uint(tipAmount));

        // For recipient
        const recipientStats = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-user-tip-stats',
            [types.principal(recipient.address)],
            recipient.address
        );
        const recipientStatsResult = recipientStats.result.expectTuple();
        assertEquals(recipientStatsResult['total-tips-received'], types.uint(actualTipAmount));

        // Verify reward points calculation if amount meets threshold
        const rewardPoints = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-reward-points',
            [types.principal(sender.address), types.uint(tipAmount)],
            sender.address
        );

        if (tipAmount >= 1000000)
        { // 1 STX threshold
            assertEquals(rewardPoints.result, types.uint(10)); // REWARD_RATE is 10
        } else
        {
            assertEquals(rewardPoints.result, types.uint(0));
        }
    },
});

Clarinet.test({
    name: "Ensure tipping fails with invalid token type",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const sender = accounts.get('wallet_1')!;
        const recipient = accounts.get('wallet_2')!;
        const tipAmount = 5000000; // 5 STX

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'tip',
                [
                    types.principal(recipient.address),
                    types.uint(tipAmount),
                    types.ascii("ETH") // Not in allowed tokens list
                ],
                sender.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u11)'); // ERR_INVALID_TOKEN_TYPE
    },
});

Clarinet.test({
    name: "Ensure tipping fails when sending to yourself",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const sender = accounts.get('wallet_1')!;
        const tipAmount = 5000000; // 5 STX

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'tip',
                [
                    types.principal(sender.address), // Same as sender
                    types.uint(tipAmount),
                    types.ascii("STX")
                ],
                sender.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u5)'); // ERR_INVALID_RECIPIENT
    },
});

Clarinet.test({
    name: "Ensure tipping fails when sending to contract owner",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const sender = accounts.get('wallet_1')!;
        const tipAmount = 5000000; // 5 STX

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'tip',
                [
                    types.principal(deployer.address), // Contract owner
                    types.uint(tipAmount),
                    types.ascii("STX")
                ],
                sender.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u5)'); // ERR_INVALID_RECIPIENT
    },
});

Clarinet.test({
    name: "Ensure tipping fails when amount exceeds maximum allowed",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const sender = accounts.get('wallet_1')!;
        const recipient = accounts.get('wallet_2')!;
        const tipAmount = 1100000000; // 1100 STX (MAX_TIP_AMOUNT is 1000 STX)

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'tip',
                [
                    types.principal(recipient.address),
                    types.uint(tipAmount),
                    types.ascii("STX")
                ],
                sender.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u2)'); // ERR_INVALID_AMOUNT
    },
});

Clarinet.test({
    name: "Ensure setting user identity works correctly",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const user = accounts.get('wallet_1')!;
        const username = "satoshi";

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'set-user-identity',
                [
                    types.principal(user.address),
                    types.ascii(username)
                ],
                user.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify the identity was set correctly
        const identity = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-user-identity',
            [types.principal(user.address)],
            user.address
        );

        const identityResult = identity.result.expectTuple();
        assertEquals(identityResult['username'], types.ascii(username));
        assertEquals(identityResult['verified'], types.bool(true));
    },
});

Clarinet.test({
    name: "Ensure setting user identity fails with invalid username length",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const user = accounts.get('wallet_1')!;

        // Test with username that's too short
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'set-user-identity',
                [
                    types.principal(user.address),
                    types.ascii("ab") // Less than 3 characters
                ],
                user.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u9)'); // ERR_INVALID_USERNAME_LENGTH

        // Test with username that's too long
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'set-user-identity',
                [
                    types.principal(user.address),
                    types.ascii("abcdefghijklmnopqrstuvwxyz") // More than 20 characters
                ],
                user.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u9)'); // ERR_INVALID_USERNAME_LENGTH
    },
});

Clarinet.test({
    name: "Ensure setting user identity fails when username is already taken",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const user1 = accounts.get('wallet_1')!;
        const user2 = accounts.get('wallet_2')!;
        const username = "nakamoto";

        // First user sets username
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'set-user-identity',
                [
                    types.principal(user1.address),
                    types.ascii(username)
                ],
                user1.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Second user tries to use same username
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'set-user-identity',
                [
                    types.principal(user2.address),
                    types.ascii(username)
                ],
                user2.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u10)'); // ERR_USERNAME_TAKEN
    },
});

Clarinet.test({
    name: "Ensure update-user-reward-points works only for contract owner",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;
        const nonOwner = accounts.get('wallet_2')!;
        const rewardRate = 20;

        // First initialize user stats by sending a tip
        const recipient = accounts.get('wallet_3')!;
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'tip',
                [
                    types.principal(recipient.address),
                    types.uint(5000000), // 5 STX
                    types.ascii("STX")
                ],
                user.address
            )
        ]);

        // Contract owner adds reward points
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'update-user-reward-points',
                [
                    types.principal(user.address),
                    types.uint(rewardRate)
                ],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Non-owner tries to add reward points
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'update-user-reward-points',
                [
                    types.principal(user.address),
                    types.uint(rewardRate)
                ],
                nonOwner.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u6)'); // ERR_UNAUTHORIZED

        // Verify the reward points were updated correctly
        const userStats = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-user-tip-stats',
            [types.principal(user.address)],
            user.address
        );

        const statsResult = userStats.result.expectTuple();
        // Initial reward points (if tip > threshold) + added reward points
        const expectedPoints = tipAmount >= 1000000 ? 10 + rewardRate : rewardRate;
        assertEquals(statsResult['reward-points'], types.uint(expectedPoints));
    },
});

Clarinet.test({
    name: "Ensure update-user-reward-points fails with invalid reward rate",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const deployer = accounts.get('deployer')!;
        const user = accounts.get('wallet_1')!;
        const invalidRewardRate = 150; // MAX_REWARD_RATE is 100

        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'update-user-reward-points',
                [
                    types.principal(user.address),
                    types.uint(invalidRewardRate)
                ],
                deployer.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(err u7)'); // ERR_INVALID_REWARD_RATE
    },
});

Clarinet.test({
    name: "Ensure multiple tips accumulate stats correctly",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const sender = accounts.get('wallet_1')!;
        const recipient = accounts.get('wallet_2')!;
        const tipAmount1 = 2000000; // 2 STX
        const tipAmount2 = 3000000; // 3 STX

        // Send first tip
        let block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'tip',
                [
                    types.principal(recipient.address),
                    types.uint(tipAmount1),
                    types.ascii("STX")
                ],
                sender.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Send second tip
        block = chain.mineBlock([
            Tx.contractCall(
                CONTRACT_NAME,
                'tip',
                [
                    types.principal(recipient.address),
                    types.uint(tipAmount2),
                    types.ascii("STX")
                ],
                sender.address
            )
        ]);

        assertEquals(block.receipts.length, 1);
        assertEquals(block.receipts[0].result, '(ok true)');

        // Verify accumulated sent stats
        const senderStats = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-user-tip-stats',
            [types.principal(sender.address)],
            sender.address
        );

        const senderStatsResult = senderStats.result.expectTuple();
        assertEquals(senderStatsResult['total-tips-sent'], types.uint(tipAmount1 + tipAmount2));

        // Verify accumulated received stats
        const recipientStats = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-user-tip-stats',
            [types.principal(recipient.address)],
            recipient.address
        );

        const recipientStatsResult = recipientStats.result.expectTuple();
        const platformFee1 = calculatePlatformFee(tipAmount1);
        const platformFee2 = calculatePlatformFee(tipAmount2);
        const expectedReceived = (tipAmount1 - platformFee1) + (tipAmount2 - platformFee2);
        assertEquals(recipientStatsResult['total-tips-received'], types.uint(expectedReceived));

        // Verify total tips received read-only function
        const totalReceived = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-total-tips-received',
            [types.principal(recipient.address)],
            recipient.address
        );
        assertEquals(totalReceived.result, types.uint(expectedReceived));

        // Verify total tips sent read-only function
        const totalSent = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-total-tips-sent',
            [types.principal(sender.address)],
            sender.address
        );
        assertEquals(totalSent.result, types.uint(tipAmount1 + tipAmount2));
    },
});

Clarinet.test({
    name: "Verify get-tips-received calculates correctly",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const recipient = accounts.get('wallet_2')!;
        const tipAmount = 5000000; // 5 STX

        const tipsReceived = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-tips-recieved', // Note: function name has a typo in the contract
            [types.principal(recipient.address), types.uint(tipAmount)],
            recipient.address
        );

        const platformFee = calculatePlatformFee(tipAmount);
        const expectedReceived = tipAmount - platformFee;
        assertEquals(tipsReceived.result, types.uint(expectedReceived));
    },
});

Clarinet.test({
    name: "Ensure read-only functions return default values for new users",
    async fn(chain: Chain, accounts: Map<string, Account>)
    {
        const newUser = accounts.get('wallet_5')!; // User with no activity

        // Get user stats
        const userStats = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-user-tip-stats',
            [types.principal(newUser.address)],
            newUser.address
        );

        const statsResult = userStats.result.expectTuple();
        assertEquals(statsResult['total-tips-sent'], types.uint(0));
        assertEquals(statsResult['total-tips-received'], types.uint(0));
        assertEquals(statsResult['reward-points'], types.uint(0));

        // Get user identity
        const identity = chain.callReadOnlyFn(
            CONTRACT_NAME,
            'get-user-identity',
            [types.principal(newUser.address)],
            newUser.address
        );

        const identityResult = identity.result.expectTuple();
        assertEquals(identityResult['username'], types.ascii(""));
        assertEquals(identityResult['verified'], types.bool(false));
    },
});

// Helper variable for multiple tests
const tipAmount = 5000000; // 5 STX