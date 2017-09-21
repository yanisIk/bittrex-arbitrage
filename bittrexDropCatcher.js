//Catch sell price drops  and resell in same currency
//Detect price drop by comparing BID with top of sell order book then sell at a little more than ASK
// bid > sell by x% ? buy then sell at ASK + y%

//UTIL: process.stdout.write("Downloading " + data.length + " bytes\r"); TO OVERWRITE ON SAME LINE



const _ = require('lodash');
const cluster = require('cluster');
const numWorkers = require('os').cpus().length;

const async = require("async");
const bittrex = require('node-bittrex-api');
bittrex.options({
  'apikey' : process.env.API_KEY || "f3d8e9751b9f44f68110efb56cb224e5",
  'apisecret' : process.env.API_SECRET || "3bac270937014734bc2ba78442a01c5e",
});
const EventEmitter = require('events');

const ALL_BITTREX_PAIRS = ["BTC-LTC","BTC-DOGE","BTC-VTC","BTC-PPC","BTC-FTC","BTC-RDD","BTC-NXT","BTC-DASH","BTC-POT","BTC-BLK","BTC-EMC2","BTC-XMY","BTC-AUR","BTC-EFL","BTC-GLD","BTC-SLR","BTC-PTC","BTC-GRS","BTC-NLG","BTC-RBY","BTC-XWC","BTC-MONA","BTC-THC","BTC-ENRG","BTC-ERC","BTC-VRC","BTC-CURE","BTC-XMR","BTC-CLOAK","BTC-START","BTC-KORE","BTC-XDN","BTC-TRUST","BTC-NAV","BTC-XST","BTC-BTCD","BTC-VIA","BTC-UNO","BTC-PINK","BTC-IOC","BTC-CANN","BTC-SYS","BTC-NEOS","BTC-DGB","BTC-BURST","BTC-EXCL","BTC-SWIFT","BTC-DOPE","BTC-BLOCK","BTC-ABY","BTC-BYC","BTC-XMG","BTC-BLITZ","BTC-BAY","BTC-BTS","BTC-FAIR","BTC-SPR","BTC-VTR","BTC-XRP","BTC-GAME","BTC-COVAL","BTC-NXS","BTC-XCP","BTC-BITB","BTC-GEO","BTC-FLDC","BTC-GRC","BTC-FLO","BTC-NBT","BTC-MUE","BTC-XEM","BTC-CLAM","BTC-DMD","BTC-GAM","BTC-SPHR","BTC-OK","BTC-SNRG","BTC-PKB","BTC-CPC","BTC-AEON","BTC-ETH","BTC-GCR","BTC-TX","BTC-BCY","BTC-EXP","BTC-INFX","BTC-OMNI","BTC-AMP","BTC-AGRS","BTC-XLM","BTC-BTA","USDT-BTC","BTC-CLUB","BTC-VOX","BTC-EMC","BTC-FCT","BTC-MAID","BTC-EGC","BTC-SLS","BTC-RADS","BTC-DCR","BTC-SAFEX","BTC-BSD","BTC-XVG","BTC-PIVX","BTC-XVC","BTC-MEME","BTC-STEEM","BTC-2GIVE","BTC-LSK","BTC-PDC","BTC-BRK","BTC-DGD","ETH-DGD","BTC-WAVES","BTC-RISE","BTC-LBC","BTC-SBD","BTC-BRX","BTC-DRACO","BTC-ETC","ETH-ETC","BTC-STRAT","BTC-UNB","BTC-SYNX","BTC-TRIG","BTC-EBST","BTC-VRM","BTC-SEQ","BTC-XAUR","BTC-SNGLS","BTC-REP","BTC-SHIFT","BTC-ARDR","BTC-XZC","BTC-NEO","BTC-ZEC","BTC-ZCL","BTC-IOP","BTC-DAR","BTC-GOLOS","BTC-UBQ","BTC-KMD","BTC-GBG","BTC-SIB","BTC-ION","BTC-LMC","BTC-QWARK","BTC-CRW","BTC-SWT","BTC-TIME","BTC-MLN","BTC-ARK","BTC-DYN","BTC-TKS","BTC-MUSIC","BTC-DTB","BTC-INCNT","BTC-GBYTE","BTC-GNT","BTC-NXC","BTC-EDG","BTC-LGD","BTC-TRST","ETH-GNT","ETH-REP","USDT-ETH","ETH-WINGS","BTC-WINGS","BTC-RLC","BTC-GNO","BTC-GUP","BTC-LUN","ETH-GUP","ETH-RLC","ETH-LUN","ETH-SNGLS","ETH-GNO","BTC-APX","BTC-TKN","ETH-TKN","BTC-HMQ","ETH-HMQ","BTC-ANT","ETH-TRST","ETH-ANT","BTC-SC","ETH-BAT","BTC-BAT","BTC-ZEN","BTC-1ST","BTC-QRL","ETH-1ST","ETH-QRL","BTC-CRB","ETH-CRB","ETH-LGD","BTC-PTOY","ETH-PTOY","BTC-MYST","ETH-MYST","BTC-CFI","ETH-CFI","BTC-BNT","ETH-BNT","BTC-NMR","ETH-NMR","ETH-TIME","ETH-LTC","ETH-XRP","BTC-SNT","ETH-SNT","BTC-DCT","BTC-XEL","BTC-MCO","ETH-MCO","BTC-ADT","ETH-ADT","BTC-FUN","ETH-FUN","BTC-PAY","ETH-PAY","BTC-MTL","ETH-MTL","BTC-STORJ","ETH-STORJ","BTC-ADX","ETH-ADX","ETH-DASH","ETH-SC","ETH-ZEC","USDT-ZEC","USDT-LTC","USDT-ETC","USDT-XRP","BTC-OMG","ETH-OMG","BTC-CVC","ETH-CVC","BTC-PART","BTC-QTUM","ETH-QTUM","ETH-XMR","ETH-XEM","ETH-XLM","ETH-NEO","USDT-XMR","USDT-DASH","ETH-BCC","USDT-BCC","BTC-BCC","USDT-NEO","ETH-WAVES","ETH-STRAT","ETH-DGB","ETH-FCT","ETH-BTS","USDT-OMG"];
const ALL_BITTREX_PAIRS_CHUNKS = _.chunk(ALL_BITTREX_PAIRS, ALL_BITTREX_PAIRS.length / numWorkers)

