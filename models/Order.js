module.exports = class Order {

    constructor(marketName, orderType, quantity, rate, timeInEffect, condition, target) {
        this.marketName = marketName;
        this.orderType = orderType;
        this.quantity = quantity;
        this.rate = rate;
        this.timeInEffect = timeInEffect;
        this.condition = condition || Order.CONDITIONS.NONE;
        this.target = target || 0;

        this.state;
        this.quantityRemaining;

        //Validate order and throw exception
    }

    set isOpen(isOpen) {
        this.isOpen = isOpen;
    }

    static get ORDER_TYPES() {
        return {MARKET: 1, LIMIT: 2, CONDITIONAL: 3}
    }

    static get ORDER_TYPES_MAP() {
        return {1: 'MARKET', 2: 'LIMIT', 3: 'CONDITIONAL'}
    }

    static get TIME_IN_EFFECT_TYPES() {
        return {IMMEDIATE_OR_CANCEL: 1, GOOD_TIL_CANCELLED: 2, FILL_OR_KILL: 3}
    }

    static get TIME_IN_EFFECT_MAP() {
        return {1: 'IMMEDIATE_OR_CANCEL', 2: 'GOOD_TIL_CANCELLED', 3: 'FILL_OR_KILL'}
    }

    static get CONDITIONS() {
        return {NONE: 0, GREATER_THAN: 1, LESS_THAN: 2}
    }

    static get CONDITIONS_MAP() {
        return {0: 'NONE', 1: 'GREATER_THAN', 2: 'LESS_THAN'}
    }

    static get STATES() {
        return {OPEN: 0, PARTIALLY_FILLED: 1, FILLED: 2, CANCELED: 3, CLOSED: 4}
    }

    static get STATES_MAP() {
        return {0: 'OPEN', 1: 'PARTIALLY_FILLED', 2: 'FILLED'}
    }

}