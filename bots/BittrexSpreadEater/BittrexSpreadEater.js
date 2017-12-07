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

const LoggerService = require('./../../services/LoggerService');

const EventEmitter = require('events');

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

        this.detectionQueue;
        this.buyQueue;
        this.sellQueue;

        this.isMonitoring;

    }

    init() {
        
        //init bittrex account
        //await this.bittrexAccountManager.init();

        /**
         * TODO: use Quotes and Orders instead of opportunities
         * Quotes and Orders will have opportunityId inside them
         * //New Speed Strategy: Do all steps of one opportunity one after another using process.nextTick
         *  It will maximize opportunity excecution speed, but preferable to do one by one so each one will have max speed
         */

        this.detectionQueue = async.queue(async (pair, cb) => {
            const opportunity = await this.spreadOpportunityDetector.detectSpreadOpportunity(pair);
            if (opportunity) {
                this.buyQueue.push(opportunity);
            }
            
            cb();
        }, CONFIG.DETECTION_CONCURENCY)

        this.buyQueue = async.queue(async (opportunity, cb) => {
            try {
                //Send multiple bids
                const buyOrdersEmitter = this.spamBid(opportunity.pair, opportunity.bid, opportunity.qtyToBuy, CONFIG.NUMBER_OF_BIDS);

                buyOrdersEmitter.on("ORDER", async (buyOrder) => {
                    
                    //if didnt buy
                    if ( !( (buyOrder.Quantity - buyOrder.QuantityRemaining) > 0) ) {
                        //cancel and check if filled while canceling
                        const canceledBuyOrder = await buyOrder.CancelInitiated ? Promise.resolve({}) : this.bittrexExchangeService.cancelOrder(buyOrder.OrderUuid);
                        
                        //Check if not filled filled
                        if ( !( (canceledBuyOrder.Quantity - canceledBuyOrder.QuantityRemaining) > 0) ) {
                            return cb();
                        } 

                        //Update opportunity
                        opportunity.buyOrders = opportunity.buyOrders ? opportunity.buyOrders : [];
                        opportunity.buyOrders.push(canceledBuyOrder);
                        
                        this.sellQueue.push(opportunity.id, (err) => {
                            if (!err) return;
                            this.buyQueue.pause();
                            console.error(`------- (WORKER#${WORKER_ID}) ERROR IN BUY QUEUE, PAUSING BUY QUEUE AND SHUTTING DOWN PROCESS --------`)
                            console.error(err);
                            process.exit();
                            //TODO, implement graceful shutdown (complete all orders in queue and stop)
                        });

                        this.loggerService.createOrUpdateOpportunity(opportunity);

                        return cb();
                    }

                    //If did buy

                    //Update opportunity
                    opportunity.buyOrders = opportunity.buyOrders ? opportunity.buyOrders : [];
                    opportunity.buyOrders.push(buyOrder);

                    this.loggerService.createOrUpdateOpportunity(opportunity);

                    this.sellQueue.push(opportunity, (err) => {
                        if (!err) return;
                        this.buyQueue.pause();
                        console.error(`------- (WORKER#${WORKER_ID}) ERROR IN BUY QUEUE, PAUSING BUY QUEUE AND SHUTTING DOWN PROCESS --------`)
                        console.error(err);
                        process.exit();
                        //TODO, implement graceful shutdown (complete all orders in queue and stop)
                    });

                    this.loggerService.createOrUpdateOpportunity(opportunity);
                    
                    cb();
                });

            } catch (e) {
                console.error(`!!! (WORKER#${WORKER_ID}) Error in BuyQueue !!! \n \n ${JSON.stringify(e)}`);
                cb(e);
            }
        }, CONFIG.BUY_CONCURENCY);


        this.sellQueue = async.queue(async (opportunity, cb) => {
            try {
                const quantityToSell = opportunity.buyOrders[opportunity.buyOrders.length];
                //Send multiple bids
                const sellOrdersEmitter = this.spamAsk(opportunity.pair, opportunity.ask, quantityToSell, CONFIG.NUMBER_OF_ASKS);

                sellOrdersEmitter.on("ORDER", async (sellOrder) => {
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
                })

                
            } catch (e) {
                console.error(`!!! (WORKER#${WORKER_ID}) Error in SellQueue !!! \n \n ${JSON.stringify(e)}`);
                cb(e)
            }
        }, CONFIG.SELL_CONCURENCY);

    }

    startMonitoring() {
        
        if (this.isMonitoring) return;

        const monitorPairs = () => {
            async.eachLimit(this.pairs, 8, (pair, cb) => {
                
                this.detectionQueue.push(pair, (err) => {
                    if (!err) cb();
                });
                
            }, (err) => {
                if (!err) return monitorPairs(); //reloop
                console.error(`(WORKER#${WORKER_ID}) ERROR IN monitorPairs()`, err);
            });
        }

        this.isMonitoring = true;

        monitorPairs();

    }

    /**
     * Bids between -0.5% | bid | +0.5% 
     * Quantity is split between the number of orders unless it's already min trade size
     * Autocancel
     * @param {*} pair 
     * @param {*} bid is real bid of the pair, not the one to buy at 
     * @param {*} qty 
     * @param {*} numberOfOrders defaults to 6
     * @param {*} autoCancel defaults to 6
     */
    spamBid(pair, bid, qty, spread, numberOfOrders = 6, autoCancel = true) {
        const splittedQuantity = CONFIG.MIN_QTY_TO_TRADE[pair];
        if (qty/numberOfOrders >= CONFIG.MIN_QTY_TO_TRADE[pair]) splittedQuantity = qty/numberOfOrders;

        const startBid = bid - (spread/2);
        const endBid = bid + (spread/2);
        const bidRange = endBid - startBid; // = spread  
        const bidStep = bidRange / numberOfOrders;

        let delaysInMs = [];
        let bids = [];
        for(let i=0; i<numberOfOrders; i++) {
            //Create delays
            if (i === 0) {
                delaysInMs[i] = _.random(2, 10);
            } else {
                delaysInMs[i] = delaysInMs[i-1] + _.random(2, 10)
            }

            //Create bids
            if (i === 0) {
                bids[i] = startBid; 
            } else {
                bids[i] = bid[i-1] + bidStep;
            }
        }

        const ordersEventEmitter = new EventEmitter();

        console.log(`SPAM BID: ${numberOfOrders} Orders \nBids: ${bids} \nDelays: ${delaysInMs}`)
        
        return ordersEventEmitter;

        for(let i=0; i<numberOfOrders; i++) {
            setTimeout(() => this.bittrexExchangeService.buyLimitGoodUntilCanceled(pair, bids[i], splittedQuantity).then(order => ordersEventEmitter.emit("ORDER", order)), delaysInMs[i])
        }
    
        return ordersEventEmitter;
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