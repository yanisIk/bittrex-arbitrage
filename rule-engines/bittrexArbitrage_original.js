// FORMULA : ETH-X . BTC-ETH >  BTC-X => BUY in BTC SELL in ETH

//Check every second the price of the three pairs
//Calculate
//Execute

//IDEA 2 
/**
 * Monitor spread (bid -- ask), if order comes in as (bid > order < ask), buy it and ressel it
 */

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
const BTC_PAIRS = ALL_BITTREX_PAIRS.filter(p => p.split("-")[0] === "BTC").map(p => p.split("-")[1]);
const ETH_PAIRS = ALL_BITTREX_PAIRS.filter(p => p.split("-")[0] === "ETH").map(p => p.split("-")[1]);

var COINS_TO_TRACK = [];
BTC_PAIRS.forEach(coin => {
    if (ETH_PAIRS.includes(coin)) COINS_TO_TRACK.push(coin);;
})
const COINS_TO_TRACK_CHUNKED = _.chunk(COINS_TO_TRACK, COINS_TO_TRACK.length / numWorkers);


const IS_LOG_ACTIVE = false;
const EVENTS = {MARKET_UPDATE: "MARKET_UPDATE"}
const ORDER_EXECUTION_CODES = {
    BUY_CANCELED: "BUY CANCELED",
    BUY_PARTIAL: "BUY PARTIAL",
    BUY_FULL: "BUY FULL",
    SELL_CANCELED: "SELL CANCELED",
    SELL_PARTIAL: "SELL PARTIAL",
    SELL_FULL: "SELL FULL",
    CONVERT_CANCELED: "CONVERT CANCELED",
    CONVERT_PARTIAL: "CONVERT PARTIAL",
    CONVERT_FULL: "CONVERT FULL"
}

const BUY_ORDER_TIMEOUT = 1*1000;
const SELL_ORDER_TIMEOUT = 1*1000;
const CONVERT_ORDER_TIMEOUT = 1*1000;

const MIN_PROFIT_PERCENTAGE = 20;
const MIN_PROFIT_BTC = 0;
const MAX_BTC_TO_BUY = 0.0001;

const MAX_AMOUNTS_TO_BUY_BY_PERCENTAGE_PROFIT = {
    10: 0.0001,
    20: 0.0001 * 2,
    30: 0.0001 * 3,
    40: 0.0001 * 4,
    50: 0.0001 * 5,
    60: 0.0001 * 6,
    70: 0.0001 * 7,
    80: 0.0001 * 8,
    90: 0.0001 * 9,
    100: 0.0001 * 10,
}

const BUY_CONCURENCY = 100;
const SELL_CONCURENCY = 100;
const CONVERT_CONCURENCY = 50;
const LOG_CONCURENCY = 20;

var pairsDataEventEmitter;
function subscribeToPairs(coins) {
    if (pairsDataEventEmitter) return pairsDataEventEmitter;

    var PAIRS_TO_TRACK = [];
    PAIRS_TO_TRACK.push("BTC-ETH");
    coins.forEach(c => {
        PAIRS_TO_TRACK.push("BTC-"+c);
        PAIRS_TO_TRACK.push("ETH-"+c);
        //PAIRS_TO_TRACK.push("USDT-"+c);
    });

    var pairsData = {};
    coins.forEach(c => pairsData[c] = {});

    pairsDataEventEmitter = new EventEmitter();
    bittrex.websockets.subscribe(PAIRS_TO_TRACK, function(data, client) {    
        // if (data.M === 'updateSummaryState') {
        //     if (IS_LOG_ACTIVE) console.log(JSON.stringify(data))
        //     process.exit(0)
        // }
        if (data.M === 'updateExchangeState') {

            data.A.forEach(function(data_for) {
                //Keep only new orders Type 0 (Type 1 = cancelled/filled, Type 2 = changed (partial or cancel request))
                data_for.Buys = data_for.Buys.filter(order => order.Type != 1);
                data_for.Sells = data_for.Sells.filter(order => order.Type != 1);

                if (data_for.Buys.length && data_for.Sells.length) {
                    var coins = data_for.MarketName.split("-");
                    var baseCoin = coins[0];
                    var coin = coins[1];
                    //If BTC-ETH 
                    if (data_for.MarketName === 'BTC-ETH') {
                        //PUSH IT TO ALL
                        Object.keys(pairsData).forEach(coin => {
                            pairsData[coin][data_for.MarketName] = data_for;
                        });
                    } else {
                        pairsData[coin][data_for.MarketName] = data_for;
                    }
                }
            });

            Object.keys(pairsData).forEach(coin => {
                if (Object.keys(pairsData[coin]).length === 3 ) {
                    pairsDataEventEmitter.emit(EVENTS.MARKET_UPDATE, coin, pairsData[coin]);
                    pairsData[coin] = {};
                }
            });
        }
    });
    return pairsDataEventEmitter;
}


function executeBuyOrder(opportunity) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(1);
        }, 1000);
    });
}

function executeSellOrder(opportunity) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(1);
        }, 1000);
    });
}

