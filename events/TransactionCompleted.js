
const { AmplitudeEventsQueue } = require('../queues')

module.exports = (type, transaction, driverId, riderId, rideRiderId, rideId) => {
	AmplitudeEventsQueue.add({ type, transaction, driverId, riderId, rideRiderId, rideId })
}
