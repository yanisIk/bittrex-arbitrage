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
        
        const ticker = await this.bittrexExchangeService.getTicker(pair);
        const spread = ticker.Ask - ticker.Bid;
        const spreadPercentage = (spread / ticker.Ask) * 100;


         //TODO calculate profit to make
        if (spreadPercentage >= 1) {
            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- [${pair}] Spread = ${spreadPercentage.toFixed(4)}% -------------  \n`);            
        }

        return null;

       

    }

    
}


       