const IS_LOG_ACTIVE = true;
const EVENTS = {MARKET_UPDATE: "MARKET_UPDATE"}
const ORDER_EXECUTION_CODES = {
    BUY_CANCELED: "BUY CANCELED",
    BUY_PARTIAL: "BUY PARTIAL",
    BUY_FULL: "BUY FULL",
    SELL_CANCELED: "SELL CANCELED",
    SELL_PARTIAL: "SELL PARTIAL",
    SELL_FULL: "SELL FULL",
}

const MIN_PROFIT_PERCENTAGE = 10;
const MIN_PROFIT_BTC = 0;
const MAX_BTC_TO_BUY = 0.0001;

const BUY_CONCURENCY = 100;
const SELL_CONCURENCY = 100;
const LOG_CONCURENCY = 20;

var marketEventEmitter;
var ticksByPair = {};
var i = 0;
function subscribeToPairs(pairs) {
    if (marketEventEmitter) return marketEventEmitter;

    marketEventEmitter = new EventEmitter();
    bittrex.websockets.subscribe(pairs, function(data, client) {    
        
        if (data.M === 'updateSummaryState') {
            
            data.A.forEach((ticks) => {
                ticks.Deltas.forEach((tick) => {
                    ticksByPair[tick.MarketName] = {
                        Bid: tick.Bid,
                        Ask: tick.Ask,
                        Last: tick.Last,
                        TimeStamp: tick.TimeStamp,
                    }
                })
            });    
            return;
        }
        if (data.M === 'updateExchangeState') {

            data.A.forEach(function(data_for) {
                //If no market data yet, skip
                if (!ticksByPair[data_for.MarketName]) return;

                //Keep only new sell orders Type 0 (Type 1 = cancelled/filled, Type 2 = changed (partial or cancel request))
                data_for.Sells = data_for.Sells.filter(order => order.Type != 1);

                if (!data_for.Sells.length) return;
                
                marketEventEmitter.emit(EVENTS.MARKET_UPDATE, data_for.MarketName, data_for.Sells)
            });
        }
    });
    return marketEventEmitter;
}

/**
 * Buy Immediate Or Cancel
 * @param {*} opportunity 
 */
function executeBuyOrder(opportunity) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(1);
        }, 1000);
    });
}

/**
 * Sell with stop loss
 * @param {*} opportunity 
 */
function executeSellOrder(opportunity) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(1);
        }, 1000);
    });
}


