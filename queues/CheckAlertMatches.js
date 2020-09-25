const Queue = require('bull')
const redis = require('./redisConfig')
const { Sequelize, sequelize, AlertMatch } = require('../models')
const { getWeekDayIndex, sendOneSignalNotification, createNotification } = require('../tools/tools')
const moment = require('moment-timezone')
const _ = require('lodash')

const CheckAlertMatchesQueue = new Queue('Check Alert Matches', { redis })

CheckAlertMatchesQueue.process((job, done) => {
	const { alert, alertDays, from, to } = job.data
	if ( ! alert || ! alertDays) {
		done()
		return
	}

	const maxSearchDistance = 2.5
	const dateTime = (new Date()).getTime()

	// Check for ride matching this ride
	const query = `(SELECT RegularRide.id, 'regular' as type FROM RegularRide
			
			INNER JOIN Locations lfrom ON lfrom.id = RegularRide.from
				AND dist(lfrom.lat, lfrom.lng, ${from.lat}, ${from.lng} ) <= ${maxSearchDistance}
			
			INNER JOIN Locations lto ON lto.id = RegularRide.to
				AND dist(lto.lat, lto.lng, ${to.lat}, ${to.lng} ) <= ${maxSearchDistance}

			INNER JOIN RegularRideDays rrd ON rrd.regularRideId = RegularRide.id
				AND rrd.day IN (${alertDays.join(',')})

			WHERE RegularRide.driver != '${alert.userId}' AND RegularRide.status = 'verified')

			UNION

			(SELECT Rides.id, 'normal' as type FROM Rides
			
			INNER JOIN Locations lfrom ON lfrom.id = Rides.from
				AND dist(lfrom.lat, lfrom.lng, ${from.lat}, ${from.lng} ) <= ${maxSearchDistance}
			
			INNER JOIN Locations lto ON lto.id = Rides.to
				AND dist(lto.lat, lto.lng, ${to.lat}, ${to.lng} ) <= ${maxSearchDistance}

			WHERE Rides.driver != '${alert.userId}' AND Rides.regularRideId IS NULL
				AND Rides.dateTime > ${dateTime})
		`

	sequelize.query(query, { type: Sequelize.QueryTypes.SELECT }).then(rides => {
		if ( ! rides) {
			done()
			return
		}

		const alertMatches = [];

		_.uniqBy(rides, 'id').forEach(ride => {
			if (ride.type === 'normal') {
				const weekDay = getWeekDayIndex(ride.date)
				if (alertDays.indexOf(weekDay) === -1) {
					return
				}
			}
			// Create alert match entry
			alertMatches.push({
				ride_id: ride.id,
				ride_type: ride.type,
				ride_alert_id: alert.id,
			})
		})

		if (alertMatches.length > 0) {
			AlertMatch.bulkCreate(alertMatches).then(res => {}).catch(err => {})

			const notificationMsg = `There are already ${alertMatches.length} rides matching your ride alert from: ${from.englishName} to: ${to.englishName}`
            const pushNotificationMsg = `There are already ${alertMatches.length} rides matching your ride alert from: ${from.englishName} to: ${to.englishName}`
            const data = {
              type: 'alert_match',
              title: 'Rides matching your alert',
              message: notificationMsg,
              from,
              to,
              count: alertMatches.length,
              userId: alert.userId,
              alerId: alert.id,
            }

            // Create notification
            createNotification(null, data.message, 0, null, alert.userId, alert.id, { from, to, count: alertMatches.length })

            // and send one signal notification
            sequelize.query(`SELECT * FROM UserLogins WHERE userId='${alert.userId}'`, {
            	type: sequelize.QueryTypes.SELECT
            }).then(userLogins => {
            	if ( ! userLogins || userLogins.length === 0) {
            		return
            	}
            	const loginToken = userLogins[0]
            	data.message = pushNotificationMsg
            	sendOneSignalNotification([loginToken], data.title, data.message, data);
            })
		}

		done()
	})
})

module.exports = CheckAlertMatchesQueue