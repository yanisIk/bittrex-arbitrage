const Promise = require("bluebird");

const CONFIG = require("./../configs/BITTREX_ARBITRAGE.json");

const bittrex = Promise.promisifyAll(require('node-bittrex-api'));
bittrex.options({
  'apikey' : CONFIG.API_KEY,
  'apisecret' : CONFIG.API_SECRET,
  'verbose' : false,
  'inverse_callback_arguments' : true
});

const EventEmitter = require('events');

module.exports = class BittrexExchangeService {

    constructor() {
        this.sellOrdersEmitter;
        this.buyOrdersEmitter;
        this.ticksEmitter;
        this.fiveMinTick
    }

    subscribeToStatWindow() {
        
    }

    subscribeToOrders(pairs) {
        if (this.sellOrdersEmitter && this.buyOrdersEmitter) return {sellOrdersEmitter: this.sellOrdersEmitter, buyOrdersEmitter: this.buyOrdersEmitter};
        this.sellOrdersEmitter = new EventEmitter();
        this.buyOrdersEmitter = new EventEmitter();
        
        bittrex.websockets.subscribe(pairs, (data, client) => {    
            
            //Emit orders and updates order book
            if (data.M === 'updateExchangeState') {
                data.A.forEach((pairOrders) => {
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

    subscribeToTicks() {
        if (this.ticksEmitter) return this.ticksEmitter;
        this.ticksEmitter = new EventEmitter();
        
        bittrex.websockets.listen((data, client) => {    
            if (data.M === 'updateSummaryState') {
                data.A.forEach((ticks) => {
                    //setImmediate to run before all other callbacks in the program
                    //and have always up to date data
                    setImmediate(() => ticks.Deltas.forEach((tick) => {
                        this.ticksEmitter.emit('TICK', tick);
                    }));
                });    
            }
        })

        return this.ticksEmitter;
    }

    async buyLimitGoodUntilCanceled(pair, rate, qty) {
        
            const buyOrder = await bittrex.tradebuyAsync({
                MarketName: pair,
                OrderType: 'LIMIT',
                Quantity: qty,
                Rate: rate,
                TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
                ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
                Target: 0, // used in conjunction with ConditionType
            });
            if (!buyOrder.success) throw new Error(buyOrder.message);
            const buyOrderStatus = await this.getClosedOrder(buyOrder.result.uuid);
            if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", buyOrderStatus);
            if (buyOrderStatus.success) {
                buyOrderStatus.result.QuantityBought = buyOrderStatus.result.Quantity - buyOrderStatus.result.QuantityRemaining;
                return buyOrderStatus.result;
            }
            throw new Error(buyOrderStatus.message);

    }

    async buyLimitImmediateOrCancel(pair, rate, qty) {
        
            const buyOrder = await bittrex.tradebuyAsync({
                MarketName: pair,
                OrderType: 'LIMIT',
                Quantity: qty,
                Rate: rate,
                TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
                ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
                Target: 0, // used in conjunction with ConditionType
            });
            if (!buyOrder.success) throw new Error(buyOrder.message);
            const buyOrderStatus = await this.getClosedOrder(buyOrder.result.uuid);
            if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", buyOrderStatus);
            if (buyOrderStatus.success) {
                buyOrderStatus.result.QuantityBought = buyOrderStatus.result.Quantity - buyOrderStatus.result.QuantityRemaining;
                return buyOrderStatus.result;
            }
            throw new Error(buyOrderStatus.message);

    }

    //TODO CHECK HOW TO MARKET ORDERS
    async buyMarket(pair, qty) {
        
        const buyOrder = await bittrex.tradebuyAsync({
                MarketName: pair,
                OrderType: 'MARKET',
                Quantity: qty,
                Rate: 0,
                TimeInEffect: 'FILL_OR_KILL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
                ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
                Target: 0, // used in conjunction with ConditionType
        });
        if (!buyOrder.success) throw new Error(buyOrder.message);
        const buyOrderStatus = await this.getClosedOrder(buyOrder.result.uuid);
        if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", buyOrderStatus);
        if (buyOrderStatus.success) {
            buyOrderStatus.result.QuantityBought = buyOrderStatus.result.Quantity - buyOrderStatus.result.QuantityRemaining;
            return buyOrderStatus.result;
        }
        throw new Error(buyOrderStatus.message);

    }

    async sellLimitGoodUntilCanceled(pair, rate, qty) {
        
            const sellOrder = await bittrex.tradesellAsync({
                MarketName: pair,
                OrderType: 'LIMIT',
                Quantity: qty,
                Rate: rate, //this is the ask when profit calculation was made
                TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
                ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
                Target: 0, // used in conjunction with ConditionType
            });
            if (!sellOrder.success) throw new Error(sellOrder.message);
            const sellOrderStatus = await this.getClosedOrder(sellOrder.result.uuid);
            if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", sellOrderStatus);
            if (sellOrderStatus.success) {
                sellOrderStatus.result.QuantitySold = sellOrderStatus.result.Quantity - sellOrderStatus.result.QuantityRemaining;
                return sellOrderStatus.result;
            }
            throw new Error(sellOrderStatus.message);
            
    }

    async sellLimitImmediateOrCancel(pair, rate, qty) {
        
        const sellOrder = await bittrex.tradesellAsync({
                MarketName: pair,
                OrderType: 'LIMIT',
                Quantity: qty,
                Rate: rate, //this is the ask when profit calculation was made
                TimeInEffect: 'IMMEDIATE_OR_CANCEL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
                ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
                Target: 0, // used in conjunction with ConditionType
        });
        if (!sellOrder.success) throw new Error(sellOrder.message);
        const sellOrderStatus = await this.getClosedOrder(sellOrder.result.uuid);
        if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", sellOrderStatus);
        if (sellOrderStatus.success) {
            sellOrderStatus.result.QuantitySold = sellOrderStatus.result.Quantity - sellOrderStatus.result.QuantityRemaining;
            return sellOrderStatus.result;
        }
        throw new Error(sellOrderStatus.message);
    }

    //TODO CHECK HOW TO MARKET ORDERS
    async sellMarket(pair, qty) {

        const sellOrder = await bittrex.tradesellAsync({
                MarketName: pair,
                OrderType: 'MARKET',
                Quantity: qty,
                Rate: 0, //this is the ask when profit calculation was made
                TimeInEffect: 'FILL_OR_KILL', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
                ConditionType: 'NONE', // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
                Target: 0, // used in conjunction with ConditionType
        });
        if (!sellOrder.success) throw new Error(sellOrder.message);
        const sellOrderStatus = await this.getClosedOrder(sellOrder.result.uuid);
        if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", sellOrderStatus);
        if (sellOrderStatus.success) {
            sellOrderStatus.result.QuantitySold = sellOrderStatus.result.Quantity - sellOrderStatus.result.QuantityRemaining;
            return sellOrderStatus.result;
        }
        throw new Error(sellOrderStatus.message);
    }

    async cancelOrder(orderId) {
        
        const cancelOrder = await bittrex.cancelAsync({uuid: orderId});        
        if (CONFIG.IS_LOG_ACTIVE) console.log("CANCEL ORDER RESPONSE:", cancelOrder);
        if (cancelOrder.success) return cancelOrder.result;
        throw new Error(cancelOrder.message);

    }

    async getOrder(orderId) {
        
        const order = await bittrex.getorderAsync({uuid: orderId});
        if (CONFIG.IS_LOG_ACTIVE) console.log("GET ORDER RESPONSE:", order);
        if (order.success) return order.result;
        throw new Error(order.message);
                
    }

    /**
     * Get the order and doesn't return it until it's closed (recursive call)
     * 5 trials
     * @param {*} orderId 
     * @param {*} trials 
     */
    async getClosedOrder(orderId, trials = 0) {
        
        const order = await this.getOrder(orderId);
        if (order.isOpen === false) return order; 
        const MAX_TRIALS = 5;
        if (trials < MAX_TRIALS) {
            trials += 1;
            return this.getClosedOrder(orderId, trials);
        }
    }

}