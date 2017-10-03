//Catch sell price drops  and resell in same currency
//Detect price drop by comparing BID with top of sell order book then sell at a little more than ASK
// bid > sell by x% ? buy then sell at ASK + y%

//UTIL: process.stdout.write("Downloading " + data.length + " bytes\r"); TO OVERWRITE ON SAME LINE

const CONFIG = require("./../configs/BITTREX_ARBITRAGE.json")
const _ = require('lodash');
const cluster = require('cluster');
const numWorkers = 1; // require('os').cpus().length;
const async = require("async");

const BittrexAccountManager = require('./../services/BittrexAccountManager');
const BittrexExchangeService = require('./../services/BittrexExchangeService');

class BittrexArbitrage {
    constructor(pairs) {

        this.bittrexAccountManager = new BittrexAccountManager();
        this.BittrexExchangeService = new BittrexExchangeService();

        this.pairs = pairs; //array of pair names
        this.ticks = {}; ////key: marketName, value: tick
        this.openBids = {} //key: orderId, value: order
        this.openAsks = {} //key: orderId, value: order

        this.ticksEventEmitter = null;
        this.buyAndCheckQueue = null;
    }

    async init() {
        //subscribe to ticks
        this.ticksEventEmitter = this.subscribeToTicks();
        this.ticksEventEmitter.on("TICK", async tick => {
            this.ticks[tick.MarketName] = tick;
        });
        //init bittrex account
        await this.bittrexAccountManager.init();
        
        

        this.buyAndCheckQueue = async.queue(async (opportunity, cb) => {
            try {
                buyOrderStatus = await buyAndCheck(opportunity);

                if (!buyOrderStatus.amountFulfilled) return cb();

                //Update opportunity
                opportunity.steps.BUY.quantity = buyOrderStatus.amountFulfilled;
                sellAndCheckQueue.push(opportunity);
                cb();
                
            } catch (e) {
                console.error(e);
                cb(e);
            }
        }, BUY_CONCURENCY);

        this.sellAndCheckQueue = async.queue(async (opportunity, cb) => {
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


        
    }

    detectArbitrageOpportunity(coin) {
        if (this.ticks["BTC-"+coin] && this.ticks["ETH-"+coin] && this.ticks["BTC-ETH"])

        btcBid = this.ticks["BTC-"+coin].Bid;
        btcAsk = this.ticks["BTC-"+coin].Ask;

        ethBid = this.ticks["ETH-"+coin].Bid;
        ethAsk = this.ticks["ETH-"+coin].Ask;

        btcEthBid = this.ticks["BTC-ETH"].Bid;
        btcEthAsk = this.ticks["BTC-ETH"].Ask;

        //Check if buy with bitcoin (if can buy in btc, sell in eth and convert eth in btc with profit)
        // if [ETH-X]bid * [BTC-ETH]bid  > [BTC-X]ask 
        if ((ethBid * btcEthBid) > btcAsk) {
            // ( ( [ETH-X]bid * [BTC-ETH]bid ) - [BTC-X]ask ) / [BTC-X]ask
            // X sold for 2 ETH, 2 ETH sold for 600 BTC vs X sold for 500 BTC 
            let potentialPercentageWin = ( ( ( ethBid * btcEthBid ) - btcAsk )  / btcAsk ) * 100;
        
            let maxPotentialWinWithMAX_BTC_TO_BUY = MAX_BTC_TO_BUY * (potentialPercentageWin/100);

            if (potentialPercentageWin < MIN_PROFIT_PERCENTAGE) return;
            if (maxPotentialWinInBtc < MIN_PROFIT_BTC) return;

            const opportunity = {id: Date.now(), baseCoin: "BTC", coin: coin, 
                                 potentialPercentageWin: potentialPercentageWin, 
                                 steps: {BUY: {fulfilled: 0}}, SELL: {fulfilled: 0}, CONVERT: {fulfilled: 0}}

            console.log(`\n ---------- ARBITRAGE OPPORTUNITY ${opportunity.coin} +${opportunity.potentialPercentageWin.toFixed(4)}% ------------- ${opportunity.id} \n`)
            console.log(`MAX TO WIN WITH ${MAX_BTC_TO_BUY} BTC: ${maxPotentialWinWithMAX_BTC_TO_BUY}`);
            totalPotentialProfitInBtc_MAX_BTC_TO_BUY = totalPotentialProfitInBtc_MAX_BTC_TO_BUY + maxPotentialWinWithMAX_BTC_TO_BUY;
            console.log(`\n TOTAL POTENTIAL PROFIT WITH MAX BTC (${MAX_BTC_TO_BUY}): ${totalPotentialProfitInBtc_MAX_BTC_TO_BUY}`)
            // if (IS_LOG_ACTIVE) console.log(`BUY ${coin} IN BTC SELL IN ETH WITH A POTENTIAL OF:    +${potentialPercentageWin.toFixed(4)} %`)
            // if (IS_LOG_ACTIVE) console.log(`BTC-${coin}  ASK: ${btcAsk.Quantity} ${coin} @ ${btcAsk.toFixed(8)} BTC/${coin}   (Max Qty: ${maxQuantityToBuyInBtc.toFixed(5)} BTC) (Type: ${btcAsk.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`ETH-${coin}  BID: ${ethBid.Quantity} ${coin} @ ${ethBid.toFixed(8)} ETH/${coin}   (Max Qty: ${maxQuantityToSellInEth.toFixed(5)} ETH) (Type: ${ethBid.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`BTC-ETH  ASK: ${btcEthAsk.Quantity} BTC @ ${btcEthAsk.toFixed(8)} BTC/ETH     (Max Qty: ${maxEthToSell.toFixed(5)} ETH) (Type: ${btcEthAsk.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`Potential Max Benefit:              ${maxPotentialWinInBtc.toFixed(5)} BTC`);
            // if (IS_LOG_ACTIVE) console.log(`Potential Benefit With ${MAX_BTC_TO_BUY} BTC:   ${maxPotentialWinWithMAX_BTC_TO_BUY.toFixed(5)} BTC`);
            // if (IS_LOG_ACTIVE) console.log("\n");

            return opportunity;
        }

        //Check if buy with eth
        if ((btcBid.Rate * btcEthBid.Rate) > ethAsk.Rate) {
            var potentialPercentageWin = ( ( ( btcBid.Rate * btcEthBid.Rate ) - ethAsk.Rate )  / ethAsk.Rate ) * 100;
            //if (potentialPercentageWin < 5) return;

            if (IS_LOG_ACTIVE) console.log(`BUY ${coin} IN ETH SELL IN BTC WITH A POTENTIAL OF +${potentialPercentageWin} %`)
        }

        return null;
    }

    startMonitoring(coins, workerId) {
        const PAIRS_TO_IGNORE = {"BTC-ETH": true}
        
        this.ticksEventEmitter.on("TICK", async tick => {
            //ignore BTC-ETH
            if (PAIRS_TO_IGNORE[tick.MarketName]) return;
            let coins = tick.MarketName.split("-");
            let baseCoin = coins[0];
            let coin = coins[1];

            let opportunity = detectArbitrageOpportunity(coin);
            if (!opportunity) return;

            //The queue will handle the next tasks by itself
            //buyAndCheckQueue.push(opportunity, (err, result) => {

        });

        
    }

    

}


/**
 * Buy Immediate Or Cancel (returns partial and auto cancel)
 * @param {*} opportunity 
 */
function executeBuyOrder(pair, quantity, rate) {
    return new Promise((resolve, reject) => {
        bittrex.tradebuy({
            MarketName: pair,
            OrderType: 'LIMIT',
            Quantity: opportunity.coinQuantity,
            Rate: opportunity.sellPrice,
            TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
            ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
            Target: 0, // used in conjunction with ConditionType
        }, function( err, data ) {
            if (err) return reject(err);
            resolve(data);
            if (CONFIG.IS_LOG_ACTIVE) console.log("BUY ORDER RESPONSE:", data);
        });
    });
}

/**
 * Sell with stop loss
 * @param {*} opportunity 
 */
function executeSellOrder(opportunity) {
    return new Promise((resolve, reject) => {
        bittrex.tradesell({
            MarketName: opportunity.pair,
            OrderType: 'CONDITIONAL',
            Quantity: opportunity.amountBoughtInCoin,
            Rate: opportunity.bid, //this is the ask when profit calculation was made
            TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
            ConditionType: 'GREATER_THAN', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
            Target: opportunity.stopLoss, // used in conjunction with ConditionType
        }, function( data, err ) {
            if (err) return reject(err);
            resolve(data);
            if (CONFIG.IS_LOG_ACTIVE) console.log("SELL ORDER RESPONSE:", data);
        });
    });
}


function checkOrder(orderId, WAIT_TIME) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // const possibleResponses = [{isFulfilled: false, isPartiallyFulfilled: false, amountFulfilled: 0, rate: 0.002},
            //                            {isFulfilled: false, isPartiallyFulfilled: true, amountFulfilled: 1, rate: 0.0015},
            //                            {isFulfilled: true, isPartiallyFulfilled: false, amountFulfilled: 2, rate: 0.001}]

            // resolve(possibleResponses[2]);
            bittrex.getorder({uuid: orderId}, (err, order) => {
                if (err) return reject(err);
                resolve(order);
                if (CONFIG.IS_LOG_ACTIVE) console.log("GET ORDER RESPONSE:", order);
            });
        }, WAIT_TIME);
    });
}

