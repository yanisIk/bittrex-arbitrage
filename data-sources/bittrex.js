const bittrex = require('node-bittrex-api');
bittrex.options({
  'apikey' : SETTINGS.API_KEY,
  'apisecret' : SETTINGS.API_SECRET,
  'verbose' : false,
  'inverse_callback_arguments' : true
});
const EventEmitter = require('events');

export default class BittrexDataSource {

    constructor() {
        this.sellOrdersEmitter;
        this.buyOrdersEmitter;
        this.ticksEmitter;
    }

    subscribeToOrders(pairs) {
        if (this.sellOrdersEmitter && this.buyOrdersEmitter) return {sellOrdersEmitter: this.sellOrdersEmitter, buyOrdersEmitter: this.buyOrdersEmitter};
        this.sellOrdersEmitter = new EventEmitter();
        this.buyOrdersEmitter = new EventEmitter();
        
        bittrex.websockets.subscribe(pairs, function(data, client) {    
            
            //Emit orders and updates order book
            if (data.M === 'updateExchangeState') {
                data.A.forEach(function(pairOrders) {
                    //setImmediate to run before all other callbacks in the program
                    //and have always up to date data
                    setImmediate(() => pairOrders.Sells.forEach(sellOrder => {
                        this.sellOrdersEmitter.emit(pairOrders.MarketName, sellOrder);
                    }));
                    setImmediate(() => pairOrders.Buys.forEach(buyOrder => {
                        this.buyOrdersEmitter.emit(pairOrders.MarketName, buyOrder);
                    }));
                });
            }
        });

        return {sellOrdersEmitter: this.sellOrdersEmitter, buyOrdersEmitter: this.buyOrdersEmitter};
    }

    subscribeToTicks(pairs) {
        if (this.ticksEmitter) return ticksEmitter;
        this.ticksEmitter = new EventEmitter();
        
        bittrex.websockets.listen(function(data, client) {    
            if (data.M === 'updateSummaryState') {
                data.A.forEach((ticks) => {
                    //setImmediate to run before all other callbacks in the program
                    //and have always up to date data
                    setImmediate(() => ticks.Deltas.forEach((tick) => {
                        ticksEmitter.emit(tick.MarketName, tick);
                    }));
                });    
            }
        })

        return this.ticksEmitter;
    }

}