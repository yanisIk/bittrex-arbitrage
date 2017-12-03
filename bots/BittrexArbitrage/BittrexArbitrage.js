//Catch sell price drops  and resell in same currency
//Detect price drop by comparing BID with top of sell order book then sell at a little more than ASK
// bid > sell by x% ? buy then sell at ASK + y%

//UTIL: process.stdout.write("Downloading " + data.length + " bytes\r"); TO OVERWRITE ON SAME LINE

const CONFIG = require("./../../configs/BITTREX_ARBITRAGE.json")
const _ = require('lodash');
const async = require("async");

const BittrexAccountManager = require('./../../services/BittrexAccountManager');
const BittrexExchangeService = require('./../../services/BittrexExchangeService');

class BittrexArbitrage {
    constructor(pairs, workerId) {

        this.workerId = workerId;

        this.bittrexAccountManager = new BittrexAccountManager();
        this.bittrexExchangeService = new BittrexExchangeService();

        this.pairs = pairs; //array of pair names
        this.ticks = {}; ////key: marketName, value: tick
        this.openBids = {} //key: orderId, value: order
        this.openAsks = {} //key: orderId, value: order

        this.ticksEventEmitter = null;
    }

    async init() {
        //subscribe to ticks
        this.ticksEventEmitter = this.bittrexExchangeService.subscribeToTicks();
        this.ticksEventEmitter.on("TICK", tick => {
            this.ticks[tick.MarketName] = tick;
        });
        //init bittrex account
        //await this.bittrexAccountManager.init();
        
        
        this.buyQueue = async.queue(async (opportunity, cb) => {
            try {
                const buyOrder = await this.bittrexExchangeService.buyMarket(opportunity.pairToBuy, opportunity.qtyToBuyInCOIN);
                if ( !(buyOrder.QuantityBought > 0) ) return cb();

                //Update opportunity
                opportunity.buyOrder = buyOrder;
                opportunity.lastStep = "BUY";
                
                this.sellQueue.push(opportunity);
                cb();
            } catch (e) {
                console.error(`!!! Error in BuyQueue !!! \n \n ${e}`);
                cb(e);
            }
        }, CONFIG.BUY_CONCURENCY);

        this.sellQueue = async.queue(async (opportunity, cb) => {
            try {
                const sellOrder = await this.bittrexExchangeService.sellMarket(opportunity.pairToSell, opportunity.qtyToBuyInCOIN);
                if ( !(sellOrder.QuantitySold > 0) ) return cb();

                //Update opportunity
                opportunity.sellOrder = sellOrder;
                opportunity.lastStep = "SELL";

                this.convertQueue.push(opportunity);
                cb();
            } catch (e) {
                console.error(`!!! Error in SellQueue !!! \n \n ${e}`);
                cb(e)
            }
        }, CONFIG.SELL_CONCURENCY);

        this.convertQueue = async.queue(async (opportunity, cb) => {
            try {
                const sellOrder = await this.bittrexExchangeService.sellMarket(opportunity.pair);
                if ( !(sellOrder.QuantitySold > 0) ) return cb();

                //Update opportunity
                opportunity.sellOrder = sellOrder;
                opportunity.lastStep = "SELL";

                this.logQueue.push(opportunity);
                cb();
            } catch (e) {
                console.error(`!!! Error in ConvertQueue !!! \n \n ${e}`);
                cb(e)
            }
        }, CONFIG.SELL_CONCURENCY);

        this.logQueue = async.queue(async (opportunity, cb) => {
            if (CONFIG.IS_LOG_ACTIVE) console.log(` ----------- ARBITRAGE OPPORTUNITY EXECUTED ${opportunity.id} ------------- \n`, JSON.stringify(opportunity));
            cb();
        }, CONFIG.LOG_CONCURENCY);
    }