function cancelOrder(orderId) {
    return new Promise((resolve, reject) => {
        bittrex.cancel({uuid: orderId}, (err, data) => {
            if (err) return reject(err);
            resolve(data);
            if (CONFIG.IS_LOG_ACTIVE) console.log("CANCEL ORDER RESPONSE:", data);
        });
        // setTimeout(() => {
        //     resolve(1);
        // }, 1000);
    });
}



function detectArbitrageOpportunity(coin, pairs) {
    let btcBid = pairs["BTC-"+coin].Buys[0];
    let btcAsk = pairs["BTC-"+coin].Sells[0];

    let ethBid = pairs["ETH-"+coin].Buys[0];
    let ethAsk = pairs["ETH-"+coin].Sells[0];

    let btcEthBid = pairs["BTC-ETH"].Buys[0];
    let btcEthAsk = pairs["BTC-ETH"].Sells[0];

    //Check if buy with bitcoin (if can buy in btc, sell in eth and convert eth in btc with profit)
    // if [ETH-X]bid * [BTC-ETH]bid  > [BTC-X]ask 
    if ((ethBid.Rate * btcEthBid.Rate) > btcAsk.Rate) {
        // ( ( [ETH-X]bid * [BTC-ETH]bid ) - [BTC-X]ask ) / [BTC-X]ask
        // X sold for 2 ETH, 2 ETH sold for 600 BTC vs X sold for 500 BTC 
        let potentialPercentageWin = ( ( ( ethBid.Rate * btcEthBid.Rate ) - btcAsk.Rate )  / btcAsk.Rate ) * 100;
    
        let maxQuantityToBuyInBtc = btcAsk.Quantity * btcAsk.Rate;
        let maxQuantityToSellInBtc = (ethBid.Quantity * ethBid.Rate) * btcAsk.Rate;
        let maxQuantityToConvertInBtc = (btcEthAsk.Quantity * btcEthAsk.Rate) * btcEthBid.Rate;

        let maxQuantityToArbitrageInBtc = maxQuantityToBuyInBtc;
        if (maxQuantityToArbitrageInBtc > maxQuantityToSellInBtc) maxQuantityToArbitrageInBtc = maxQuantityToSellInBtc;
        if (maxQuantityToArbitrageInBtc > maxQuantityToConvertInBtc) maxQuantityToArbitrageInBtc = maxQuantityToConvertInBtc;
        
        let maxQuantityToArbitrageInCoin = maxQuantityToArbitrageInBtc / btcAsk.Rate;

        let maxPotentialWinInBtc = maxQuantityToArbitrageInBtc * (potentialPercentageWin/100);
        let maxPotentialWinWithMAX_BTC_TO_BUY = MAX_BTC_TO_BUY * (potentialPercentageWin/100);

        if (potentialPercentageWin < MIN_PROFIT_PERCENTAGE) return;
        if (maxPotentialWinInBtc < MIN_PROFIT_BTC) return;

        const opportunity = {id: Date.now(), baseCoin: "BTC", coin: coin, 
                            maxQuantityToArbitrageInBasecoin: maxQuantityToArbitrageInBtc, maxQuantityToArbitrageInCoin: maxQuantityToArbitrageInCoin, potentialPercentageWin: potentialPercentageWin, 
                            steps: {BUY: {trials: []}, SELL: {trials: []}, CONVERT: {trials: []}}}

        console.log(`\n ---------- ARBITRAGE OPPORTUNITY ${opportunity.coin} +${opportunity.potentialPercentageWin.toFixed(4)}% ------------- ${opportunity.id} \n`)
        console.log(` MAX TO ARBITRAGE: ${maxQuantityToArbitrageInBtc} BTC -- MAX TO WIN: ${maxPotentialWinInBtc} BTC \n MAX TO WIN WITH ${MAX_BTC_TO_BUY} BTC: ${maxPotentialWinWithMAX_BTC_TO_BUY} \n MAX TO BUY: ${maxQuantityToBuyInBtc} BTC \n MAX TO SELL: ${maxQuantityToSellInBtc} BTC \n MAX TO CONVERT: ${maxQuantityToConvertInBtc} BTC`);
        totalPotentialProfitInBtc = totalPotentialProfitInBtc + maxPotentialWinInBtc;
        totalPotentialInvestementInBtc = totalPotentialInvestementInBtc + maxQuantityToArbitrageInBtc;
        totalPotentialProfitInBtc_MAX_BTC_TO_BUY = totalPotentialProfitInBtc_MAX_BTC_TO_BUY + maxPotentialWinWithMAX_BTC_TO_BUY;
        console.log(`\n TOTAL POTENTIAL INVESTEMENT IN BTC: ${totalPotentialInvestementInBtc} \n TOTAL POTENTIAL PROFIT IN BTC: ${totalPotentialProfitInBtc} BTC \n TOTAL POTENTIAL PROFIT WITH MAX BTC (${MAX_BTC_TO_BUY}): ${totalPotentialProfitInBtc_MAX_BTC_TO_BUY}`)
        // if (IS_LOG_ACTIVE) console.log(`BUY ${coin} IN BTC SELL IN ETH WITH A POTENTIAL OF:    +${potentialPercentageWin.toFixed(4)} %`)
        // if (IS_LOG_ACTIVE) console.log(`BTC-${coin}  ASK: ${btcAsk.Quantity} ${coin} @ ${btcAsk.Rate.toFixed(8)} BTC/${coin}   (Max Qty: ${maxQuantityToBuyInBtc.toFixed(5)} BTC) (Type: ${btcAsk.Type})`);
        // if (IS_LOG_ACTIVE) console.log(`ETH-${coin}  BID: ${ethBid.Quantity} ${coin} @ ${ethBid.Rate.toFixed(8)} ETH/${coin}   (Max Qty: ${maxQuantityToSellInEth.toFixed(5)} ETH) (Type: ${ethBid.Type})`);
        // if (IS_LOG_ACTIVE) console.log(`BTC-ETH  ASK: ${btcEthAsk.Quantity} BTC @ ${btcEthAsk.Rate.toFixed(8)} BTC/ETH     (Max Qty: ${maxEthToSell.toFixed(5)} ETH) (Type: ${btcEthAsk.Type})`);
        // if (IS_LOG_ACTIVE) console.log(`Potential Max Benefit:              ${maxPotentialWinInBtc.toFixed(5)} BTC`);
        // if (IS_LOG_ACTIVE) console.log(`Potential Benefit With ${MAX_BTC_TO_BUY} BTC:   ${maxPotentialWinWithMAX_BTC_TO_BUY.toFixed(5)} BTC`);
        // if (IS_LOG_ACTIVE) console.log("\n");

        return opportunity;
    }

    //Check if buy with eth
    if ((btcBid.Rate * btcEthBid.Rate) > ethAsk.Rate) {
        var potentialPercentageWin = ( ( ( btcBid.Rate * btcEthBid.Rate ) - ethAsk.Rate )  / ethAsk.Rate ) * 100;
        //if (potentialPercentageWin < 5) return;

        if (IS_LOG_ACTIVE) console.log(`BUY ${coin} IN ETH SELL IN BTC WITH A POTENTIAL OF +${potentialPercentageWin} %`)
    }

    return null;
}

