const Queue = require('bull')
const redis = require('./redisConfig')
const { Sequelize, sequelize, AlertMatch } = require('../models')
const { getWeekDayIndex, sendOneSignalNotification, createNotification } = require('../tools/tools')
const moment = require('moment-timezone')
const _ = require('lodash')

const CheckRideAlertsQueue = new Queue('Check Ride Alerts', { redis })

CheckRideAlertsQueue.process((job, done) => {
	const { ride, type } = job.data
	if ( ! ride) {
		done()
		return
	}

	const maxSearchDistance = 2.5

	let { days, date } = ride

	if (type != 'Regular') {
		// This is not a regular ride
		days = [getWeekDayIndex(date)]
	}

	if (type == 'Regular') {
		date = moment().tz('Africa/Cairo').day(days[0] - 1).format('YYYY-MM-DD')
	} else {
		date = moment(date).tz('Africa/Cairo').format('YYYY-MM-DD')
	}

	const { locationFrom, locationTo, fromId, toId } = ride

	// Check for ride alerts matching this ride
	const query = `SELECT ra.id, ra.userId, lfrom.englishName AS fromEnglish, lto.englishName AS toEnglish FROM RideAlerts ra
			
			INNER JOIN Locations lfrom ON lfrom.id = ra.from
				AND dist(lfrom.lat, lfrom.lng, ${locationFrom.lat}, ${locationFrom.lng} ) <= ${maxSearchDistance}
			
			INNER JOIN Locations lto ON lto.id = ra.to
				AND dist(lto.lat, lto.lng, ${locationTo.lat}, ${locationTo.lng} ) <= ${maxSearchDistance}

			INNER JOIN RideAlertsDays rad ON rad.rideAlertId = ra.id
				AND rad.day IN (${days.join(',')})

			WHERE ra.status = 'verified' AND ra.userId != '${ride.driver}'
		`

	sequelize.query(query, { type: Sequelize.QueryTypes.SELECT }).then(alerts => {
		if ( ! alerts) {
			done()
			return
		}

		const alertMatches = [];

		_.uniqBy(alerts, 'id').forEach(alert => {
			// Create alert match entry
			alertMatches.push({
				ride_id: ride.id,
				ride_type: type == 'Regular' ? 'regular' : 'normal',
				ride_alert_id: alert.id,
			})

			const notificationMsg = `New ride found matching your ride alert from: ${alert.fromEnglish} to: ${alert.toEnglish}`
            const pushNotificationMsg = `New ride found matching your ride alert from: ${alert.fromEnglish} to: ${alert.toEnglish}`
            const data = {
              type: 'alert_new_ride',
              title: 'New Ride Found',
              message: notificationMsg,
              from: locationFrom,
              to: locationTo,
              date,
              userId: alert.userId,
              alerId: alert.id,
            }


            // Create notification
            createNotification(null, data.message, 12, null, alert.userId, alert.id, { from: locationFrom, to: locationTo, date })

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
		})

		if (alertMatches.length > 0) {
			AlertMatch.bulkCreate(alertMatches).then(res => {}).catch(err => {})
		}

		done()
	})
})

module.exports = CheckRideAlertsQueue