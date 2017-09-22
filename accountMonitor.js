const SETTINGS = require("./dropCatcherSettings.json")

class AccountMonitor {
    constructor() {
        this.wallet = {};
        SETTINGS.ALL_BITTREX_PAIRS.forEach()
    }

    decrease(coin, quantity) {
        
                if (quantity > this.wallet[coin])
                    throw new Error(`Cannot decrease more BTC (${quantity}) more than Balance (${this.balance})`)
                this.btcBalance = this.btcBalance - quantity;
             
        }
    }
}