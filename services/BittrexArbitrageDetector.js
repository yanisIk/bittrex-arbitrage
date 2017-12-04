const _ = require('lodash');
const BittrexExchangeService = require('./BittrexExchangeService');

module.exports = class BittrexArbitrageDetector {
    
    constructor(ticksEventEmitter) {
        this.bittrexExchangeService = new BittrexExchangeService();
    }
    
    /**
     * BTC -> ETH -> BTC
     * BUY X WITH BTC -> SELL X FOR ETH -> SELL ETH FOR BTC
     */
    async detect_BTC_ETH_Arbitrage(coin) {
        
        let BTC_X_TICKER, ETH_X_TICKER, BTC_ETH_TICKER;
        
        //If one request throws an error, skip the coin and move on
        try {
            [BTC_X_TICKER, ETH_X_TICKER, BTC_ETH_TICKER] = await Promise.all(["BTC-"+coin, "ETH-"+coin, "BTC-ETH"].map(marketName => this.bittrexExchangeService.getTicker(marketName)));            
        } catch (ex) {
            return null;
        }
        
        const BTC_X_BID = BTC_X_TICKER.Bid;
        const BTC_X_ASK = BTC_X_TICKER.Ask;

        const ETH_X_BID = ETH_X_TICKER.Bid;
        const ETH_X_ASK = ETH_X_TICKER.Ask;

        const BTC_ETH_BID = BTC_ETH_TICKER.Bid;
        const BTC_ETH_ASK = BTC_ETH_TICKER.Ask;

        //FORMULA:  COIN1 -> COIN2 -> COIN1
        // if can buy X for COIN1, sell X for COIN2 and get more COIN1 when CONVERTING COIN2 
        // if COIN2 BID converted to COIN1 > value in COIN1 ASK
        // BUY X IN COIN1 -> SELL X IN COIN2 -> BUY/SELL COIN2 IN COIN1         
        //1 UNIT BUY IN COIN1 < 1 UNIT  

        /**
         * BTC -> ETH -> BTC
         * BUY X WITH BTC -> SELL X FOR ETH -> SELL ETH FOR BTC
         */
        if ((ETH_X_BID * BTC_ETH_BID) > BTC_X_ASK) {
            
            const grossPercentageWin = ( ( ( ETH_X_BID * BTC_ETH_BID ) - BTC_X_ASK )  / BTC_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE; 

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- BTC-${coin} -> ETH-${coin} -> BTC-ETH  +${grossPercentageWin.toFixed(4)}% gross  -------------  \n`);

            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["BTC-"+coin];
            const qtyToBuyInBTC = qtyToBuyInCOIN * BTC_X_ASK;

            const grossBTCWin = qtyToBuyInBTC * (grossPercentageWin/100);
            const netBTCWin = qtyToBuyInBTC * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "BTC",
                coin: coin,
                pairToBuy: `BTC-${coin}`,
                pairToSell: `ETH-${coin}`,
                pairToConvert: `BTC-ETH`,
                convertType: `SELL`,
                rateToBuyInBasecoin: BTC_X_ASK,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInBTC,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossBTCWin,
                netBasecoinWin: netBTCWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- BTC-${opportunity.coin} -> ETH-${opportunity.coin} -> BTC-ETH +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`)

            return opportunity;
        }

    }

    /**
     * ETH -> BTC -> ETH
     * BUY X WITH ETH -> SELL X FOR BTC -> BUY ETH WITH BTC
     */
    async detect_ETH_BTC_Arbitrage(coin) {
        
        let BTC_X_TICKER, ETH_X_TICKER, BTC_ETH_TICKER;

        //If one request throws an error, skip the coin and move on
        try {
            [BTC_X_TICKER, ETH_X_TICKER, BTC_ETH_TICKER] = await Promise.all(["BTC-"+coin, "ETH-"+coin, "BTC-ETH"].map(marketName => this.bittrexExchangeService.getTicker(marketName)));            
        } catch (ex) {
            return null;
        }
        
        const BTC_X_BID = BTC_X_TICKER.Bid;
        const BTC_X_ASK = BTC_X_TICKER.Ask;

        const ETH_X_BID = ETH_X_TICKER.Bid;
        const ETH_X_ASK = ETH_X_TICKER.Ask;

        const BTC_ETH_BID = BTC_ETH_TICKER.Bid;
        const BTC_ETH_ASK = BTC_ETH_TICKER.Ask;

        //FORMULA:  COIN1 -> COIN2 -> COIN1
        // if can buy X for COIN1, sell X for COIN2 and get more COIN1 when CONVERTING COIN2 
        // if COIN2 BID converted to COIN1 > value in COIN1 ASK
        // BUY X IN COIN1 -> SELL X IN COIN2 -> BUY/SELL COIN2 IN COIN1         
        //1 UNIT BUY IN COIN1 < 1 UNIT  

        /**
         * ETH -> BTC -> ETH
         * BUY X WITH ETH -> SELL X FOR BTC -> BUY ETH WITH BTC
         */
        if ((BTC_X_BID * BTC_ETH_ASK) > ETH_X_ASK) {
            const grossPercentageWin = ( ( ( BTC_X_BID * BTC_ETH_ASK ) - ETH_X_ASK )  / ETH_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE;

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- ETH-${coin} -> BTC-${coin} -> BTC-ETH  +${grossPercentageWin.toFixed(4)}% gross -------------  \n`);            

            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["ETH-"+coin];
            const qtyToBuyInETH = qtyToBuyInCOIN * ETH_X_ASK;

            const grossETHWin = qtyToBuyInETH * (grossPercentageWin/100);
            const netETHWin = qtyToBuyInETH * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "ETH",
                coin: coin,
                pairToBuy: `ETH-${coin}`,
                pairToSell: `BTC-${coin}`,
                pairToConvert: `BTC-ETH`,
                convertType: `BUY`,
                rateToBuyInBasecoin: ETH_X_ASK,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInETH,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossETHWin,
                netBasecoinWin: netETHWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- ETH-${opportunity.coin} -> BTC-${opportunity.coin} -> BTC-ETH +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`)
            
            //return opportunity;
        }

    }

    /**
     *
     * USDT -> BTC -> USDT
     * BUY X WITH USDT -> SELL X FOR BTC -> SELL BTC FOR USDT
     */
    async detect_USDT_BTC_Arbitrage(coin) {
        
        let USDT_X_TICKER, BTC_X_TICKER, USDT_BTC_TICKER;

        //If one request throws an error, skip the coin and move on
        try {
            [USDT_X_TICKER, BTC_X_TICKER, USDT_BTC_TICKER] = await Promise.all(["USDT-"+coin, "BTC-"+coin, "USDT-BTC"].map(marketName => this.bittrexExchangeService.getTicker(marketName)));            
        } catch (ex) {
            return null;
        }
        
        const USDT_X_BID = USDT_X_TICKER.Bid;
        const USDT_X_ASK = USDT_X_TICKER.Ask;

        const BTC_X_BID = BTC_X_TICKER.Bid;
        const BTC_X_ASK = BTC_X_TICKER.Ask;

        const USDT_BTC_BID = USDT_BTC_TICKER.Bid;
        const USDT_BTC_ASK = USDT_BTC_TICKER.Ask;

        //FORMULA:  COIN1 -> COIN2 -> COIN1
        // if can buy X for COIN1, sell X for COIN2 and get more COIN1 when CONVERTING COIN2 
        // if COIN2 BID converted to COIN1 > value in COIN1 ASK
        // BUY X IN COIN1 -> SELL X IN COIN2 -> BUY/SELL COIN2 IN COIN1         
        //1 UNIT BUY IN COIN1 < 1 UNIT  

        /**
         * TODO
         * USDT -> BTC -> USDT
         * BUY X WITH USDT -> SELL X FOR BTC -> SELL BTC FOR USDT
         */
        if ((BTC_X_BID * USDT_BTC_BID) > USDT_X_ASK) {
            
            const grossPercentageWin = ( ( ( BTC_X_BID * USDT_BTC_BID ) - USDT_X_ASK )  / USDT_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE; 
            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- USDT-${coin} -> BTC-${coin} -> USDT-BTC  +${grossPercentageWin.toFixed(4)}% gross  -------------  \n`);
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["BTC-"+coin];
            const qtyToBuyInUSDT = qtyToBuyInCOIN * USDT_X_ASK;

            const grossUSDTWin = qtyToBuyInUSDT * (grossPercentageWin/100);
            const netUSDTWin = qtyToBuyInUSDT * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "USDT",
                coin: coin,
                pairToBuy: `USDT-${coin}`,
                pairToSell: `BTC-${coin}`,
                pairToConvert: `USDT-BTC`,
                convertType: `SELL`,
                rateToBuyInBasecoin: USDT_X_ASK,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInUSDT,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossUSDTWin,
                netBasecoinWin: netUSDTWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- USDT-${opportunity.coin} -> BTC-${opportunity.coin} -> USDT-BTC +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`);

            //return opportunity;
        }

    }

    /**
     * USDT -> ETH -> USDT
     * BUY X WITH USDT -> SELL X FOR ETH -> SELL ETH FOR USDT
     */
    async detect_USDT_ETH_Arbitrage(coin) {
        
        let USDT_X_TICKER, ETH_X_TICKER, USDT_ETH_TICKER;

        //If one request throws an error, skip the coin and move on
        try {
            [USDT_X_TICKER, ETH_X_TICKER, USDT_ETH_TICKER] = await Promise.all(["USDT-"+coin, "ETH-"+coin, "USDT-ETH"].map(marketName => this.bittrexExchangeService.getTicker(marketName)));            
        } catch (ex) {
            return null;
        }
        
        const USDT_X_BID = USDT_X_TICKER.Bid;
        const USDT_X_ASK = USDT_X_TICKER.Ask;

        const ETH_X_BID = ETH_X_TICKER.Bid;
        const ETH_X_ASK = ETH_X_TICKER.Ask;

        const USDT_ETH_BID = USDT_ETH_TICKER.Bid;
        const USDT_ETH_ASK = USDT_ETH_TICKER.Ask;

        //FORMULA:  COIN1 -> COIN2 -> COIN1
        // if can buy X for COIN1, sell X for COIN2 and get more COIN1 when CONVERTING COIN2 
        // if COIN2 BID converted to COIN1 > value in COIN1 ASK
        // BUY X IN COIN1 -> SELL X IN COIN2 -> BUY/SELL COIN2 IN COIN1         
        //1 UNIT BUY IN COIN1 < 1 UNIT  

        /**
         * TODO
         * USDT -> ETH -> USDT
         * BUY X WITH USDT -> SELL X FOR ETH -> SELL ETH FOR USDT
         */
        if ((ETH_X_BID * USDT_ETH_BID) > USDT_X_ASK) {
            
            const grossPercentageWin = ( ( ( ETH_X_BID * USDT_ETH_BID ) - USDT_X_ASK )  / USDT_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE; 

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- USDT-${coin} -> ETH-${coin} -> USDT-ETH  +${grossPercentageWin.toFixed(4)}% gross  -------------  \n`);            

            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["BTC-"+coin];
            const qtyToBuyInUSDT = qtyToBuyInCOIN * USDT_X_ASK;

            const grossUSDTWin = qtyToBuyInUSDT * (grossPercentageWin/100);
            const netUSDTWin = qtyToBuyInUSDT * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "USDT",
                coin: coin,
                pairToBuy: `USDT-${coin}`,
                pairToSell: `ETH-${coin}`,
                pairToConvert: `USDT-ETH`,
                convertType: `SELL`,
                rateToBuyInBasecoin: USDT_X_ASK,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInUSDT,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossUSDTWin,
                netBasecoinWin: netUSDTWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- ARBITRAGE OPPORTUNITY USDT-${opportunity.coin} -> ETH-${opportunity.coin} -> USDT-ETH  +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`);

            //return opportunity;
        }

    }

    /**
     * 
     * @param {*} coin
     * @returns Opportunity or null 
     */
    detectArbitrageOpportunity(coin) {
        if ( !( this.ticks["BTC-"+coin] && 
                this.ticks["ETH-"+coin] && 
                this.ticks["USDT-"+coin] &&
                this.ticks["BTC-ETH"] &&
                this.ticks["USDT-BTC"] &&
                this.ticks["USDT-ETH"]) ) return;

        //check if same batch
        const numberOfBatchUpdateIds = _.uniqBy([this.ticks["BTC-"+coin], this.ticks["ETH-"+coin], this.ticks["USDT-"+coin], this.ticks["BTC-ETH"],  this.ticks["USDT-BTC"], this.ticks["USDT-ETH"]], 'BatchId');
        if (numberOfBatchUpdateIds.length != 1) {
            console.log(`#WORKER${WORKER_ID} ${coin} NOT SAME BATCH (${numberOfBatchUpdateIds.length} batches)`);
            return;
        }

        const BTC_X_BID = this.ticks["BTC-"+coin].Bid;
        const BTC_X_ASK = this.ticks["BTC-"+coin].Ask;

        const ETH_X_BID = this.ticks["ETH-"+coin].Bid;
        const ETH_X_ASK = this.ticks["ETH-"+coin].Ask;

        const USDT_X_BID = this.ticks["USDT-"+coin].Bid;
        const USDT_X_ASK = this.ticks["USDT-"+coin].Ask;

        const BTC_ETH_BID = this.ticks["BTC-ETH"].Bid;
        const BTC_ETH_ASK = this.ticks["BTC-ETH"].Ask;

        const USDT_BTC_BID = this.ticks["USDT-BTC"].Bid;
        const USDT_BTC_ASK = this.ticks["USDT-BTC"].Ask;

        const USDT_ETH_BID = this.ticks["USDT-ETH"].Bid;
        const USDT_ETH_ASK = this.ticks["USDT-ETH"].Ask;

        //FORMULA:  COIN1 -> COIN2 -> COIN1
        // if can buy X for COIN1, sell X for COIN2 and get more COIN1 when CONVERTING COIN2 
        // if COIN2 BID converted to COIN1 > value in COIN1 ASK
        // BUY X IN COIN1 -> SELL X IN COIN2 -> BUY/SELL COIN2 IN COIN1         
        //1 UNIT BUY IN COIN1 < 1 UNIT  

        /**
         * BTC -> ETH -> BTC
         * BUY X WITH BTC -> SELL X FOR ETH -> SELL ETH FOR BTC
         */
        if ((ETH_X_BID * BTC_ETH_BID) > BTC_X_ASK) {
            
            const grossPercentageWin = ( ( ( ETH_X_BID * BTC_ETH_BID ) - BTC_X_ASK )  / BTC_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE; 

            //if (CONFIG.IS_LOG_ACTIVE) console.log(`\n ---------- BTC-${coin} -> ETH-${coin} -> BTC-ETH  +${netPercentageWin.toFixed(4)}%   -------------  \n`);

            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["BTC-"+coin];
            const qtyToBuyInBTC = qtyToBuyInCOIN * BTC_X_ASK;

            const grossBTCWin = qtyToBuyInBTC * (grossPercentageWin/100);
            const netBTCWin = qtyToBuyInBTC * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "BTC",
                coin: coin,
                pairToBuy: `BTC-${coin}`,
                pairToSell: `ETH-${coin}`,
                pairToConvert: `BTC-ETH`,
                convertType: `SELL`,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInBTC,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossBTCWin,
                netBasecoinWin: netBTCWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n ---------- BTC-${opportunity.coin} -> ETH-${opportunity.coin} -> BTC-ETH +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`)
            // if (IS_LOG_ACTIVE) console.log(`BTC-${coin}  ASK: ${BTC_X_ASK.Quantity} ${coin} @ ${BTC_X_ASK.toFixed(8)} BTC/${coin}   (Max Qty: ${maxQuantityToBuyInBtc.toFixed(5)} BTC) (Type: ${BTC_X_ASK.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`ETH-${coin}  BID: ${ETH_X_BID.Quantity} ${coin} @ ${ETH_X_BID.toFixed(8)} ETH/${coin}   (Max Qty: ${maxQuantityToSellInEth.toFixed(5)} ETH) (Type: ${ETH_X_BID.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`BTC-ETH  ASK: ${BTC_ETH_ASK.Quantity} BTC @ ${BTC_ETH_ASK.toFixed(8)} BTC/ETH     (Max Qty: ${maxEthToSell.toFixed(5)} ETH) (Type: ${BTC_ETH_ASK.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`Potential Max Benefit:              ${maxPotentialWinInBtc.toFixed(5)} BTC`);
            // if (IS_LOG_ACTIVE) console.log(`Potential Benefit With ${MAX_BTC_TO_BUY} BTC:   ${maxPotentialWinWithMAX_BTC_TO_BUY.toFixed(5)} BTC`);
            // if (IS_LOG_ACTIVE) console.log("\n");

            //return opportunity;
        }

        /**
         * BTC -> USDT -> BTC
         * BUY X WITH BTC -> SELL X FOR USDT -> BUY BTC WITH USDT
         */
        if ((USDT_X_BID * USDT_BTC_BID) > BTC_X_ASK) {
            
            const grossPercentageWin = ( ( ( ETH_X_BID * BTC_ETH_BID ) - BTC_X_ASK )  / BTC_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE; 

            //if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- BTC-${coin} -> ETH-${coin} -> BTC-ETH  +${netPercentageWin.toFixed(4)}%   -------------  \n`);

            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["BTC-"+coin];
            const qtyToBuyInBTC = qtyToBuyInCOIN * BTC_X_ASK;

            const grossBTCWin = qtyToBuyInBTC * (grossPercentageWin/100);
            const netBTCWin = qtyToBuyInBTC * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "BTC",
                coin: coin,
                pairToBuy: `BTC-${coin}`,
                pairToSell: `ETH-${coin}`,
                pairToConvert: `BTC-ETH`,
                convertType: `SELL`,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInBTC,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossBTCWin,
                netBasecoinWin: netBTCWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- BTC-${opportunity.coin} -> ETH-${opportunity.coin} -> BTC-ETH +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`)
            // if (IS_LOG_ACTIVE) console.log(`BTC-${coin}  ASK: ${BTC_X_ASK.Quantity} ${coin} @ ${BTC_X_ASK.toFixed(8)} BTC/${coin}   (Max Qty: ${maxQuantityToBuyInBtc.toFixed(5)} BTC) (Type: ${BTC_X_ASK.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`ETH-${coin}  BID: ${ETH_X_BID.Quantity} ${coin} @ ${ETH_X_BID.toFixed(8)} ETH/${coin}   (Max Qty: ${maxQuantityToSellInEth.toFixed(5)} ETH) (Type: ${ETH_X_BID.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`BTC-ETH  ASK: ${BTC_ETH_ASK.Quantity} BTC @ ${BTC_ETH_ASK.toFixed(8)} BTC/ETH     (Max Qty: ${maxEthToSell.toFixed(5)} ETH) (Type: ${BTC_ETH_ASK.Type})`);
            // if (IS_LOG_ACTIVE) console.log(`Potential Max Benefit:              ${maxPotentialWinInBtc.toFixed(5)} BTC`);
            // if (IS_LOG_ACTIVE) console.log(`Potential Benefit With ${MAX_BTC_TO_BUY} BTC:   ${maxPotentialWinWithMAX_BTC_TO_BUY.toFixed(5)} BTC`);
            // if (IS_LOG_ACTIVE) console.log("\n");

            //return opportunity;
        }

 
        /**
         * ETH -> BTC -> ETH
         * BUY X WITH ETH -> SELL X FOR BTC -> BUY ETH WITH BTC
         */
        if ((BTC_X_BID * BTC_ETH_ASK) > ETH_X_ASK) {
            const grossPercentageWin = ( ( ( BTC_X_BID * BTC_ETH_ASK ) - ETH_X_ASK )  / ETH_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE;

            //if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- ETH-${coin} -> BTC-${coin} -> BTC-ETH  +${netPercentageWin.toFixed(4)}%  -------------  \n`);            

            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["ETH-"+coin];
            const qtyToBuyInETH = qtyToBuyInCOIN * ETH_X_ASK;

            const grossETHWin = qtyToBuyInETH * (grossPercentageWin/100);
            const netETHWin = qtyToBuyInETH * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "ETH",
                coin: coin,
                pairToBuy: `ETH-${coin}`,
                pairToSell: `BTC-${coin}`,
                pairToConvert: `BTC-ETH`,
                convertType: `BUY`,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInETH,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossETHWin,
                netBasecoinWin: netETHWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- ETH-${opportunity.coin} -> BTC-${opportunity.coin} -> BTC-ETH +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`)
            
            //return opportunity;
        }

        
        /**
         * TODO
         * USDT -> BTC -> USDT
         * BUY X WITH USDT -> SELL X FOR BTC -> SELL BTC FOR USDT
         */
        if ((BTC_X_BID * USDT_BTC_BID) > USDT_X_ASK) {
            
            const grossPercentageWin = ( ( ( BTC_X_BID * USDT_BTC_BID ) - USDT_X_ASK )  / USDT_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE; 
            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- USDT-${coin} -> BTC-${coin} -> USDT-BTC  +${netPercentageWin.toFixed(4)}%  -------------  \n`);
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["BTC-"+coin];
            const qtyToBuyInUSDT = qtyToBuyInCOIN * USDT_X_ASK;

            const grossUSDTWin = qtyToBuyInUSDT * (grossPercentageWin/100);
            const netUSDTWin = qtyToBuyInUSDT * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "USDT",
                coin: coin,
                pairToBuy: `USDT-${coin}`,
                pairToSell: `BTC-${coin}`,
                pairToConvert: `USDT-BTC`,
                convertType: `SELL`,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInUSDT,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossUSDTWin,
                netBasecoinWin: netUSDTWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- USDT-${opportunity.coin} -> BTC-${opportunity.coin} -> USDT-BTC +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`);

            //return opportunity;
        }

        /**
         * TODO
         * USDT -> ETH -> USDT
         * BUY X WITH USDT -> SELL X FOR ETH -> SELL ETH FOR USDT
         */
        if ((ETH_X_BID * USDT_ETH_BID) > USDT_X_ASK) {
            
            const grossPercentageWin = ( ( ( ETH_X_BID * USDT_ETH_BID ) - USDT_X_ASK )  / USDT_X_ASK ) * 100;
            const netPercentageWin = grossPercentageWin - CONFIG.BITTREX_TRIANGULAR_ARBITRAGE_PERCENTAGE_FEE; 

            //if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- ARBITRAGE OPPORTUNITY USDT-${coin} -> ETH-${coin} -> USDT-ETH   +${netPercentageWin.toFixed(4)}%   -------------  \n`);            

            if (netPercentageWin < CONFIG.MIN_NET_PROFIT_PERCENTAGE) return;
            
            //Calculate quantity to buy
            const qtyToBuyInCOIN = CONFIG.MIN_QTY_TO_BUY["BTC-"+coin];
            const qtyToBuyInUSDT = qtyToBuyInCOIN * USDT_X_ASK;

            const grossUSDTWin = qtyToBuyInUSDT * (grossPercentageWin/100);
            const netUSDTWin = qtyToBuyInUSDT * (netPercentageWin/100);

            const opportunity = {
                id: Date.now(), 
                baseCoin: "USDT",
                coin: coin,
                pairToBuy: `USDT-${coin}`,
                pairToSell: `ETH-${coin}`,
                pairToConvert: `USDT-ETH`,
                convertType: `SELL`,
                qtyToBuyInCOIN: qtyToBuyInCOIN,
                qtyToBuyInBasecoin: qtyToBuyInUSDT,
                grossPercentageWin: grossPercentageWin,
                netPercentageWin: netPercentageWin,
                grossBasecoinWin: grossUSDTWin,
                netBasecoinWin: netUSDTWin
            }

            if (CONFIG.IS_LOG_ACTIVE) console.log(`\n WORKER#${WORKER_ID} : ---------- ARBITRAGE OPPORTUNITY USDT-${opportunity.coin} -> ETH-${opportunity.coin} -> USDT-ETH  +${opportunity.netPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`);

            //return opportunity;
        }

        return null;
    }
}


       