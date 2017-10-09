const bittrex = require('node-bittrex-api');
bittrex.options({
  'apikey' : SETTINGS.API_KEY,
  'apisecret' : SETTINGS.API_SECRET,
  'verbose' : false,
  'inverse_callback_arguments' : true
});
const EventEmitter = require('events');

export default class BittrexExchangeService {

    constructor() {
        
    }

    buyLimitUntilCanceled(rate, qty) {
        
    }

    buyLimitImmediateOrCancel() {

    }

    buyMarket() {

    }

    sellLimitUntilCanceled(rate, qty) {
        
    }

    sellLimitImmediateOrCancel() {

    }

    sellMarket() {

    }

}