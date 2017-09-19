// FORMULA : ETH-X . BTC-ETH >  BTC-X => BUY in BTC SELL in ETH

//Check every second the price of the three pairs
//Calculate
//Execute

const ALL_BITTREX_PAIRS = ["BTC-LTC","BTC-DOGE","BTC-VTC","BTC-PPC","BTC-FTC","BTC-RDD","BTC-NXT","BTC-DASH","BTC-POT","BTC-BLK","BTC-EMC2","BTC-XMY","BTC-AUR","BTC-EFL","BTC-GLD","BTC-SLR","BTC-PTC","BTC-GRS","BTC-NLG","BTC-RBY","BTC-XWC","BTC-MONA","BTC-THC","BTC-ENRG","BTC-ERC","BTC-VRC","BTC-CURE","BTC-XMR","BTC-CLOAK","BTC-START","BTC-KORE","BTC-XDN","BTC-TRUST","BTC-NAV","BTC-XST","BTC-BTCD","BTC-VIA","BTC-UNO","BTC-PINK","BTC-IOC","BTC-CANN","BTC-SYS","BTC-NEOS","BTC-DGB","BTC-BURST","BTC-EXCL","BTC-SWIFT","BTC-DOPE","BTC-BLOCK","BTC-ABY","BTC-BYC","BTC-XMG","BTC-BLITZ","BTC-BAY","BTC-BTS","BTC-FAIR","BTC-SPR","BTC-VTR","BTC-XRP","BTC-GAME","BTC-COVAL","BTC-NXS","BTC-XCP","BTC-BITB","BTC-GEO","BTC-FLDC","BTC-GRC","BTC-FLO","BTC-NBT","BTC-MUE","BTC-XEM","BTC-CLAM","BTC-DMD","BTC-GAM","BTC-SPHR","BTC-OK","BTC-SNRG","BTC-PKB","BTC-CPC","BTC-AEON","BTC-ETH","BTC-GCR","BTC-TX","BTC-BCY","BTC-EXP","BTC-INFX","BTC-OMNI","BTC-AMP","BTC-AGRS","BTC-XLM","BTC-BTA","USDT-BTC","BTC-CLUB","BTC-VOX","BTC-EMC","BTC-FCT","BTC-MAID","BTC-EGC","BTC-SLS","BTC-RADS","BTC-DCR","BTC-SAFEX","BTC-BSD","BTC-XVG","BTC-PIVX","BTC-XVC","BTC-MEME","BTC-STEEM","BTC-2GIVE","BTC-LSK","BTC-PDC","BTC-BRK","BTC-DGD","ETH-DGD","BTC-WAVES","BTC-RISE","BTC-LBC","BTC-SBD","BTC-BRX","BTC-DRACO","BTC-ETC","ETH-ETC","BTC-STRAT","BTC-UNB","BTC-SYNX","BTC-TRIG","BTC-EBST","BTC-VRM","BTC-SEQ","BTC-XAUR","BTC-SNGLS","BTC-REP","BTC-SHIFT","BTC-ARDR","BTC-XZC","BTC-NEO","BTC-ZEC","BTC-ZCL","BTC-IOP","BTC-DAR","BTC-GOLOS","BTC-UBQ","BTC-KMD","BTC-GBG","BTC-SIB","BTC-ION","BTC-LMC","BTC-QWARK","BTC-CRW","BTC-SWT","BTC-TIME","BTC-MLN","BTC-ARK","BTC-DYN","BTC-TKS","BTC-MUSIC","BTC-DTB","BTC-INCNT","BTC-GBYTE","BTC-GNT","BTC-NXC","BTC-EDG","BTC-LGD","BTC-TRST","ETH-GNT","ETH-REP","USDT-ETH","ETH-WINGS","BTC-WINGS","BTC-RLC","BTC-GNO","BTC-GUP","BTC-LUN","ETH-GUP","ETH-RLC","ETH-LUN","ETH-SNGLS","ETH-GNO","BTC-APX","BTC-TKN","ETH-TKN","BTC-HMQ","ETH-HMQ","BTC-ANT","ETH-TRST","ETH-ANT","BTC-SC","ETH-BAT","BTC-BAT","BTC-ZEN","BTC-1ST","BTC-QRL","ETH-1ST","ETH-QRL","BTC-CRB","ETH-CRB","ETH-LGD","BTC-PTOY","ETH-PTOY","BTC-MYST","ETH-MYST","BTC-CFI","ETH-CFI","BTC-BNT","ETH-BNT","BTC-NMR","ETH-NMR","ETH-TIME","ETH-LTC","ETH-XRP","BTC-SNT","ETH-SNT","BTC-DCT","BTC-XEL","BTC-MCO","ETH-MCO","BTC-ADT","ETH-ADT","BTC-FUN","ETH-FUN","BTC-PAY","ETH-PAY","BTC-MTL","ETH-MTL","BTC-STORJ","ETH-STORJ","BTC-ADX","ETH-ADX","ETH-DASH","ETH-SC","ETH-ZEC","USDT-ZEC","USDT-LTC","USDT-ETC","USDT-XRP","BTC-OMG","ETH-OMG","BTC-CVC","ETH-CVC","BTC-PART","BTC-QTUM","ETH-QTUM","ETH-XMR","ETH-XEM","ETH-XLM","ETH-NEO","USDT-XMR","USDT-DASH","ETH-BCC","USDT-BCC","BTC-BCC","USDT-NEO","ETH-WAVES","ETH-STRAT","ETH-DGB","ETH-FCT","ETH-BTS","USDT-OMG"];
const BTC_PAIRS = ALL_BITTREX_PAIRS.filter(p => p.split("-")[0] === "BTC").map(p => p.split("-")[1]);
const ETH_PAIRS = ALL_BITTREX_PAIRS.filter(p => p.split("-")[0] === "ETH").map(p => p.split("-")[1]);
var COINS_TO_TRACK = [];
BTC_PAIRS.forEach(coin => {
    if (ETH_PAIRS.includes(coin)) COINS_TO_TRACK.push(coin);;
})