    /**
     * 
     * @param {*} coin
     * @returns Opportunity or null 
     */
    detectArbitrageOpportunity(coin) {
        if ( !(this.ticks["BTC-"+coin] && this.ticks["ETH-"+coin] && this.ticks["BTC-ETH"]) ) return;

        const BTC_X_BID = this.ticks["BTC-"+coin].Bid;
        const BTC_X_ASK = this.ticks["BTC-"+coin].Ask;

        const ETH_X_BID = this.ticks["ETH-"+coin].Bid;
        const ETH_X_ASK = this.ticks["ETH-"+coin].Ask;

        const BTC_ETH_BID = this.ticks["BTC-ETH"].Bid;
        const BTC_ETH_ASK = this.ticks["BTC-ETH"].Ask;

        //Check if buy with bitcoin (if can buy in btc, sell in eth and convert eth in btc with profit)
        // if [ETH-X]bid * [BTC-ETH]bid  > [BTC-X]ask 
        if ((ETH_X_BID * BTC_ETH_BID) > BTC_X_ASK) {
            // ( ( [ETH-X]bid * [BTC-ETH]bid ) - [BTC-X]ask ) / [BTC-X]ask
            // X sold for 2 ETH, 2 ETH sold for 600 BTC vs X sold for 500 BTC 
            const grossPercentageWin = ( ( ( ETH_X_BID * BTC_ETH_BID ) - BTC_X_ASK )  / BTC_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE; 
            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["BTC-"+coin];
            const qtyToBuyInBTC = qtyToBuyInCOIN * BTC_X_ASK;

            const grossBTCWin = qtyToBuyInBTC * (grossPercentageWin/100);
            const netBTCWin = qtyToBuyInBTC * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "BTC",
                coin: coin,
                pairToBuy: `BTC-${coin}`,
                pairToSell: `ETH-${coin}`,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInBTC,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossBTCWin,
                netBasecoinWin: netBTCWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n ---------- ARBITRAGE OPPORTUNITY BTC-${opportunity.coin} +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`)
            // if (IS_LOG_ACTIVE) console.log(`BTC-${coin}  ASK: ${BTC_X_ASK.Quantity} ${coin} @ ${BTC_X_ASK.toFixed(8)} BTC/${coin}   (Max Qty: ${maxQuantityToBuyInBtc.toFixed(5)} BTC) (Type: ${BTC_X_ASK.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`ETH-${coin}  BID: ${ETH_X_BID.Quantity} ${coin} @ ${ETH_X_BID.toFixed(8)} ETH/${coin}   (Max Qty: ${maxQuantityToSellInEth.toFixed(5)} ETH) (Type: ${ETH_X_BID.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`BTC-ETH  ASK: ${BTC_ETH_ASK.Quantity} BTC @ ${BTC_ETH_ASK.toFixed(8)} BTC/ETH     (Max Qty: ${maxEthToSell.toFixed(5)} ETH) (Type: ${BTC_ETH_ASK.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`Potential Max Benefit:              ${maxPotentialWinInBtc.toFixed(5)} BTC`);
            // if (IS_LOG_ACTIVE) console.log(`Potential Benefit With ${MAX_BTC_TO_BUY} BTC:   ${maxPotentialWinWithMAX_BTC_TO_BUY.toFixed(5)} BTC`);
            // if (IS_LOG_ACTIVE) console.log("\n");

            return opportunity;
        }

        //Check if buy with eth
        if ((BTC_X_BID * BTC_ETH_BID) > ETH_X_ASK) {
            const grossPercentageWin = ( ( ( BTC_X_BID * BTC_ETH_BID ) - ETH_X_ASK )  / ETH_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE;
            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["ETH-"+coin];
            const qtyToBuyInETH = qtyToBuyInCOIN * ETH_X_ASK;

            const grossETHWin = qtyToBuyInETH * (grossPercentageWin/100);
            const netETHWin = qtyToBuyInETH * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "ETH",
                coin: coin,
                pairToBuy: `ETH-${coin}`,
                pairToSell: `BTC-${coin}`,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInETH,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossETHWin,
                netBasecoinWin: netBasecoinWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n ---------- ARBITRAGE OPPORTUNITY ETH-${opportunity.coin} +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`)
            
            return opportunity;
        }

        return null;
    }

    

    startMonitoring() {
        console.log("Starting Monitoring...")
        const PAIRS_TO_IGNORE = {"BTC-ETH": true}
        
        this.ticksEventEmitter.on("TICK", async tick => {
            //ignore BTC-ETH
            if (PAIRS_TO_IGNORE[tick.MarketName]) return;
            let coins = tick.MarketName.split("-");
            let baseCoin = coins[0];
            let coin = coins[1];

            let opportunity = this.detectArbitrageOpportunity(coin);
            if (!opportunity) return;

            //The queue will handle the next tasks by itself
            //buykQueue.push(opportunity, (err, result) => {

        });

        
    }

    

}


const cluster = require('cluster');
const numWorkers = 1; // require('os').cpus().length;

//USE MULTIPLE CORES
if(cluster.isMaster) {
    
    console.log('Master cluster setting up ' + numWorkers + ' worker(s)...');
    const ALL_BITTREX_PAIRS_CHUNKS = _.chunk(CONFIG.ALL_BITTREX_PAIRS, numWorkers);
    if (numWorkers === 1) ALL_BITTREX_PAIRS_CHUNKS[0] = CONFIG.ALL_BITTREX_PAIRS;

    for(var i = 0; i < numWorkers; i++) {
        let worker = cluster.fork();
        worker.send({workerId: i, pairs: ALL_BITTREX_PAIRS_CHUNKS[i]})
    }
} else {
    process.on('message', async (data) => {
        console.log(`WORKER ${data.workerId} RECEIVED ${data.pairs.length} PAIRS ${data.pairs[0]} ...`);
        const bittrexArbitrageBot = new BittrexArbitrage(data.pairs, data.workerId);
        await bittrexArbitrageBot.init();
        bittrexArbitrageBot.startMonitoring();
    });
}