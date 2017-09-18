// FORMULA : ETH-X . BTC-ETH >  BTC-X => BUY in BTC SELL in ETH

//Check every second the price of the three pairs
//Calculate
//Execute

const COINS_TO_TRACK = ["OMG"];
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
    });

    var pairsData = {};
    pairsDataEventEmitter = new EventEmitter();
    bittrex.websockets.subscribe(PAIRS_TO_TRACK, function(data, client) {      
        if (data.M === 'updateExchangeState') {
            
            data.A.forEach(function(data_for) {
                if (data_for.Buys.length && data_for.Sells.length)
                    pairsData[data_for.MarketName] = data_for;
            });

            if (Object.keys(pairsData).length == PAIRS_TO_TRACK.length) {
                pairsDataEventEmitter.emit(EVENTS.MARKET_UPDATE, pairsData);
                pairsData = {};
            }
        }
    });
    return pairsDataEventEmitter;
}


function detectArbitrageOpportunity(pairs) {
    var btcAsk = pairs["BTC-OMG"].Buys[0];
    var btcSell = pairs["BTC-OMG"].Sells[0];

    var ethAsk = pairs["ETH-OMG"].Buys[0];
    var ethSell = pairs["ETH-OMG"].Sells[0];

    var btcEthAsk = pairs["BTC-ETH"].Buys[0];
    var btcEthSell = pairs["BTC-ETH"].Sells[0];

    if ((ethSell.Rate*btcEthAsk.Rate) > btcAsk.Rate) {
        var potentialPercentageWin = ( ( (ethSell.Rate*btcEthAsk.Rate) - btcAsk.Rate ) * btcEthAsk.Rate ) * 100;
        console.log("BUY IN BTC SELL IN ETH WITH A POTENTIAL OF +"+potentialPercentageWin+" %")
    }
    if ((ethSell.Rate*btcEthAsk.Rate) < btcAsk.Rate) {
        var potentialPercentageWin = ( ( btcAsk.Rate - (ethSell.Rate*btcEthAsk.Rate) ) * btcEthAsk.Rate ) * 100;
        console.log("BUY IN ETH SELL IN BTC WITH A POTENTIAL OF +"+potentialPercentageWin+" %")
    }

    if ((btcSell.Rate*btcEthSell.Rate) < ethAsk.Rate) {
        var potentialPercentageWin = ( ( btcAsk.Rate - (ethSell.Rate*btcEthAsk.Rate) ) * btcEthAsk.Rate ) * 100;
        console.log("BUY IN ETH SELL IN BTC WITH A POTENTIAL OF +"+potentialPercentageWin+" %")
    }
    if ((btcSell.Rate*btcEthSell.Rate) < ethAsk.Rate) {
        var potentialPercentageWin = ( ( btcAsk.Rate - (ethSell.Rate*btcEthAsk.Rate) ) * btcEthAsk.Rate ) * 100;
        console.log("BUY IN ETH SELL IN BTC WITH A POTENTIAL OF +"+potentialPercentageWin+" %")
    }
    
}


var marketUpdatesCount = 0;
subscribeToPairs().on(EVENTS.MARKET_UPDATE, (pairs) => {
    marketUpdatesCount++;
    console.log("----- MARKET UPDATE --------" + marketUpdatesCount);
    detectArbitrageOpportunity(pairs);
//   Object.keys(pairs).forEach(pair => {
//       console.log(pair);
//   }); 
});