const EVENTS = {MARKET_UPDATE: "MARKET_UPDATE"}

var bittrex = require('node-bittrex-api');
bittrex.options({
  'apikey' : process.env.API_KEY || "f3d8e9751b9f44f68110efb56cb224e5",
  'apisecret' : process.env.API_SECRET || "3bac270937014734bc2ba78442a01c5e",
});
const EventEmitter = require('events');

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
                    if (baseCoin === "BTC" && coin === "ETH") {
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


/**
 * TODO: calculate with fees (0.25% / trade , 0.75% total ?)
 * @param {*} coin 
 * @param {*} pairs 
 */
var plotData = {};
COINS_TO_TRACK.forEach(c => plotData[c] = []);
function detectArbitrageOpportunity(coin, pairs) {
    var btcBid = pairs["BTC-"+coin].Buys[0];
    var btcAsk = pairs["BTC-"+coin].Sells[0];

    var ethBid = pairs["ETH-"+coin].Buys[0];
    var ethAsk = pairs["ETH-"+coin].Sells[0];

    var btcEthBid = pairs["BTC-ETH"].Buys[0];
    var btcEthAsk = pairs["BTC-ETH"].Sells[0];

    //Check if buy with bitcoin
    if ((ethBid.Rate * btcEthAsk.Rate) > btcAsk.Rate) {
        
        var potentialPercentageWin = ( ( ( ethBid.Rate * btcEthAsk.Rate ) - btcAsk.Rate )  / btcAsk.Rate ) * 100;
    
        var maxQuantityToBuyInBtc = btcAsk.Quantity * btcAsk.Rate;
        var maxQuantityToSellInEth = ethBid.Quantity * ethBid.Rate;
        var maxEthToSell = btcEthAsk.Quantity * btcEthAsk.Rate;
        
        var maxBtcToArbitrage = maxQuantityToBuyInBtc;
        if (maxQuantityToSellInEth < maxQuantityToBuyInBtc) maxBtcToArbitrage = maxQuantityToSellInEth;

        var potentialWinInBtc = maxBtcToArbitrage * (potentialPercentageWin/100);
        var potentialWinWithOneMilliBitcoin = 0.001 * (potentialPercentageWin/100);

        if (potentialPercentageWin < 5) return;
        //plotData[coin].push(potentialPercentageWin);
        console.log(`---------- ARBITRAGE OPPORTUNITY ${coin} ${Date.now()}------------- \n`)
        console.log(`BUY ${coin} IN BTC SELL IN ETH WITH A POTENTIAL OF:    +${potentialPercentageWin} %`)
        console.log(`BTC-${coin}  ASK: ${btcAsk.Quantity} ${coin} @ ${btcAsk.Rate} BTC/${coin}   (Max Qty: ${maxQuantityToBuyInBtc} BTC) (Type: ${btcAsk.Type})`);
        console.log(`ETH-${coin}  BID: ${ethBid.Quantity} ${coin} @ ${ethBid.Rate} ETH/${coin}   (Max Qty: ${maxQuantityToSellInEth} ETH) (Type: ${ethBid.Type})`);
        console.log(`BTC-ETH  ASK: ${btcEthAsk.Quantity} BTC @ ${btcEthAsk.Rate} BTC/ETH     (Max Qty: ${maxEthToSell} ETH) (Type: ${btcEthAsk.Type})`);
        console.log(`Potential Max Benefit:              ${potentialWinInBtc} BTC`);
        console.log(`Potential Benefit With 0.001 BTC:   ${potentialWinWithOneMilliBitcoin} BTC`);
        console.log("\n");

        return {coin: coin, baseCoin: "BTC", pairs: pairs, potentialPercentageWin: potentialPercentageWin, maxQtyToArbitrage: maxBtcToArbitrage}
    }

    //Check if buy with eth
    if ((btcBid.Rate * btcEthBid.Rate) > ethAsk.Rate) {
        var potentialPercentageWin = ( ( ( btcBid.Rate * btcEthBid.Rate ) - ethAsk.Rate )  / ethAsk.Rate ) * 100;
        //if (potentialPercentageWin < 5) return;
        //plotData[coin].push(potentialPercentageWin);
        console.log(`BUY ${coin} IN ETH SELL IN BTC WITH A POTENTIAL OF +${potentialPercentageWin} %`)
    }

}


function executeBuyOrder(opportunity) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve(1);
        }, 1000);
    });
}

const BUY_ORDER_TIMEOUT = 3000;
function checkOrder(orderId) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            resolve({isFulfilled: false, isPartiallyFulfilled: false, amountFulfilled: 0});
        }, BUY_ORDER_TIMEOUT);
    });
}


var marketUpdatesCount = 0;
subscribeToPairs().on(EVENTS.MARKET_UPDATE, async (coin, pairs) => {
    marketUpdatesCount++;
    //console.log(`----- MARKET UPDATE FOR ${coin} (${Object.keys(pairs).length} pairs) -------- (${marketUpdatesCount})`);
    
    //Detect and get opportunity
    const opportunity = detectArbitrageOpportunity(coin, pairs);
    if (!opportunity) return;

    //Execute orders
    const buyOrderId = await executeBuyOrder(opportunity);
    
    const orderStatus = await checkOrder(buyOrderId);

    if ( (!orderStatus.isFulfilled) || order.isPartiallyFulfilled) {
        
    }


    
    // Object.keys(pairs).forEach(pair => {
    //     console.log(pair);
    // }); 

    
});

// setInterval(() => {
//         Object.keys(plotData).forEach(coin => {
//             console.log(`${coin} opportunity: ${plotData[coin]}`);
//         })
//     }, 5000)


