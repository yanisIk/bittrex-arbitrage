// FORMULA : ETH-X . BTC-ETH >  BTC-X => BUY in BTC SELL in ETH

//Check every second the price of the three pairs
//Calculate
//Execute
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
const CONVERT_ORDER_TIMOUT = 1*1000;

const MIN_PROFIT_PERCENTAGE = 50;

const BUY_CONCURENCY = 10;
const SELL_CONCURENCY = 10;
const CONVERT_CONCURENCY = 5;
const LOG_CONCURENCY = 2;

var pairsDataEventEmitter;
function subscribeToPairs() {
    if (pairsDataEventEmitter) return pairsDataEventEmitter;

    var PAIRS_TO_TRACK = [];
    PAIRS_TO_TRACK.push("BTC-ETH");
    COINS_TO_TRACK.forEach(c => {
        PAIRS_TO_TRACK.push("BTC-"+c);
        PAIRS_TO_TRACK.push("ETH-"+c);
        //PAIRS_TO_TRACK.push("USDT-"+c);
    });

    var pairsData = {};
    COINS_TO_TRACK.forEach(c => pairsData[c] = {});

    pairsDataEventEmitter = new EventEmitter();
    bittrex.websockets.subscribe(PAIRS_TO_TRACK, function(data, client) {    
        // if (data.M === 'updateSummaryState') {
        //     console.log(JSON.stringify(data))
        //     process.exit(0)
        // }
        if (data.M === 'updateExchangeState') {

            data.A.forEach(function(data_for) {
                //Keep only new orders Type 0 (Type 1 = cancelled/filled, Type 2 = changed (partial or cancel request))
                data_for.Buys = data_for.Buys.filter(order => order.Type != 1);
                data_for.Sells = data_for.Buys.filter(order => order.Type != 1);

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

            resolve(possibleResponses[1]);
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
function detectArbitrageOpportunity(coin, pairs) {
    let btcBid = pairs["BTC-"+coin].Buys[0];
    let btcAsk = pairs["BTC-"+coin].Sells[0];

    let ethBid = pairs["ETH-"+coin].Buys[0];
    let ethAsk = pairs["ETH-"+coin].Sells[0];

    let btcEthBid = pairs["BTC-ETH"].Buys[0];
    let btcEthAsk = pairs["BTC-ETH"].Sells[0];

    //Check if buy with bitcoin
    if ((ethBid.Rate * btcEthAsk.Rate) > btcAsk.Rate) {
        
        let potentialPercentageWin = ( ( ( ethBid.Rate * btcEthAsk.Rate ) - btcAsk.Rate )  / btcAsk.Rate ) * 100;
    
        let maxQuantityToBuyInBtc = btcAsk.Quantity * btcAsk.Rate;
        let maxQuantityToSellInEth = ethBid.Quantity * ethBid.Rate;
        let maxEthToSell = btcEthAsk.Quantity * btcEthAsk.Rate;
        
        let maxBtcToArbitrage = maxQuantityToBuyInBtc;
        if (maxQuantityToSellInEth < maxQuantityToBuyInBtc) maxBtcToArbitrage = maxQuantityToSellInEth;

        let potentialWinInBtc = maxBtcToArbitrage * (potentialPercentageWin/100);
        let potentialWinWithOneMilliBitcoin = 0.001 * (potentialPercentageWin/100);

        if (potentialPercentageWin < MIN_PROFIT_PERCENTAGE) return;

        const opportunity = {id: Date.now(), baseCoin: "BTC", coin: coin, maxQtyToArbitrage: maxBtcToArbitrage, potentialPercentageWin: potentialPercentageWin, steps: {BUY: {}, SELL: {}, CONVERT: {}}}

        console.log(`\n ---------- ARBITRAGE OPPORTUNITY ${opportunity.coin} +${opportunity.potentialPercentageWin.toFixed(4)}% ------------- ${opportunity.id} \n`)
        console.log(`BUY ${coin} IN BTC SELL IN ETH WITH A POTENTIAL OF:    +${potentialPercentageWin.toFixed(4)} %`)
        console.log(`BTC-${coin}  ASK: ${btcAsk.Quantity} ${coin} @ ${btcAsk.Rate.toFixed(8)} BTC/${coin}   (Max Qty: ${maxQuantityToBuyInBtc.toFixed(5)} BTC) (Type: ${btcAsk.Type})`);
        console.log(`ETH-${coin}  BID: ${ethBid.Quantity} ${coin} @ ${ethBid.Rate.toFixed(8)} ETH/${coin}   (Max Qty: ${maxQuantityToSellInEth.toFixed(5)} ETH) (Type: ${ethBid.Type})`);
        console.log(`BTC-ETH  ASK: ${btcEthAsk.Quantity} BTC @ ${btcEthAsk.Rate.toFixed(8)} BTC/ETH     (Max Qty: ${maxEthToSell.toFixed(5)} ETH) (Type: ${btcEthAsk.Type})`);
        console.log(`Potential Max Benefit:              ${potentialWinInBtc.toFixed(5)} BTC`);
        console.log(`Potential Benefit With 0.001 BTC:   ${potentialWinWithOneMilliBitcoin}.toFixed(5) BTC`);
        console.log("\n");

        return opportunity;
    }

    //Check if buy with eth
    if ((btcBid.Rate * btcEthBid.Rate) > ethAsk.Rate) {
        var potentialPercentageWin = ( ( ( btcBid.Rate * btcEthBid.Rate ) - ethAsk.Rate )  / ethAsk.Rate ) * 100;
        //if (potentialPercentageWin < 5) return;

        console.log(`BUY ${coin} IN ETH SELL IN BTC WITH A POTENTIAL OF +${potentialPercentageWin} %`)
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

    //update opportunity
    opportunity.amountBought = convertOrderStatus.amountFulfilled;

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


const logQueue = async.queue(async (opportunity) => {
    console.log(" ----------- ARBITRAGE OPPORTUNITY EXECUTED ------------- \n", opportunity);
}, LOG_CONCURENCY)

const convertAndCheckQueue = async.queue(async (opportunity) => {
        opportunity = await convertAndCheck(opportunity);
        
        switch(opportunity.executionStatus) {
            case ORDER_EXECUTION_CODES.CONVERT_FULL:
                console.log("\n !!!! FULFILLED CONVERT order !!!! \n", opportunity);
                logQueue.push(opportunity);
                break;
            case ORDER_EXECUTION_CODES.CONVERT_PARTIAL:
                console.log("\n !!!! PARTIALLY FULFILED CONVERT Order  !!!! \n", opportunity);
                //Retry to convert the remaining with higher price until threshold
                convertAndCheckQueue.push(opportunity);
                break;
            case ORDER_EXECUTION_CODES.CONVERT_CANCELED:
                console.log("\n !!!! CANCELED CONVERT order !!!! \n", opportunity);
                //Retry to convert with higher price until threshold
                convertAndCheckQueue.unshift(opportunity);
                break;  
        }
    }, CONVERT_CONCURENCY);


const sellAndCheckQueue = async.queue(async (opportunity) => {
        sellOrderStatus = await sellAndCheck(opportunity);
        
        switch(sellOrderStatus.executionStatus) {
            case ORDER_EXECUTION_CODES.SELL_FULL:
                console.log("\n !!!! FULFILLED SELL order !!!! \n", sellOrderStatus);
                //update opportunity
                updatedOpportunity.steps.SELLS.push({   amountSoldInCoin:       sellOrderStatus.order.amountFulfilledInCoin,
                                                        amountSoldInBaseCoin:   sellOrderStatus.order.amountFulfilledInBaseCoin,
                                                        amountLeftInCoin:       opportunity.steps.BUY.amountBoughtInCoin - sellOrderStatus.order.amountFulfilledInCoin,
                                                        amountLeftInBaseCoin:   opportunity.steps.BUY.amountBoughtInBaseCoin - sellOrderStatus.order.amountFulfilledInBaseCoin,
                                                        timestamp:              Date.now()
                                                    });
                convertAndCheckQueue.push(opportunity);
                break;
            case ORDER_EXECUTION_CODES.SELL_PARTIAL:
                console.log("\n !!!! PARTIALLY FULFILED SELL Order  !!!! \n", sellOrderStatus);
                
       
                opportunity.steps.SELLS.push({  amountSoldInCoin:       sellOrderStatus.order.amountFulfilledInCoin,
                                                amountSoldInBaseCoin:   sellOrderStatus.order.amountFulfilledInBaseCoin,
                                                amountLeftInCoin:       opportunity.steps.BUY.amountBoughtInCoin - sellOrderStatus.order.amountFulfilledInCoin,
                                                amountLeftInBaseCoin:   opportunity.steps.BUY.amountBoughtInBaseCoin - sellOrderStatus.order.amountFulfilledInBaseCoin,
                                                timestamp:              Date.now()
                                                });

                //Convert the amount sold
                convertAndCheckQueue.push(opportunity);
                //Retry to sell the remaining coins (put it first in the queue)
                sellAndCheckQueue.unshift(opportunity);
                break;
            case ORDER_EXECUTION_CODES.SELL_CANCELED:
                console.log("\n !!!! CANCELED SELL order !!!! \n", sellOrderStatus);
                //Retry with the remaining AMOUNT with different parameters
                sellAndCheckQueue.unshift(opportunity);
                break;  
        }
    }, SELL_CONCURENCY);


const buyAndCheckQueue = async.queue(async (opportunity) => {
        buyOrderStatus = await buyAndCheck(opportunity);
        //console.log(buyOrderStatus.executionStatus, opportunity.id);
        switch(buyOrderStatus.executionStatus) {
            case ORDER_EXECUTION_CODES.BUY_FULL:
                console.log("\n !!!! FULFILLED BUY order !!!! \n", buyOrderStatus);
                //update opportunity
                opportunity.steps.BUY.amountBoughtInCoin = buyOrderStatus.order.amountFulfilledInCoin;
                opportunity.steps.BUY.amountBoughtInBaseCoin = buyOrderStatus.order.amountFulfilledInBaseCoin;
                sellAndCheckQueue.push(opportunity);
                break;
            case ORDER_EXECUTION_CODES.BUY_PARTIAL:
                console.log("\n !!!! PARTIALLY FULFILLED BUY order !!!! \n", buyOrderStatus);
                //update opportunity
                opportunity.steps.BUY.amountBought = buyOrderStatus.order.amountFulfilled;
                sellAndCheckQueue.push(opportunity);
                //Keep the remaining base coins to use them for another opportunity...
                break;
            case ORDER_EXECUTION_CODES.BUY_CANCEL:
                console.log("\n !!!! CANCELED BUY order !!!! \n", buyOrderStatus);
                //too bad, do nothing and wait for the next
                break;
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
    //buyAndCheckQueue.push(opportunity);
    
    
}



subscribeToPairs().on(EVENTS.MARKET_UPDATE, async (coin, pairs) => {

    //console.log(`----- MARKET UPDATE FOR ${coin} (${Object.keys(pairs).length} pairs) -------- (${marketUpdatesCount})`);
   
    executeArbitrage(coin, pairs).catch(e => console.error(e));

    
});