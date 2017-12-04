//Catch sell price drops  and resell in same currency
//Detect price drop by comparing BID with top of sell order book then sell at a little more than ASK
// bid > sell by x% ? buy then sell at ASK + y%

//UTIL: process.stdout.write("Downloading " + data.length + " bytes\r"); TO OVERWRITE ON SAME LINE

const CONFIG = require("./../../configs/BITTREX_ARBITRAGE.json");
const _ = require('lodash');
const async = require("async");

const BittrexAccountManager = require('./../../services/BittrexAccountManager');
const BittrexExchangeService = require('./../../services/BittrexExchangeService');
const BittrexArbitrageDetector = require('./../../services/BittrexArbitrageDetector');

const LoggerService = require('./../../services/LoggerService')

class BittrexArbitrage {
    constructor(coinsToTrack, workerId) {

        this.workerId = workerId;
        this.BTC_ETH_COMMON_COINS = coinsToTrack.BTC_ETH_COMMON_COINS; //array of COINS to work with
        this.BTC_USDT_COMMON_COINS = coinsToTrack.BTC_USDT_COMMON_COINS; //array of COINS to work with
        this.ETH_USDT_COMMON_COINS = coinsToTrack.ETH_USDT_COMMON_COINS; //array of COINS to work with

        this.bittrexAccountManager = new BittrexAccountManager();
        this.bittrexExchangeService = new BittrexExchangeService();
        this.loggerService = new LoggerService();

        //this.ticksEventEmitter = this.bittrexExchangeService.subscribeToTicks();
        // this.bittrexExchangeService.subscribeToOrders(pairs);
        // this.buyOrdersEventEmitter = this.bittrexExchangeService.getBuyOrdersEmitter();
        // this.sellOrdersEventEmitter = this.bittrexExchangeService.getSellOrdersEmitter();

        this.arbitrageDetector = new BittrexArbitrageDetector(this.ticksEventEmitter);

        this.buyQueue = null;
        this.sellQueue = null;
        this.convertQueue = null;

        this.isMonitoring = false;

    }