function checkOrder(orderId, ORDER_TIMEOUT) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const possibleResponses = [{isFulfilled: false, isPartiallyFulfilled: false, amountFulfilled: 0, rate: 0.002},
                                       {isFulfilled: false, isPartiallyFulfilled: true, amountFulfilled: 1, rate: 0.0015},
                                       {isFulfilled: true, isPartiallyFulfilled: false, amountFulfilled: 2, rate: 0.001}]

            resolve(possibleResponses[2]);
        }, ORDER_TIMEOUT);
    });
}

function cancelOrder(orderId) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(1);
        }, 1000);
    });
}



/*  
    // bid > sell by x% ? buy then sell at ASK + y%
*/
const MIN_DROP_PERCENTAGE  = 1 ;
function detectPriceDrop(pair, sellOrders) {
    
    const dropPercentage = ( (ticksByPair[pair].Bid - sellOrders[0].Rate) / ticksByPair[pair].Bid) * 100;

    if (sellOrders[0].Rate < ticksByPair[pair].Bid)
        console.log(`${pair} Sell Rate: ${sellOrders[0].Rate} - Bid: ${ticksByPair[pair].Bid} - Drop of ${dropPercentage.toFixed(4)}%`)
    
    if (dropPercentage < MIN_DROP_PERCENTAGE ) return null;

    return {pair: pair, 
            bid: ticksByPair[pair].Bid,
            ask: ticksByPair[pair].Ask,
            last: ticksByPair[pair].Last,
            sellPrice: sellOrders[0].Rate,
            dropPercentage: dropPercentage, 
            coinQuantity: sellOrders[0].Quantity, 
            baseCoinQuantity: sellOrders[0].Quantity * sellOrders[0].Rate,
            potentialProfit: (sellOrders[0].Quantity * ticksByPair[pair].Bid) - (sellOrders[0].Quantity * sellOrders[0].Rate)
    };
    
}

/**
 * 2) executes order then checks for its status
 *    returns updated opportunity
 */
async function buyAndCheck(opportunity) {
    //Execute order
    const buyOrderId = await executeBuyOrder(opportunity);
    //Wait and get order status
    const buyOrderStatus = await checkOrder(buyOrderId, BUY_ORDER_TIMEOUT);
    //if order is not fulfilled and not partially fulfilled, cancel it
    if ( (!buyOrderStatus.isFulfilled) && (!buyOrderStatus.isPartiallyFulfilled) ) {
        await cancelOrder(buyOrderId);
        return {
            order: buyOrderStatus,
            executionStatus: ORDER_EXECUTION_CODES.BUY_CANCELED
        }
    }

    if (buyOrderStatus.isPartiallyFulfilled) {
         return {
            order: buyOrderStatus,
            executionStatus: ORDER_EXECUTION_CODES.BUY_PARTIAL
        }
    }

    return {
        order: buyOrderStatus,
        executionStatus: ORDER_EXECUTION_CODES.BUY_FULL
    }
}

/**
 * 3)
 * @param {*} opportunity 
 */
async function sellAndCheck(opportunity) {
    //Execute order
    const sellOrderId = await executeSellOrder(opportunity);

    //Wait and get order status
    const sellOrderStatus = await checkOrder(sellOrderId, SELL_ORDER_TIMEOUT);

    //if order is not fulfilled and not partially fulfilled, cancel it
    if ( (!sellOrderStatus.isFulfilled) && (!sellOrderStatus.isPartiallyFulfilled) ) {
        await cancelOrder(sellOrderId);
         return {
            order: sellOrderStatus,
            executionStatus: ORDER_EXECUTION_CODES.SELL_CANCELED
        }
    }

    if (sellOrderStatus.isPartiallyFulfilled) {
         return {
            order: sellOrderStatus,
            executionStatus: ORDER_EXECUTION_CODES.SELL_PARTIAL
        }
    }

    return {
        order: sellOrderStatus,
        executionStatus: ORDER_EXECUTION_CODES.SELL_FULL
    }
}

/**
 * 4)
 * @param {*} opportunity 
 */
