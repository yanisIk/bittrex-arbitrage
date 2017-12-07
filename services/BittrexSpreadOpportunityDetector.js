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
        const midSpread = spread / 2;
        
        const grossProfitPercentage = spreadPercentage;
        const minProfitPercentage = ( (midSpread - midSpread) / midSpread ) * 100;
        const netProfitPercentage = grossProfitPercentage - CONFIG.BITTREX_SPREAD_EATER_PERCENTAGE_FEE;

        const qtyToBuy = CONFIG.MIN_QTY_TO_TRADE[pair];

        if (netProfitPercentage >= CONFIG.MIN_NET_PROFIT_PERCENTAGE) {
           
                const opportunity = {
                    timestamp: Date.now(), 
                    pair: pair,
                    spread: spread,
                    midSpread: midSpread,
                    spreadPercentage: spreadPercentage, 
                    bid: ticker.Bid,
                    ask: ticker.Ask,
                    qtyToBuy: qtyToBuy,
                    grossProfitPercentage: grossProfitPercentage,
                    netProfitPercentage: netProfitPercentage,
                }

                if (CONFIG.IS_DETECTOR_LOG_ACTIVE)
                    console.log(
                    `---------- [${opportunity.pair}] Spread=${opportunity.spreadPercentage.toFixed(4)}% (WORKER#${WORKER_ID}) --------- \n`+
                    `Bid=${ticker.Bid.toFixed(10)}, MidSpread=${opportunity.midSpread.toFixed(10)} Ask=${ticker.Ask.toFixed(10)} \n`+
                    `                   Profit=${opportunity.netProfitPercentage.toFixed(4)}% \n`);   

                return opportunity;
        }

        return null;
    }

    
}


       