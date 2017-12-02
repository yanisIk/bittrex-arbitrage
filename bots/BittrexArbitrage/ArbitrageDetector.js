detectArbitrageOpportunity(coin) {
    if ( (this.ticks["BTC-"+coin] && this.ticks["ETH-"+coin] && this.ticks["BTC-ETH"]) === false) return;

    BTC_X_BID = this.ticks["BTC-"+coin].Bid;
    BTC_X_ASK = this.ticks["BTC-"+coin].Ask;

    ETH_X_BID = this.ticks["ETH-"+coin].Bid;
    ETH_X_ASK = this.ticks["ETH-"+coin].Ask;

    BTC_ETH_BID = this.ticks["BTC-ETH"].Bid;
    BTC_ETH_ASK = this.ticks["BTC-ETH"].Ask;

    //Check if buy with bitcoin (if can buy in btc, sell in eth and convert eth in btc with profit)
    // if [ETH-X]bid * [BTC-ETH]bid  > [BTC-X]ask 
    if ((ETH_X_BID * BTC_ETH_BID) > BTC_X_ASK) {
        // ( ( [ETH-X]bid * [BTC-ETH]bid ) - [BTC-X]ask ) / [BTC-X]ask
        // X sold for 2 ETH, 2 ETH sold for 600 BTC vs X sold for 500 BTC 
        let potentialPercentageWin = ( ( ( ETH_X_BID * BTC_ETH_BID ) - BTC_X_ASK )  / BTC_X_ASK ) * 100;
        if (potentialPercentageWin < CONFIG.MIN_PROFIT_PERCENTAGE) return;

        //Calculate quantity to buy
        let qtyToBuyInCOIN = MIN_QTY_TO_BUY["BTC-"+coin];
        let qtyToBuyInBTC = qtyToBuyInCOIN * BTC_X_ASK;

        let potentialBTCWin = qtyToBuyInBTC * (potentialPercentageWin/100);

        const opportunity = {
            id: Date.now(), 
            baseCoin: "BTC",
            coin: coin,
            qtyToBuyInCOIN: qtyToBuyInCOIN,
            qtyToBuyInBTC: qtyToBuyInBTC,
            potentialPercentageWin: potentialPercentageWin,
            potentialBTCWin: potentialBTCWin
        }

        if (CONFIG.IS_LOG_ACTIVE) console.log(`\n ---------- ARBITRAGE OPPORTUNITY BTC-${opportunity.coin} +${opportunity.potentialPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`)
        // if (IS_LOG_ACTIVE) console.log(`BUY ${coin} IN BTC SELL IN ETH WITH A POTENTIAL OF:    +${potentialPercentageWin.toFixed(4)} %`)
        // if (IS_LOG_ACTIVE) console.log(`BTC-${coin}  ASK: ${BTC_X_ASK.Quantity} ${coin} @ ${BTC_X_ASK.toFixed(8)} BTC/${coin}   (Max Qty: ${maxQuantityToBuyInBtc.toFixed(5)} BTC) (Type: ${BTC_X_ASK.Type})`);
        // if (IS_LOG_ACTIVE) console.log(`ETH-${coin}  BID: ${ETH_X_BID.Quantity} ${coin} @ ${ETH_X_BID.toFixed(8)} ETH/${coin}   (Max Qty: ${maxQuantityToSellInEth.toFixed(5)} ETH) (Type: ${ETH_X_BID.Type})`);
        // if (IS_LOG_ACTIVE) console.log(`BTC-ETH  ASK: ${BTC_ETH_ASK.Quantity} BTC @ ${BTC_ETH_ASK.toFixed(8)} BTC/ETH     (Max Qty: ${maxEthToSell.toFixed(5)} ETH) (Type: ${BTC_ETH_ASK.Type})`);
        // if (IS_LOG_ACTIVE) console.log(`Potential Max Benefit:              ${maxPotentialWinInBtc.toFixed(5)} BTC`);
        // if (IS_LOG_ACTIVE) console.log(`Potential Benefit With ${MAX_BTC_TO_BUY} BTC:   ${maxPotentialWinWithMAX_BTC_TO_BUY.toFixed(5)} BTC`);
        // if (IS_LOG_ACTIVE) console.log("\n");

        return opportunity;
    }

    //Check if buy with eth
    if ((BTC_X_BID.Rate * BTC_ETH_BID.Rate) > ETH_X_ASK.Rate) {
        var potentialPercentageWin = ( ( ( BTC_X_BID.Rate * BTC_ETH_BID.Rate ) - ETH_X_ASK.Rate )  / ETH_X_ASK.Rate ) * 100;
        if (potentialPercentageWin < CONFIG.MIN_PROFIT_PERCENTAGE) return;
        
        //Calculate quantity to buy
        let qtyToBuyInCOIN = MIN_QTY_TO_BUY["ETH-"+coin];
        let qtyToBuyInETH = qtyToBuyInCOIN * ETH_X_ASK;

        let potentialETHWin = qtyToBuyInETH * (potentialPercentageWin/100);

        const opportunity = {
            id: Date.now(), 
            baseCoin: "ETH",
            coin: coin,
            qtyToBuyInCOIN: qtyToBuyInCOIN,
            qtyToBuyInETH: qtyToBuyInETH,
            potentialPercentageWin: potentialPercentageWin,
            potentialETHWin: potentialETHWin
        }

        if (CONFIG.IS_LOG_ACTIVE) console.log(`\n ---------- ARBITRAGE OPPORTUNITY ETH-${opportunity.coin} +${opportunity.potentialPercentageWin.toFixed(4)}%  (ID: ${opportunity.id}) -------------  \n`)
        
        return opportunity;
    }

    return null;
}