async function convertAndCheck(opportunity) {
    //Execute order
    const convertOrderId = await executeSellOrder(opportunity);

    //Wait and get order status
    const convertOrderStatus = await checkOrder(convertOrderId, CONVERT_ORDER_TIMEOUT);

    //if order is not fulfilled and not partially fulfilled, cancel it
    if ( (!convertOrderStatus.isFulfilled) && (!convertOrderStatus.isPartiallyFulfilled) ) {
        await cancelOrder(convertOrderId);
         return {
            order: convertOrderStatus,
            executionStatus: ORDER_EXECUTION_CODES.CONVERT_CANCELED
        }
    }

    if (convertOrderStatus.isPartiallyFulfilled) {
         return {
            order: convertOrderStatus,
            executionStatus: ORDER_EXECUTION_CODES.CONVERT_PARTIAL
        }
    }

    return {
        order: convertOrderStatus,
        executionStatus: ORDER_EXECUTION_CODES.CONVERT_FULL
    }
}


const logQueue = async.queue(async (opportunity, cb) => {
    if (IS_LOG_ACTIVE) console.log(` ----------- ARBITRAGE OPPORTUNITY EXECUTED ${opportunity.id} ------------- \n`, opportunity);
    cb();
}, LOG_CONCURENCY)
const sellAndCheckQueue = async.queue(async (opportunity, cb) => {
        try {
            sellOrderStatus = await sellAndCheck(opportunity);
        
            //update opportunity
            opportunity.steps.SELL.trials.push({  amountSoldInCoin:       sellOrderStatus.order.amountFulfilledInCoin,
                                                    amountSoldInBaseCoin:   sellOrderStatus.order.amountFulfilledInBaseCoin,
                                                    amountLeftInCoin:       opportunity.steps.BUY.amountBoughtInCoin - sellOrderStatus.order.amountFulfilledInCoin,
                                                    amountLeftInBaseCoin:   opportunity.steps.BUY.amountBoughtInBaseCoin - sellOrderStatus.order.amountFulfilledInBaseCoin,
                                                    timestamp:              Date.now()
                                                });
            opportunity.steps.SELL.totalCoinSold = (opportunity.steps.SELL.totalCoinSold || 0) + sellOrderStatus.order.amountFulfilledInCoin;
            opportunity.steps.SELL.totalBaseCoinSold = (opportunity.steps.SELL.totalBaseCoinSold || 0) + sellOrderStatus.order.amountFulfilledInBaseCoin;
            opportunity.steps.SELL.totalCoinToSell = opportunity.steps.BUY.amountBoughtInCoin;
            opportunity.steps.SELL.totalBaseCoinToSell = opportunity.steps.BUY.amountBoughtInBaseCoin;
            opportunity.steps.SELL.amountInCoinLeftToSell = opportunity.steps.SELL.totalCoinToSell - opportunity.steps.SELL.totalCoinSold;
            opportunity.steps.SELL.amountInBaseCoinLeftToSell = opportunity.steps.SELL.totalBaseCoinToSell - opportunity.steps.SELL.totalBaseCoinSold;

            switch(sellOrderStatus.executionStatus) {
                case ORDER_EXECUTION_CODES.SELL_FULL:
                    if (IS_LOG_ACTIVE) console.log("\n !!!! FULFILLED SELL order !!!! \n", sellOrderStatus);
                    convertAndCheckQueue.push(opportunity);
                    break;
                case ORDER_EXECUTION_CODES.SELL_PARTIAL:
                    if (IS_LOG_ACTIVE) console.log("\n !!!! PARTIALLY FULFILED SELL Order  !!!! \n", opportunity);
                    //Convert the amount sold
                    convertAndCheckQueue.push(opportunity);
                    //Retry to sell the remaining coins (put it first in the queue)
                    sellAndCheckQueue.unshift(opportunity);
                    break;
                case ORDER_EXECUTION_CODES.SELL_CANCELED:
                    if (IS_LOG_ACTIVE) console.log("\n !!!! CANCELED SELL order !!!! \n", sellOrderStatus);
                    //Retry with the remaining AMOUNT with different parameters
                    sellAndCheckQueue.unshift(opportunity);
                    break;
                default: cb(null, opportunity)
            }
        } catch (e) {
            console.error(e)
            cb(e)
        }
    }, SELL_CONCURENCY);