    init() {
        
        //init bittrex account
        //await this.bittrexAccountManager.init();
        
        this.buyQueue = async.queue(async (opportunity, cb) => {
            try {
                const buyOrder = await this.bittrexExchangeService.buyMarket(opportunity.pairToBuy, opportunity.rateToBuyInBasecoin, opportunity.qtyToBuyInCOIN);
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

    }

    startMonitoring() {
        
        if (this.isMonitoring) return;

        const monitor_BTC_ETH_Arbitrage = () => {
            async.eachLimit(this.BTC_ETH_COMMON_COINS, 2, async (coin, cb) => {
                const opportunity = await this.arbitrageDetector.detect_BTC_ETH_Arbitrage(coin);
                if (opportunity) this.buyQueue.push(opportunity);
                //cb();
            }, (err) => {
                if (!err) return monitor_BTC_ETH_Arbitrage(); //reloop
                console.error(`ERROR IN monitor_BTC_ETH_Arbitrage`, err);
            });
        }

        const monitor_ETH_BTC_Arbitrage = () => {
            async.eachLimit(this.BTC_ETH_COMMON_COINS, 2, async (coin, cb) => {
                const opportunity = await this.arbitrageDetector.detect_ETH_BTC_Arbitrage(coin);
                if (opportunity) this.buyQueue.push(opportunity);
                //cb();
            }, (err) => {
                if (!err) return monitor_ETH_BTC_Arbitrage(); //reloop
                console.error(`ERROR IN monitor_ETH_BTC_Arbitrage`, err);
            });
        }

        const monitor_USDT_BTC_Arbitrage = () => {
            async.eachLimit(this.BTC_USDT_COMMON_COINS, 1, async (coin, cb) => {
                const opportunity = await this.arbitrageDetector.detect_USDT_BTC_Arbitrage(coin);
                if (opportunity) this.buyQueue.push(opportunity);
                //cb();
            }, (err) => {
                if (!err) return monitor_USDT_BTC_Arbitrage(); //reloop
                console.error(`ERROR IN monitor_USDT_BTC_Arbitrage`, err);
            });
        }

        const monitor_USDT_ETH_Arbitrage = () => {
            async.eachLimit(this.ETH_USDT_COMMON_COINS, 1, async (coin, cb) => {
                const opportunity = await this.arbitrageDetector.detect_USDT_ETH_Arbitrage(coin);
                if (opportunity) this.buyQueue.push(opportunity);
                //cb();
            }, (err) => {
                if (!err) return monitor_USDT_ETH_Arbitrage(); //reloop
                console.error(`ERROR IN monitor_USDT_ETH_Arbitrage`, err);
            });
        }

        this.isMonitoring = true;

        monitor_BTC_ETH_Arbitrage();
        monitor_ETH_BTC_Arbitrage();
        monitor_USDT_BTC_Arbitrage();
        monitor_USDT_ETH_Arbitrage();

    }

}


const cluster = require('cluster');
const numWorkers = 4; // require('os').cpus().length;

//USE MULTIPLE CORES
if(cluster.isMaster) {
    
    console.log('Master cluster setting up ' + numWorkers + ' worker(s)...');
    
    async function prepareWorkers() {
        const bittrexExchangeService = new BittrexExchangeService();
        const ALL_BITTREX_PAIRS = await bittrexExchangeService.getAllPairs();

        const BTC_PAIRS = ALL_BITTREX_PAIRS.filter(p => p.split("-")[0] === "BTC").map(p => p.split("-")[1]);
        const ETH_PAIRS = ALL_BITTREX_PAIRS.filter(p => p.split("-")[0] === "ETH").map(p => p.split("-")[1]);
        const USDT_PAIRS = ALL_BITTREX_PAIRS.filter(p => p.split("-")[0] === "USDT").map(p => p.split("-")[1]);

        let BTC_ETH_COMMON_PAIRS = [];
        BTC_PAIRS.forEach(coin => {
            if (ETH_PAIRS.includes(coin)) BTC_ETH_COMMON_PAIRS.push(coin);
        }); 

        let BTC_USDT_COMMON_PAIRS = [];
        BTC_PAIRS.forEach(coin => {
            if (USDT_PAIRS.includes(coin)) BTC_USDT_COMMON_PAIRS.push(coin);
        }); 

        let ETH_USDT_COMMON_PAIRS = [];
        ETH_PAIRS.forEach(coin => {
            if (USDT_PAIRS.includes(coin)) ETH_USDT_COMMON_PAIRS.push(coin);
        });

        const BTC_ETH_COMMON_PAIRS_CHUNKED = _.chunk(BTC_ETH_COMMON_PAIRS, BTC_ETH_COMMON_PAIRS.length / numWorkers);
        const BTC_USDT_COMMON_PAIRS_CHUNKED = _.chunk(BTC_USDT_COMMON_PAIRS, BTC_USDT_COMMON_PAIRS.length / numWorkers);
        const ETH_USDT_COMMON_PAIRS_CHUNKED = _.chunk(ETH_USDT_COMMON_PAIRS, ETH_USDT_COMMON_PAIRS.length / numWorkers);
        
        for(var i = 0; i < numWorkers; i++) {
            let worker = cluster.fork();
            worker.send({workerId: i, coins: {
                BTC_ETH_COMMON_COINS: BTC_ETH_COMMON_PAIRS_CHUNKED[i],
                BTC_USDT_COMMON_COINS: BTC_USDT_COMMON_PAIRS_CHUNKED[i],
                ETH_USDT_COMMON_COINS: ETH_USDT_COMMON_PAIRS_CHUNKED[i],
            }})
        }
    }

    prepareWorkers().catch(err => console.error(err));
    
} else {
    process.on('message', async (data) => {
        global.WORKER_ID = data.workerId;
        global.CONFIG = CONFIG;
        console.log(`WORKER#${data.workerId} RECEIVED \n`+
                    `BTC-ETH: ${data.coins.BTC_ETH_COMMON_COINS.length} COINS TO TRACK (${data.coins.BTC_ETH_COMMON_COINS[0]} ...) \n`+
                    `BTC-USDT: ${data.coins.BTC_USDT_COMMON_COINS.length} COINS TO TRACK (${data.coins.BTC_USDT_COMMON_COINS[0]} ...) \n`+
                    `ETH-USDT: ${data.coins.ETH_USDT_COMMON_COINS.length} COINS TO TRACK (${data.coins.ETH_USDT_COMMON_COINS[0]} ...) \n`
        );
        const bittrexArbitrageBot = new BittrexArbitrage(data.coins, data.workerId);
        bittrexArbitrageBot.init();
        bittrexArbitrageBot.startMonitoring();
    });
}