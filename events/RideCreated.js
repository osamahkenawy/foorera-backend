
const { CheckRideAlertsQueue } = require('../queues')

module.exports = (ride, type) => {
	CheckRideAlertsQueue.add({ ride, type })
}