function executeConvertOrder(opportunity) {
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




/**
 * 1) Detect and get opportunity
 */
var totalPotentialInvestementInBtc = 0
var totalPotentialProfitInBtc = 0;
var totalPotentialProfitInBtc_MAX_BTC_TO_BUY = 0;

// setInterval(() => {
//     console.log(`\n TOTAL POTENTIAL INVESTEMENT IN BTC: ${totalPotentialInvestementInBtc} \n TOTAL POTENTIAL PROFIT IN BTC: ${totalPotentialProfitInBtc} BTC \n TOTAL POTENTIAL PROFIT WITH MAX BTC (${MAX_BTC_TO_BUY}): ${totalPotentialProfitInBtc_MAX_BTC_TO_BUY}`)
// }, 5000);

/*  
    1) detect abnormal low price in BTC
    2) get max qty in btc
    3) 
*/
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

const convertAndCheckQueue = async.queue(async (opportunity, cb) => {
        try {
            convertOrderStatus = await convertAndCheck(opportunity);
        
            //update opportunity
            opportunity.steps.CONVERT.trials.push({  amountConvertedInCoin:       convertOrderStatus.order.amountFulfilledInCoin,
                                                    amountConvertedInBaseCoin:   convertOrderStatus.order.amountFulfilledInBaseCoin,
                                                    amountLeftInCoin:       opportunity.steps.BUY.amountBoughtInCoin - convertOrderStatus.order.amountFulfilledInCoin,
                                                    amountLeftInBaseCoin:   opportunity.steps.BUY.amountBoughtInBaseCoin - convertOrderStatus.order.amountFulfilledInBaseCoin,
                                                    timestamp:              Date.now()
                                                });
            opportunity.steps.CONVERT.totalCoinConverted = (opportunity.steps.CONVERT.totalCoinConverted || 0) + convertOrderStatus.order.amountFulfilledInCoin;
            opportunity.steps.CONVERT.totalBaseCoinConverted = (opportunity.steps.CONVERT.totalBaseCoinConverted || 0) + convertOrderStatus.order.amountFulfilledInBaseCoin;
            opportunity.steps.CONVERT.totalCoinToConvert = opportunity.steps.BUY.amountBoughtInCoin;
            opportunity.steps.CONVERT.totalBaseCoinToConvert = opportunity.steps.BUY.amountBoughtInBaseCoin;
            opportunity.steps.CONVERT.amountInCoinLeftToConvert = opportunity.steps.CONVERT.totalCoinToConvert - opportunity.steps.CONVERT.totalCoinConverted;
            opportunity.steps.CONVERT.amountInBaseCoinLeftToConvert = opportunity.steps.CONVERT.totalBaseCoinToConvert - opportunity.steps.CONVERT.totalBaseCoinConverted;

            switch(convertOrderStatus.executionStatus) {
                case ORDER_EXECUTION_CODES.CONVERT_FULL:
                    if (IS_LOG_ACTIVE) console.log("\n !!!! FULFILLED CONVERT order !!!! \n", convertOrderStatus);
                    logQueue.push(opportunity);
                    break;
                case ORDER_EXECUTION_CODES.CONVERT_PARTIAL:
                    if (IS_LOG_ACTIVE) console.log("\n !!!! PARTIALLY FULFILED CONVERT Order  !!!! \n", convertOrderStatus);
                    //Retry to convert the remaining with higher price until threshold
                    convertAndCheckQueue.push(opportunity);
                    break;
                case ORDER_EXECUTION_CODES.CONVERT_CANCELED:
                    if (IS_LOG_ACTIVE) console.log("\n !!!! CANCELED CONVERT order !!!! \n", convertOrderStatus);
                    //Retry to convert with higher price until threshold
                    convertAndCheckQueue.unshift(opportunity);
                    break; 
                default: cb(null, opportunity)
            }
        } catch (e) {
            console.error(e);
            cb(e);
        }
    }, CONVERT_CONCURENCY);


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


/**
 * Launches the monitoring
 * if receives opportunity, it came from ERROR
 * @param {*} opportunity 
 */
async function executeArbitrage(coin, pairs) {

    
    let opportunity = detectArbitrageOpportunity(coin, pairs);
    if (!opportunity) return;

    //The queue will handle the next tasks by itself
    buyAndCheckQueue.push(opportunity, (err, result) => {});
    
    
}


function startMonitoring(coins, workerId) {
    subscribeToPairs(coins).on(EVENTS.MARKET_UPDATE, async (coin, pairs) => {
        //if (IS_LOG_ACTIVE) console.log(`----- MARKET UPDATE FOR ${coin} (${Object.keys(pairs).length} pairs) -------- (${marketUpdatesCount})`);
        executeArbitrage(coin, pairs).catch(e => console.error(e));
    });
}


//USE MULTIPLE CORES
if(cluster.isMaster) {
    
    console.log('Master cluster setting up ' + numWorkers + ' workers...');

    for(var i = 0; i < numWorkers; i++) {
        let worker = cluster.fork();
        worker.send({workerId: i, coins: COINS_TO_TRACK_CHUNKED[i]})
    }
} else {
    process.on('message', function(data) {
        console.log(`WORKER ${data.workerId} RECEIVED ${data.coins.length} COINS ${data.coins[0]} ...`);
        startMonitoring(data.coins);
    });
}