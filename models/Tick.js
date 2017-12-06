module.exports = class Tick {

    constructor(bid, ask, last, timestamp) {
        this.bid = bid;
        this.ask = ask;
        this.timestamp = timestamp;

        //Validate tick or throw exception
    }
}