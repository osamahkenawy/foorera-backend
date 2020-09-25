const Queue = require('bull')
const redis = require('./redisConfig')
const moment = require('moment-timezone')
const Amplitude = require('amplitude')
const env = process.env.NODE_ENV || 'development'
const config = require('../config/config.json')[env]

const AmplitudeEventsQueue = new Queue('Log Amplitude Events', { redis })

AmplitudeEventsQueue.process((job, done) => {
	const { type, transaction, driverId, riderId, rideRiderId, rideId } = job.data
	if ( ! transation || ! type) {
		done()
		return
	}

	const amplitude = new Amplitude(config.amplitudeApiKey, { user_id: transaction.userId })

	amplitude.logEvent({
		event_type: 'Transaction Completed',
		event_properties: {
			'Ride ID': rideId,
			'Rider ID': riderId,
			'Driver ID': driverId,
			'Amount': transaction.amount,
			'Type': type,
			'Creation Date': moment().unix(transaction.creationDate).tz('Africa/Cairo').format('YYYY-MM-DD HH:mm:ss'),
		}
	}).then(function(result) {
		done(null, result)
	}).catch(err => {
		done(err)
	})
})

module.exports = AmplitudeEventsQueue