const buyAndCheckQueue = async.queue(async (opportunity, cb) => {
        try {
            buyOrderStatus = await buyAndCheck(opportunity);

            //Update opportunity
            opportunity.steps.BUY.trials.push({
                                        amountBoughtInCoin:       buyOrderStatus.order.amountFulfilledInCoin,
                                        amountBoughtInBaseCoin:   buyOrderStatus.order.amountFulfilledInBaseCoin,
                                        amountLeftInCoin:         opportunity.maxQtyToArbitrageInCoin - buyOrderStatus.order.amountFulfilledInCoin,
                                        amountLeftInBaseCoin:     opportunity.maxQtyToArbitrageInCoin - buyOrderStatus.order.amountFulfilledInBaseCoin,
                                        timestamp:                Date.now()
            })
            opportunity.steps.BUY.amountBoughtInCoin = buyOrderStatus.order.amountFulfilledInCoin;
            opportunity.steps.BUY.amountBoughtInBaseCoin = buyOrderStatus.order.amountFulfilledInBaseCoin;
            
            switch(buyOrderStatus.executionStatus) {
                case ORDER_EXECUTION_CODES.BUY_FULL:
                    if (IS_LOG_ACTIVE) console.log("\n !!!! FULFILLED BUY order !!!! \n", buyOrderStatus);
                    sellAndCheckQueue.push(opportunity);
                    break;
                case ORDER_EXECUTION_CODES.BUY_PARTIAL:
                    if (IS_LOG_ACTIVE) console.log("\n !!!! PARTIALLY FULFILLED BUY order !!!! \n", buyOrderStatus);
                    sellAndCheckQueue.push(opportunity);
                    //Keep the remaining base coins to use them for another opportunity...
                    break;
                case ORDER_EXECUTION_CODES.BUY_CANCEL:
                    if (IS_LOG_ACTIVE) console.log("\n !!!! CANCELED BUY order !!!! \n", buyOrderStatus);
                    //too bad, do nothing and wait for the next
                    break;
                default: cb(null, opportunity)
            }
        } catch (e) {
            console.error(e);
            cb(e);
        }
    }, BUY_CONCURENCY);


var totalPotentialInvestementInBtc = 0
var totalPotentialProfitInBtc = 0;
var totalPotentialProfitInBtc_MAX_BTC_TO_BUY = 0;
// setInterval(() => {
//     console.log(`\n TOTAL POTENTIAL INVESTEMENT IN BTC: ${totalPotentialInvestementInBtc} \n TOTAL POTENTIAL PROFIT IN BTC: ${totalPotentialProfitInBtc} BTC \n`)
// }, 20000);
async function startMonitoring(pairs, workerId) {
    
    subscribeToPairs(pairs).on(EVENTS.MARKET_UPDATE, async (pair, sellOrders) => {
        //TODO fix duplicates (same opportunity)
        let opportunity = detectPriceDrop(pair, sellOrders);
        if (!opportunity) return;

        totalPotentialInvestementInBtc = totalPotentialInvestementInBtc + opportunity.baseCoinQuantity;
        totalPotentialProfitInBtc = totalPotentialProfitInBtc + opportunity.potentialProfit;
        
        if (IS_LOG_ACTIVE) {
            console.log(`\n ----- PRICE DROP ${pair} (workerId ${workerId})----- \n`);
            console.log(opportunity)
            console.log(`\n TOTAL POTENTIAL INVESTEMENT: ${totalPotentialInvestementInBtc} BTC \n TOTAL POTENTIAL PROFIT: ${totalPotentialProfitInBtc} BTC \n (workerId ${workerId}) \n`)
        }
        
        //TODO use timeout for api call to retry 

        //1) Buy Immediate or Cancel
        //   if timeout: skip it
        //2) Sell Conditional: when (sellPrice >= buyPrice - X%) where X% is the stop loss percentage
        //   if timeout: cancel request and resent to sellQueue
        //3) Send it to checkAfterSellQueue: check after Y seconds
        //   if not fulfilled: wait again (by sending to checkAfterSellQueue) or cancel & resend to sellQueue with lower stop loss ? 
        //   if partially fulfilled:  wait again (by sending to checkAfterSellQueue) or cancel & resend to sellQueue with lower stop loss ? 
        //   if fulfilled: send to log queue.
        //4) Log

        //The queue will handle the next tasks by itself
        //buyAndCheckQueue.push(opportunity, (err, result) => {});
    });
}


//USE MULTIPLE CORES
if(cluster.isMaster) {
    
    console.log('Master cluster setting up ' + numWorkers + ' workers...');

    for(var i = 0; i < numWorkers; i++) {
        let worker = cluster.fork();
        worker.send({workerId: i, pairs: ALL_BITTREX_PAIRS_CHUNKS[i]})
    }
} else {
    process.on('message', function(data) {
        console.log(`WORKER ${data.workerId} RECEIVED ${data.pairs.length} PAIRS ${data.pairs[0]} ...`);
        startMonitoring(data.pairs, data.workerId);
    });
}