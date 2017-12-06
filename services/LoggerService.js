const async = require("async");

module.exports = class LoggerService {

    constructor() {
        this._init();
    }

    _init() {
        
        this._logsCargo = async.cargo(async (opportunities, cb) => {
            //TODO Create batch (mongo bulk unordered)
            //Push it to updateQueue
            cb();
        }, CONFIG.LOGS_CARGO_SIZE);
        
        this._updateQueue = async.queue(async (batch, cb) => {
            //TODO upsert in mongo with _id = opportunity.timestamp
            cb();
        }, 1);
    }

    createOrUpdateOpportunity() {

    }
}