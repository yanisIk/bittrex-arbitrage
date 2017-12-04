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
const ProgressBar = require('progress');

let singleton = null;

module.exports = class BittrexExchangeService {

    constructor() {
        if (singleton) return singleton;
        singleton = this;

        this.sellOrdersEmitter;
        this.buyOrdersEmitter;
        this.ticksEmitter;
    }

    subscribeToStatWindow() {
        
    }

    subscribeToOrders(pairs) {
        if (this.sellOrdersEmitter && this.buyOrdersEmitter) return {sellOrdersEmitter: this.sellOrdersEmitter, buyOrdersEmitter: this.buyOrdersEmitter};
        this.sellOrdersEmitter = new EventEmitter();
        this.buyOrdersEmitter = new EventEmitter();
        
        let ordersProgress = null;
        if (CONFIG.IS_LOG_ACTIVE) ordersProgress = new ProgressBar(`WORKER#${WORKER_ID} : [:type][:marketName] :rate orders/s (:current orders since :elapsed s)`, { total: 999999999999 });

        bittrex.websockets.subscribe(pairs, (data, client) => {    
            
            //Emit orders and updates order book
            if (data.M === 'updateExchangeState') {
                data.A.forEach((pairOrders) => {
                    //setImmediate to run before all other callbacks in the program
                    //and have always up to date data
                    setImmediate(() => pairOrders.Sells.forEach(sellOrder => {
                        this.sellOrdersEmitter.emit(pairOrders.MarketName, sellOrder);
                        if (CONFIG.IS_LOG_ACTIVE) ordersProgress.tick({marketName: pairOrders.MarketName, type: "SELL"});
                    }));
                    setImmediate(() => pairOrders.Buys.forEach(buyOrder => {
                        this.buyOrdersEmitter.emit(pairOrders.MarketName, buyOrder);
                        if (CONFIG.IS_LOG_ACTIVE) ordersProgress.tick({marketName: pairOrders.MarketName, type: "BUY"});
                    }));
                });
            }
        });

        return {sellOrdersEmitter: this.sellOrdersEmitter, buyOrdersEmitter: this.buyOrdersEmitter};
    }

    subscribeToTicks(pairs) {
        if (this.ticksEmitter) return this.ticksEmitter;
        this.ticksEmitter = new EventEmitter();

        let ticksProgress = null;
        if (!CONFIG.IS_LOG_ACTIVE) ticksProgress = new ProgressBar(`WORKER#${WORKER_ID} : [:marketName] :rate ticks/s (:current ticks since :elapsed s)`, { total: 999999999999 });
        
        let ticksBatchId = null;
        bittrex.websockets.listen((data, client) => {    
            if (data.M === 'updateSummaryState') {
                ticksBatchId = Date.now();
                data.A.forEach((ticks) => {
                    //setImmediate to run before all other callbacks in the program
                    //and have always up to date data
                    setImmediate(() => ticks.Deltas.forEach((tick) => {
                        tick.BatchId = ticksBatchId;
                        this.ticksEmitter.emit('TICK', tick);
                        if (!CONFIG.IS_LOG_ACTIVE) ticksProgress.tick({marketName: tick.MarketName});
                    }));
                });    
            }
        });

        return this.ticksEmitter;
    }

    getBuyOrdersEmitter() {
        return this.buyOrdersEmitter;
    }

    getSellOrdersEmitter() {
        return this.sellOrdersEmitter;
    }

    async getAllPairs() {
        return (await bittrex.getmarketsAsync()).result.map(m => m.MarketName);
    }

    async getTicker(marketName) {
        const ticker = await bittrex.gettickerAsync({market: marketName})
        if (!ticker.result) throw new Error(ticker.message);
        return ticker.result;
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

    /**
     * NO MARKET ORDERS ON BITTREX. REPLACED BY LIMIT FILL OR KILL
     * @param {*} pair 
     * @param {*} rate 
     * @param {*} qty 
     */
    async buyMarket(pair, rate, qty) {
        
        const buyOrder = await bittrex.tradebuyAsync({
                MarketName: pair,
                OrderType: 'LIMIT',
                Quantity: qty,
                Rate: rate,
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

    /**
     * NO MARKET ORDERS ON BITTREX. REPLACED BY LIMIT FILL OR KILL
     * @param {*} pair 
     * @param {*} rate 
     * @param {*} qty 
     */
    async sellMarket(pair, rate, qty) {

        const sellOrder = await bittrex.tradesellAsync({
                MarketName: pair,
                OrderType: 'LIMIT',
                Quantity: qty,
                Rate: rate, //this is the ask when profit calculation was made
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