/**
 * 2) executes order then checks for its status
 *    returns updated opportunity
 */
async function buyAndCheck(opportunity) {
    try {
        //Set amount to buy (TODO: optimize based on the profit percentage)
        let basecoin = opportunity.pair.split('-')[0];
        opportunity.steps.BUY.amountToBuy = opportunity.coinQuantity;
        if (opportunity.baseCoinQuantity > CONFIG.MAX_BASECOIN_TO_BUY[basecoin]) opportunity.steps.BUY.amountToBuy = CONFIG.MAX_BASECOIN_TO_BUY[basecoin] * opportunity.sellPrice;

        //Execute buy order
        const buyOrderId = await executeBuyOrder(opportunity.pair, opportunity.steps.BUY.amountToBuy, opportunity.sellPrice);
        
        //TODO: HANDLE ERRORS HERE (when buy or sell or check throws exception)
        if (!buyOrderId) return;
        
        //Wait and get order status
        const buyOrderStatus = await checkOrder(buyOrderId, CONFIG.BUY_ORDER_WAIT_TIME);

        //TODO: HANDLE ERRORS HERE (when buy or sell or check throws exception)
        if (!buyOrderStatus) return;

        //if order is not fulfilled and not partially fulfilled, cancel it
        if ( (!buyOrderStatus.isFulfilled) && (!buyOrderStatus.isPartiallyFulfilled) ) {
            //order is auto canceled
            return {
                order: buyOrderStatus,
                executionStatus: CONFIG.ORDER_EXECUTION_CODES.BUY_CANCELED
            }
        }

        if (buyOrderStatus.isPartiallyFulfilled) {
            return {
                order: buyOrderStatus,
                executionStatus: CONFIG.ORDER_EXECUTION_CODES.BUY_PARTIAL
            }
        }

        return {
            order: buyOrderStatus,
            executionStatus: CONFIG.ORDER_EXECUTION_CODES.BUY_FULL
        }
    }
    catch (e) {
        console.error(e);
    }

}

