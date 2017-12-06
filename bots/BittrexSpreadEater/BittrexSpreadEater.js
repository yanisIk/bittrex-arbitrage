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
                const buyOrder = await this.bittrexExchangeService.buyLimitGoodUntilCanceled(opportunity.pair, opportunity.buyRate, opportunity.qtyToBuy);

                //Update opportunity
                opportunity.buyOrders = opportunity.buyOrders ? opportunity.buyOrders : [];
                opportunity.buyOrders.push(buyOrder); 

                this.loggerService.createOrUpdateOpportunity(opportunity);

                //if didnt buy
                if ( !(buyOrder.QuantityBought > 0) ) {
                    //cancel and recheck for new opportunity at same time
                    const newOpportunityPromise = this.spreadOpportunityDetector.detectSpreadOpportunity(opportunity.pair);
                    const cancelPromise = buyOrder.CancelInitiated ? Promise.resolve() : this.bittrexExchangeService.cancelOrder(buyOrder.OrderUuid);
                    
                    let newOpportunity, cancelResponse;
                    [opportunity, cancelResponse] = await Promise.all([newOpportunityPromise, cancelPromise]);
                    
                    //If no more opportunity with this pair, dont rebuy
                    if (!newOpportunity) return cb();

                    newOpportunity.buyOrders = opportunity.buyOrders;
                    this.buyQueue.unshift(newOpportunity);
                    
                    return cb();
                }

                //Update opportunity
                opportunity.lastStep = "BUY";
                buyOrder.qtyToSell = buyOrder.QuantityBought;
                

                this.sellQueue.push(opportunity, (err) => {
                    if (!err) return;
                    this.buyQueue.pause();
                    console.error(`------- (WORKER#${WORKER_ID}) ERROR IN SELL QUEUE, PAUSING BUY QUEUE AND SHUTTING DOWN PROCESS --------`)
                    console.error(err);
                    process.exit();
                });

                this.loggerService.createOrUpdateOpportunity(opportunity);
                
                cb();
            } catch (e) {
                console.error(`!!! (WORKER#${WORKER_ID}) Error in BuyQueue !!! \n \n ${JSON.stringify(e)}`);
                cb(e);
            }
        }, CONFIG.BUY_CONCURENCY);

        this.sellQueue = async.queue(async (opportunity, cb) => {
            try {
                const sellOrder = await this.bittrexExchangeService.sellLimitGoodUntilCanceled(opportunity.pair, opportunity.sellRate, opportunity.qtyToSell);

                //Update opportunity
                opportunity.sellOrders = opportunity.sellOrders ? opportunity.sellOrders : [];
                opportunity.sellOrders.push(sellOrder); 

                //If everything is sold
                if (sellOrder.QuantityRemaining < CONFIG.MIN_QTY_TO_TRADE[opportunity.pair]) {
                    opportunity.lastStep = "SELL";
                    this.loggerService.createOrUpdateOpportunity(opportunity);
                    return cb();
                }

                //If sold partially
                opportunity.lastStep = "SELL_PARTIAL";
                this.loggerService.createOrUpdateOpportunity(opportunity);
                //Set new quantity to sell
                opportunity.qtyToSell = sellOrder.QuantityRemaining;
                //Calculate new sellRate (remove 5% of the spread)
                opportunity.sellRate -=  opportunity.spread * 0.05;
                
                //push back to sell queue as first
                this.sellQueue.unshift(opportunity);
                
                cb();
            } catch (e) {
                console.error(`!!! (WORKER#${WORKER_ID}) Error in SellQueue !!! \n \n ${JSON.stringify(e)}`);
                cb(e)
            }
        }, CONFIG.SELL_CONCURENCY);

    }

    startMonitoring() {
        
        if (this.isMonitoring) return;

        const monitorPairs = () => {
            async.eachLimit(this.pairs, 8, async (pair, cb) => {
                const opportunity = await this.spreadOpportunityDetector.detectSpreadOpportunity(pair);
                //if (opportunity) this.buyQueue.push(opportunity);
                
            }, (err) => {
                if (!err) return monitorPairs(); //reloop
                console.error(`(WORKER#${WORKER_ID}) ERROR IN monitorPairs()`, err);
            });
        }

        this.isMonitoring = true;

        monitorPairs();

    }

}


const cluster = require('cluster');
const numWorkers = 1; // require('os').cpus().length;

//USE MULTIPLE CORES
if(cluster.isMaster) {
    
    console.log('Master cluster setting up ' + numWorkers + ' worker(s)...');
    
    async function prepareWorkers() {
        const bittrexExchangeService = new BittrexExchangeService();
        let ALL_BITTREX_PAIRS = await bittrexExchangeService.getMarketSummaries();
        //Sort by volume
        ALL_BITTREX_PAIRS = ALL_BITTREX_PAIRS.sort((a, b) => b.Volume - a.Volume);
        //Keep the X first ones
        ALL_BITTREX_PAIRS = ALL_BITTREX_PAIRS.slice(0, 32).map(p => p.MarketName);

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