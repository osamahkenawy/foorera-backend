const events = require('events')
const emitter = new events.EventEmitter()

const RideCreatedListener = require('./RideCreated')
const TransactionCompletedListener = require('./TransactionCompleted')
const RideAlertCreatedListener = require('./RideAlertCreated')

emitter.on('RideCreated', RideCreatedListener)
emitter.on('TransactionCompleted', TransactionCompletedListener)
emitter.on('RideAlertCreated', RideAlertCreatedListener)

module.exports = {
	eventEmitter: emitter,
}