/**
 * 3)
 * @param {*} opportunity 
 */
async function sellAndCheck(opportunity) {
    try {
        //Set amount to sell and stop loss
        opportunity.steps.SELL.quantityToSell = opportunity.steps.BUY.quantityBought;
        opportunity.steps.SELL.stopLossRate = opportunity.sellPrice;

        //Execute order
        const sellOrderId = await executeSellOrder(opportunity.pair, opportunity.steps.SELL.quantityToSell, opportunity.bid, opportunity.steps.SELL.stopLossRate);

        //TODO: HANDLE ERRORS HERE (when buy or sell or check throws exception)
        if (!sellOrderId) return;

        //Wait and get order status
        const sellOrderStatus = await checkOrder(sellOrderId, SELL_ORDER_WAIT_TIME);

        //TODO: HANDLE ERRORS HERE (when buy or sell or check throws exception)
        if (!sellOrderStatus) return;

        //if order is not fulfilled and not partially fulfilled, cancel it
        if ( (!sellOrderStatus.isFulfilled) && (!sellOrderStatus.isPartiallyFulfilled) ) {
            await cancelOrder(sellOrderId);
            return {
                order: sellOrderStatus,
                executionStatus: CONFIG.ORDER_EXECUTION_CODES.SELL_CANCELED
            }
        }

        if (sellOrderStatus.isPartiallyFulfilled) {
            return {
                order: sellOrderStatus,
                executionStatus: CONFIG.ORDER_EXECUTION_CODES.SELL_PARTIAL
            }
        }

        return {
            order: sellOrderStatus,
            executionStatus: CONFIG.ORDER_EXECUTION_CODES.SELL_FULL
        }
    } catch (e) {
        console.error(e);
    }
}



