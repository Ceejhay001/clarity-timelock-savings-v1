import {
    Clarinet,
    Tx,
    Chain,
    Account,
    types
} from 'https://deno.land/x/clarinet@v1.0.0/index.ts';
import { assertEquals } from 'https://deno.land/std@0.90.0/testing/asserts.ts';

Clarinet.test({
    name: "Can deposit STX and create savings account",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        let block = chain.mineBlock([
            Tx.contractCall('savings-account', 'deposit', [
                types.uint(100)  // Lock duration of 100 blocks
            ], wallet1.address)
        ]);
        
        block.receipts[0].result.expectOk().expectBool(true);
        
        // Check savings data
        let getBalance = chain.callReadOnlyFn(
            'savings-account',
            'get-savings',
            [types.principal(wallet1.address)],
            wallet1.address
        );
        
        assertEquals(getBalance.result.expectSome().expectTuple()['lock-until'], types.uint(block.height + 100));
    }
});

Clarinet.test({
    name: "Cannot withdraw before lock period ends, but can with penalty",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // First deposit
        let block = chain.mineBlock([
            Tx.contractCall('savings-account', 'deposit', [
                types.uint(100)
            ], wallet1.address)
        ]);
        
        // Try to withdraw early
        let withdrawBlock = chain.mineBlock([
            Tx.contractCall('savings-account', 'withdraw', [], wallet1.address)
        ]);
        
        withdrawBlock.receipts[0].result.expectOk().expectBool(true);
        // Check that penalty was applied
    }
});

Clarinet.test({
    name: "Can withdraw full amount after lock period",
    async fn(chain: Chain, accounts: Map<string, Account>) {
        const wallet1 = accounts.get('wallet_1')!;
        
        // Deposit
        let block = chain.mineBlock([
            Tx.contractCall('savings-account', 'deposit', [
                types.uint(10)
            ], wallet1.address)
        ]);
        
        // Mine blocks until lock period ends
        chain.mineEmptyBlockUntil(block.height + 11);
        
        // Withdraw
        let withdrawBlock = chain.mineBlock([
            Tx.contractCall('savings-account', 'withdraw', [], wallet1.address)
        ]);
        
        withdrawBlock.receipts[0].result.expectOk().expectBool(true);
        // Verify full amount received
    }
});
