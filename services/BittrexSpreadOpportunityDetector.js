const _ = require('lodash');
const BittrexExchangeService = require('./BittrexExchangeService');

module.exports = class BittrexSpreadOpportunityDetector {
    
    constructor(ticksEventEmitter) {
        this.bittrexExchangeService = new BittrexExchangeService();
    }
    
    /**
     * Checks if spread > X %
     */
    async detectSpreadOpportunity(pair) {
        
        let ticker;

        try {
            ticker = await this.bittrexExchangeService.getTicker(pair);
        } catch (ex) {
            return null;
        }
        
        const spread = ticker.Ask - ticker.Bid;
        const spreadPercentage = (spread / ticker.Ask) * 100;
        const buyAt = ticker.Bid + (spread * 0.05);
        const sellAt = ticker.Ask - (spread * 0.05);

        const grossProfitPercentage = ( (sellAt - buyAt) / buyAt ) * 100;
        const netProfitPercentage = grossProfitPercentage - CONFIG.BITTREX_SPREAD_EATER_PERCENTAGE_FEE;

        const qtyToBuy = CONFIG.MIN_QTY_TO_TRADE[pair];

         //TODO calculate profit to make
        if (netProfitPercentage >= CONFIG.MIN_NET_PROFIT_PERCENTAGE) {
            if (CONFIG.IS_DETECTOR_LOG_ACTIVE) console.log(
                `---------- [${pair}] Spread=${spreadPercentage.toFixed(4)}% (WORKER#${WORKER_ID}) --------- \n`+
                `Bid=${ticker.Bid.toFixed(10)}, Ask=${ticker.Ask.toFixed(10)} \n`+
                `BuyAt=${buyAt.toFixed(10)}, SellAt=${sellAt.toFixed(10)} \n`+
                `Profit=${netProfitPercentage.toFixed(4)}% \n`);            
        
                const opportunity = {
                    timestamp: Date.now(), 
                    pair: pair,
                    spreadPercentage: spreadPercentage, 
                    buyAt: buyAt, //used for logs
                    sellAt: sellAt, //used for logs
                    buyRate: buyAt,
                    sellRate: sellAt,
                    qtyToBuy: qtyToBuy,
                    grossProfitPercentage: grossProfitPercentage,
                    netProfitPercentage: netProfitPercentage,
                }

                return opportunity;
        }

        return null;
    }

    
}


       