const logQueue = async.queue(async (opportunity, cb) => {
    if (CONFIG.IS_LOG_ACTIVE) console.log(` ----------- ARBITRAGE OPPORTUNITY EXECUTED ${opportunity.id} ------------- \n`, opportunity);
    cb();
}, CONFIG.LOG_CONCURENCY);



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
                case CONFIG.ORDER_EXECUTION_CODES.SELL_FULL:
                    if (CONFIG.IS_LOG_ACTIVE) console.log("\n !!!! FULFILLED SELL order !!!! \n", sellOrderStatus);
                    convertAndCheckQueue.push(opportunity);
                    break;
                case CONFIG.ORDER_EXECUTION_CODES.SELL_PARTIAL:
                    if (CONFIG.IS_LOG_ACTIVE) console.log("\n !!!! PARTIALLY FULFILED SELL Order  !!!! \n", opportunity);
                    //Convert the amount sold
                    convertAndCheckQueue.push(opportunity);
                    //Retry to sell the remaining coins (put it first in the queue)
                    sellAndCheckQueue.unshift(opportunity);
                    break;
                case CONFIG.ORDER_EXECUTION_CODES.SELL_CANCELED:
                    if (CONFIG.IS_LOG_ACTIVE) console.log("\n !!!! CANCELED SELL order !!!! \n", sellOrderStatus);
                    //Retry with the remaining AMOUNT with different parameters
                    sellAndCheckQueue.unshift(opportunity);
                    break;
                default: cb(null, opportunity)
            }
        } catch (e) {
            console.error(e)
            cb(e)
        }
    }, CONFIG.SELL_CONCURENCY);


