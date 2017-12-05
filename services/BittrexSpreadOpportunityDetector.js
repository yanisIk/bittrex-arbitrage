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
        const buyAt = ticker.Bid + (ticker.Bid * 0.005);
        const sellAt = ticker.Ask - (ticker.Ask * 0.005);
        const grossProfitPercentage = ( (sellAt - buyAt) / buyAt ) * 100;
        const netProfitPercentage = grossProfitPercentage - CONFIG.SPREAD_EATER_BITTREX_PERCENTAGE_FEE;


         //TODO calculate profit to make
        if (spreadPercentage >= 2) {
            if (CONFIG.IS_LOG_ACTIVE) console.log(
                `---------- [${pair}] Spread=${spreadPercentage.toFixed(4)}% (WORKER#${WORKER_ID})--------- \n`+
                `Bid=${ticker.Bid}, Ask=${ticker.Ask} \n`+
                `BuyAt=${buyAt}, SellAt=${sellAt} \n`+
                `Profit=${grossProfitPercentage}% \n`);            
        }

        return null;

       

    }

    
}


       