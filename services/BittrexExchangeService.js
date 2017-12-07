const Promise = require("bluebird");

const CONFIG = require("./../configs/BITTREX_ARBITRAGE.json");

const bittrex = Promise.promisifyAll(require('node-bittrex-api'));
bittrex.options({
  'apikey' : CONFIG.API_KEY,
  'apisecret' : CONFIG.API_SECRET,
  'verbose' : false,
  'inverse_callback_arguments' : true
});

const async = require('async');
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

        this.openOrders = new Map();
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

    async getMarketSummaries() {
        return (await bittrex.getmarketsummariesAsync()).result;
    }

    async getAllPairs() {
        return (await bittrex.getmarketsAsync()).result.map(m => m.MarketName);
    }

    async getTicker(marketName) {
        const ticker = await bittrex.gettickerAsync({market: marketName})
        if (!ticker.result) throw new Error(ticker.message);
        return ticker.result;
    }

    async getOrderBook(marketName) {
        const orderBook = await bittrex.getorderbookAsync({market: marketName, type: 'both'})
        if (!orderBook.result) throw new Error(orderBook.message);
        return orderBook.result;
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
            const buyOrderStatus = await this.getOrder(buyOrder.result.uuid);
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
            const buyOrderStatus = await this.getOrder(buyOrder.result.uuid);
            if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", buyOrderStatus);
            if (buyOrderStatus.success) {
                buyOrderStatus.result.QuantityBought = buyOrderStatus.result.Quantity - buyOrderStatus.result.QuantityRemaining;
                return buyOrderStatus.result;
            }
            throw new Error(buyOrderStatus.message);

    }

    async buyLimitFillOrKill(pair, rate, qty) {
        
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
        const buyOrderStatus = await this.getOrder(buyOrder.result.uuid);
        if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", buyOrderStatus);
        if (buyOrderStatus.success) {
            buyOrderStatus.result.QuantityBought = buyOrderStatus.result.Quantity - buyOrderStatus.result.QuantityRemaining;
            return buyOrderStatus.result;
        }
        throw new Error(buyOrderStatus.message);

    }

    async buyConditional(pair, qty, condition, target) {
        const buyOrder = await bittrex.tradebuyAsync({
            MarketName: pair,
            OrderType: 'CONDITIONAL',
            Quantity: target,
            Rate: rate,
            TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
            ConditionType: condition, // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
            Target: target, // used in conjunction with ConditionType
        });
        if (!buyOrder.success) throw new Error(buyOrder.message);
        const buyOrderStatus = await this.getOrder(buyOrder.result.uuid);
        if (CONFIG.IS_LOG_ACTIVE) console.log("BUY CONDITIONAL ORDER RESPONSE:", buyOrderStatus);
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
            const sellOrderStatus = await this.getOrder(sellOrder.result.uuid);
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
        const sellOrderStatus = await this.getOrder(sellOrder.result.uuid);
        if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", sellOrderStatus);
        if (sellOrderStatus.success) {
            sellOrderStatus.result.QuantitySold = sellOrderStatus.result.Quantity - sellOrderStatus.result.QuantityRemaining;
            return sellOrderStatus.result;
        }
        throw new Error(sellOrderStatus.message);
    }

    async sellLimitFillOrKill(pair, rate, qty) {

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
        const sellOrderStatus = await this.getOrder(sellOrder.result.uuid);
        if (CONFIG.IS_LOG_ACTIVE) console.log("SELL MARKET ORDER RESPONSE:", sellOrderStatus);
        if (sellOrderStatus.success) {
            sellOrderStatus.result.QuantitySold = sellOrderStatus.result.Quantity - sellOrderStatus.result.QuantityRemaining;
            return sellOrderStatus.result;
        }
        throw new Error(sellOrderStatus.message);
    }

    async sellConditional(pair, qty, condition, target) {
        const sellOrder = await bittrex.tradesellAsync({
            MarketName: pair,
            OrderType: 'CONDITIONAL',
            Quantity: qty,
            Rate: target,
            TimeInEffect: 'GOOD_TIL_CANCELLED', // supported options are 'IMMEDIATE_OR_CANCEL', 'GOOD_TIL_CANCELLED', 'FILL_OR_KILL'
            ConditionType: condition, // supported options are 'NONE', 'GREATER_THAN', 'LESS_THAN'
            Target: target, // used in conjunction with ConditionType
        });
        if (!sellOrder.success) throw new Error(sellOrder.message);
        const sellOrderStatus = await this.getOrder(sellOrder.result.uuid);
        if (CONFIG.IS_LOG_ACTIVE) console.log("SELL CONDITIONAL ORDER RESPONSE:", sellOrderStatus);
        if (sellOrderStatus.success) {
            sellOrderStatus.result.QuantityBought = sellOrderStatus.result.Quantity - sellOrderStatus.result.QuantityRemaining;
            return sellOrderStatus.result;
        }
        throw new Error(sellOrderStatus.message);
    }

    /**
     * Get the order and doesn't return it until it's closed (multiple retries)
     * 
     * @param {*} orderId 
     * @param {*} retries
     * @param {*} intervalInMs
     */
    cancelOrder(orderId, retries = 5, intervalInMs = 2) {
        
        const cancelOrder = async () => {
            const cancelResponse = await this.cancelOrder(orderId);
            const orderStatus = await this.getOrder(orderId);
            if (orderStatus.CancelInitiated) return await this.getClosedOrder(orderId, 30, 100);
            throw new Error("Order Not Canceled");
        }

        return new Promise((resolve, reject) => {
            async.retry({times: retries, interval: intervalInMs}, cancelOrder, (err, order) => {
                if (err) return reject(err);
                return resolve(order);
            })
        });

    }

    async getOrder(orderId, retries = 5, intervalInMs = 1) {
        
        const getOrder = async () => {
            const order = await bittrex.getorderAsync({uuid: orderId});
            if (CONFIG.IS_LOG_ACTIVE) console.log("GET ORDER RESPONSE:", order);
            if (order.success) return order.result;
            throw new Error(order.message);
        }

        return new Promise((resolve, reject) => {
            async.retry({times: retries, interval: intervalInMs}, getOrder, (err, order) => {
                if (err) return reject(err);
                return resolve(order);
            })
        });
                
    }

    /**
     * Get the order and doesn't return it until it's closed (recursive call)
     * 5 trials
     * @param {*} orderId 
     * @param {*} retries
     * @param {*} intervalInMs
     */
    getClosedOrder(orderId, retries = 5, intervalInMs = 5) {
        
        const getClosedOrders = async () => {
            const order = await this.getOrder(orderId);
            if (order.isOpen === false) return order; 
            throw new Error("Order Not Closed Yet");
        }

        return new Promise((resolve, reject) => {
            async.retry({times: retries, interval: intervalInMs}, getClosedOrders, (err, order) => {
                if (err) return reject(err);
                return resolve(order);
            });
        });
    }

}