const buyAndCheckQueue = async.queue(async (opportunity, cb) => {
        try {

            //double check if bid didnt drop compared to when detected 
            if (ticks[opportunity.pair].Bid < opportunity.bid) return cb();

            buyOrderStatusPromise = await buyAndCheck(opportunity);

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
                case CONFIG.ORDER_EXECUTION_CODES.BUY_FULL:
                    if (CONFIG.IS_LOG_ACTIVE) console.log("\n !!!! FULFILLED BUY order !!!! \n", buyOrderStatus);
                    sellAndCheckQueue.push(opportunity);
                    break;
                case CONFIG.ORDER_EXECUTION_CODES.BUY_PARTIAL:
                    if (CONFIG.IS_LOG_ACTIVE) console.log("\n !!!! PARTIALLY FULFILLED BUY order !!!! \n", buyOrderStatus);
                    sellAndCheckQueue.push(opportunity);
                    //Keep the remaining base coins to use them for another opportunity...
                    break;
                case CONFIG.ORDER_EXECUTION_CODES.BUY_CANCEL:
                    if (CONFIG.IS_LOG_ACTIVE) console.log("\n !!!! CANCELED BUY order !!!! \n", buyOrderStatus);
                    //too bad, do nothing and wait for the next
                    break;
                default: cb(null, opportunity)
            }
        } catch (e) {
            console.error(e);
            cb(e);
        }
    }, CONFIG.BUY_CONCURENCY);


var totalPotentialInvestementInBtc = 0
var totalPotentialProfitInBtc = 0;
var totalPotentialProfitInBtc_MAX_BTC_TO_BUY = 0;
// setInterval(() => {
//     console.log(`\n TOTAL POTENTIAL INVESTEMENT IN BTC: ${totalPotentialInvestementInBtc} \n TOTAL POTENTIAL PROFIT IN BTC: ${totalPotentialProfitInBtc} BTC \n`)
// }, 20000);
async function startMonitoring(pairs, workerId) {
    
    subscribeToPairs(pairs).on(CONFIG.EVENTS.MARKET_UPDATE, async (pair, sellOrders, eventId) => {
        //TODO fix duplicates (same opportunity)
        let opportunity = detectPriceDrop(pair, sellOrders, eventId);
        if (!opportunity) return;

        totalPotentialInvestementInBtc = totalPotentialInvestementInBtc + opportunity.baseCoinQuantity;
        totalPotentialProfitInBtc = totalPotentialProfitInBtc + opportunity.potentialProfit;
        
        if (CONFIG.IS_LOG_ACTIVE) {
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