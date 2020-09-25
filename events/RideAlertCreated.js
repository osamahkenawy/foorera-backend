
const { CheckAlertMatchesQueue } = require('../queues')

module.exports = (alert, alertDays, from, to) => {
	CheckAlertMatchesQueue.add({ alert, alertDays, from, to })
}
