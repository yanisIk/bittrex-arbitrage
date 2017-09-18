// FORMULA : ETH-X . BTC-ETH >  BTC-X => BUY in BTC SELL in ETH

//Check every second the price of the three pairs
//Calculate
//Execute

const COINS_TO_TRACK = ["OMG", "BAT", "NEO", "QTUM", "PAY"];
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
        if (data.M === 'updateExchangeState') {

            data.A.forEach(function(data_for) {
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

    if ((ethAsk.Rate*btcEthBid.Rate) > btcBid.Rate) {
        var potentialPercentageWin = ( ( (ethAsk.Rate*btcEthBid.Rate) - btcBid.Rate ) * btcEthBid.Rate ) * 100;
        plotData[coin].push(potentialPercentageWin);
        //console.log("BUY IN BTC SELL IN ETH WITH A POTENTIAL OF +"+potentialPercentageWin+" %")
    }
    if ((ethAsk.Rate*btcEthBid.Rate) < btcBid.Rate) {
        var potentialPercentageWin = ( ( btcBid.Rate - (ethAsk.Rate*btcEthBid.Rate) ) * btcEthBid.Rate ) * 100;
        plotData[coin].push(potentialPercentageWin);
        //console.log("BUY IN ETH SELL IN BTC WITH A POTENTIAL OF +"+potentialPercentageWin+" %")
    }

    // if ((btcAsk.Rate*btcEthAsk.Rate) < ethBid.Rate) {
    //     var potentialPercentageWin = ( ( btcBid.Rate - (ethAsk.Rate*btcEthBid.Rate) ) * btcEthBid.Rate ) * 100;
    //     console.log("BUY IN ETH SELL IN BTC WITH A POTENTIAL OF +"+potentialPercentageWin+" %")
    // }
    // if ((btcAsk.Rate*btcEthAsk.Rate) < ethBid.Rate) {
    //     var potentialPercentageWin = ( ( btcBid.Rate - (ethAsk.Rate*btcEthBid.Rate) ) * btcEthBid.Rate ) * 100;
    //     console.log("BUY IN ETH SELL IN BTC WITH A POTENTIAL OF +"+potentialPercentageWin+" %")
    // }
    
}


var marketUpdatesCount = 0;
subscribeToPairs().on(EVENTS.MARKET_UPDATE, (coin, pairs) => {
    marketUpdatesCount++;
    //console.log(`----- MARKET UPDATE FOR ${coin} (${Object.keys(pairs).length} pairs) -------- (${marketUpdatesCount})`);
    detectArbitrageOpportunity(coin, pairs);

    
    // Object.keys(pairs).forEach(pair => {
    //     console.log(pair);
    // }); 

    
});

setInterval(() => {
        Object.keys(plotData).forEach(coin => {
            console.log(`${coin} opportunity: ${plotData[coin]}`);
        })
    }, 5000)


