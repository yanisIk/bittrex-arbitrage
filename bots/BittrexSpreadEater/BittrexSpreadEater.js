//Catch sell price drops  and resell in same currency
//Detect price drop by comparing BID with top of sell order book then sell at a little more than ASK
// bid > sell by x% ? buy then sell at ASK + y%

//UTIL: process.stdout.write("Downloading " + data.length + " bytes\r"); TO OVERWRITE ON SAME LINE

const CONFIG = require("./../../configs/BITTREX_SPREAD_EATER.json");
const _ = require('lodash');
const async = require("async");

const BittrexAccountManager = require('./../../services/BittrexAccountManager');
const BittrexExchangeService = require('./../../services/BittrexExchangeService');
const BittrexSpreadOpportunityDetector = require('./../../services/BittrexSpreadOpportunityDetector');

const LoggerService = require('./../../services/LoggerService')

class BittrexSpreadEater {
    constructor(pairs, workerId) {

        this.workerId = workerId;
        this.pairs = pairs; //array of COINS to work with

        this.bittrexAccountManager = new BittrexAccountManager();
        this.bittrexExchangeService = new BittrexExchangeService();
        this.loggerService = new LoggerService();

        //this.ticksEventEmitter = this.bittrexExchangeService.subscribeToTicks();
        // this.bittrexExchangeService.subscribeToOrders(pairs);
        // this.buyOrdersEventEmitter = this.bittrexExchangeService.getBuyOrdersEmitter();
        // this.sellOrdersEventEmitter = this.bittrexExchangeService.getSellOrdersEmitter();

        this.spreadOpportunityDetector = new BittrexSpreadOpportunityDetector();

        this.buyQueue = null;
        this.sellQueue = null;

        this.isMonitoring = false;

    }

    init() {
        
        //init bittrex account
        //await this.bittrexAccountManager.init();
        
        this.buyQueue = async.queue(async (opportunity, cb) => {
            try {
                const buyOrder = await this.bittrexExchangeService.buyLimitImmediateOrCancel(opportunity.pairToBuy, opportunity.rateToBuy, opportunity.qtyToBuy);
                if ( !(buyOrder.QuantityBought > 0) ) return cb();

                //Update opportunity
                opportunity.buyOrder = buyOrder;
                opportunity.lastStep = "BUY";
                
                this.sellQueue.push(opportunity);
                cb();
            } catch (e) {
                console.error(`!!! Error in BuyQueue !!! \n \n ${JSON.stringify(e)}`);
                cb(e);
            }
        }, CONFIG.BUY_CONCURENCY);

        this.sellQueue = async.queue(async (opportunity, cb) => {
            try {
                //TODO CHECK SELL CONDITION
                const sellOrder = await this.bittrexExchangeService.sellLimitConditional(opportunity.pairToSell, opportunity.rateToSell, opportunity.qtyToSell);
                if ( !(sellOrder.QuantitySold > 0) ) return cb();

                //Update opportunity
                opportunity.sellOrder = sellOrder;
                opportunity.lastStep = "SELL";

                this.convertQueue.push(opportunity);
                cb();
            } catch (e) {
                console.error(`!!! Error in SellQueue !!! \n \n ${JSON.stringify(e)}`);
                cb(e)
            }
        }, CONFIG.SELL_CONCURENCY);

    }

    startMonitoring() {
        
        if (this.isMonitoring) return;
        const ProgressBar = require('progress');
        let consoleLogger = null;
        let sumNetPercentageProfit = 0;
        let opportunitiesCount = 0;
        if (!CONFIG.IS_LOG_ACTIVE) consoleLogger = new ProgressBar(`WORKER#${WORKER_ID} : [:avgNetProfitPercentage] :rate opportunities/s (Total: :current since :elapsed s)`, { total: 999999999999 });

        const monitorPairs = () => {
            async.eachLimit(this.pairs, 16, async (pair, cb) => {
                const opportunity = await this.spreadOpportunityDetector.detectSpreadOpportunity(pair);
                if (!CONFIG.IS_LOG_ACTIVE && opportunity) consoleLogger.tick({avgNetProfitPercentage: (sumNetPercentageProfit+=opportunity.netProfitPercentage) / (opportunitiesCount++)})
                //if (opportunity) this.buyQueue.push(opportunity);
                //cb();
            }, (err) => {
                if (!err) return monitorPairs(); //reloop
                console.error(`ERROR IN monitorPairs()`, JSON.stringify(err));
            });
        }

        

        this.isMonitoring = true;

        monitorPairs();

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

        const ALL_BITTREX_PAIRS_CHUNKED = _.chunk(ALL_BITTREX_PAIRS, ALL_BITTREX_PAIRS.length / numWorkers);
        
        for(var i = 0; i < numWorkers; i++) {
            let worker = cluster.fork();
            worker.send({workerId: i, pairs: ALL_BITTREX_PAIRS_CHUNKED[i]})
        }
    }

    prepareWorkers();
    
} else {
    process.on('message', async (data) => {
        global.WORKER_ID = data.workerId;
        global.CONFIG = CONFIG;
        console.log(`WORKER#${data.workerId} RECEIVED ${data.pairs.length} PAIRS`)
        const bittrexSpreadEaterBot = new BittrexSpreadEater(data.pairs, data.workerId);
        bittrexSpreadEaterBot.init();
        bittrexSpreadEaterBot.startMonitoring();
    });
}