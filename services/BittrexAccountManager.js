const CONFIG = require("./configs/BITTREX_DROP_CATCHER.json");
const BittrexExchangeService = require("./BittrexExchangeService");
const bittrexExchangeService = new BittrexExchangeService(); 

export default class BittrexAccountManager {
    
    constructor() {
        this.lastBalances = {};
        this.balances = {};
        this.orderBook = {};
        
        this.WALLET_WATCH_INTERVAL = 2000;
        this.WALLET_LOG_INTERVAL = 2000;
        
        this.sessionTime = new Date();
        this.sessionId =  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        this.watcherIntervalId = null;
    }

    async init() {
        await syncWallet();
        //init orderBook
        this.balances.forEach((balance) => {
            orderBook[balance.coin] = {buys: [], sells: []};
        });
    }

    async syncWallet() {
        //SYNC WALLET
        let results = await Promise.all([bittrex.getcoins(), bittrexService.getbalances()]);
        let coins = results[0];
        let newBalances = results[1];

        coins.forEach((coin) => {
            //store last balance
            this.lastBalances[coin] = this.balances[coin];
            this.balances[coin] = 0;
        });
        newBalances.forEach((newBalance) => {
            this.balances[newBalance.coin] = newBalance.quantity;
        });
    }

    checkIfWalletWasSync() {
        this.balances.forEach((newBalance) => {
            if (newBalance.quantity && !this.lastBalances[newBalance.coin]) throw new Error(`Coin Desync: Didn't find ${newBalance.coin}`);
            if (this.lastBalances[newBalance.coin] != newBalance.quantity) throw new Error(`Balance Desync: ${newBalance.coin} - Here: ${this.balances[newBalance.coin]}, Real: ${newBalance.quantity}`);
        });
    }

    startWalletWatcher() {
        if (this.watcherIntervalId) return;
        this.watcherIntervalId = setInterval(async () => {
            //sync first
            await syncWallet();
            checkIfWalletWasSync();
            //stop trading if desync ?
        }, this.WALLET_WATCH_INTERVAL);
    }

    startWalletLogger() {
        if (this.watcherIntervalId) return;
        this.watcherIntervalId = setInterval(async () => {
            //sync first
            await syncWallet();
            checkIfWalletWasSync();
            //stop trading if desync ?
        });
    }

    add(coin, quantity) {
        if (quantity <= 0)
            throw new Error(`Cannot add  ${quantity} ${coin}  (Balance: ${this.balance})`)
        if (quantity > this.balances[coin])
            throw new Error(`Cannot remove more ${quantity} ${coin} more than balance (${this.balance})`)
        this.balances[coin] += quantity;
    }

    remove(coin, quantity) {
        if (quantity <= 0)
            throw new Error(`Cannot remove ${quantity} ${coin}  (Balance: ${this.balance})`)
        if (quantity > this.balances[coin])
            throw new Error(`Cannot decrease more BTC (${quantity}) more than Balance (${this.balance})`)
        this.balances[coin] -= quantity;
    }

    async saveState
}