const cron = require('cron');

const CronJob = cron.CronJob;
const request = require('request');
const moment = require('moment');
const momentTimeZone = require('moment-timezone');
const { sendOneSignalNotification, createNotification, createUuid } = require('./tools');
const redisClient = require('redis').createClient({
  // password: process.env.REDIS_PASS || "1Y4BiGvIwI19/VVcuOzaY9EhsEkYtEm+x/I27vu6DiCmcnzZQtwDnsk3CnHBu+KhgMIy5yYhfggoMVa9lzb/i1aMDi1t4U4CkYBmRlZHwN5fYEwMY9jnPQXu3gXY3Eq7wQR/m8toEM5Qv8JDvL0vKjyFvLlhgzulLxqs6BTut0JN73BzD/Lf2aYVTzKDFN1jpN/kB6ZX2U5skbMMbQpImNDAO4P4RXb3MWRW8KLCRKKwFiwTZJo9XfFcAATbp65oy/vscee7mgR+r+zuMPJHjxdvLOP2LQWzFfIUcUCsfPjiuNFhw0rX7aQVMeu6dIrKWASU91RY/ftJ3A==",
  port: process.env.REDIS_PORT || 6379,
  host: process.env.REDIS_HOST || 'localhost',
});

redisClient.AUTH(process.env.REDIS_PASS || '1Y4BiGvIwI19/VVcuOzaY9EhsEkYtEm+x/I27vu6DiCmcnzZQtwDnsk3CnHBu+KhgMIy5yYhfggoMVa9lzb/i1aMDi1t4U4CkYBmRlZHwN5fYEwMY9jnPQXu3gXY3Eq7wQR/m8toEM5Qv8JDvL0vKjyFvLlhgzulLxqs6BTut0JN73BzD/Lf2aYVTzKDFN1jpN/kB6ZX2U5skbMMbQpImNDAO4P4RXb3MWRW8KLCRKKwFiwTZJo9XfFcAATbp65oy/vscee7mgR+r+zuMPJHjxdvLOP2LQWzFfIUcUCsfPjiuNFhw0rX7aQVMeu6dIrKWASU91RY/ftJ3A==');
redisClient.on('error', (err) => {
  console.error(err);
});

const {
  sequelize,
  UserLogins,
  Users,
  RideRiders,
  Rides,
  UserTransactions,
  Groups
} = require('../models/index');

const { eventEmitter } = require('../events');


const updateFinishedRideIfRequired = rideId => new Promise((resolve, reject) => {
    RideRiders.count({
      where: {
        rideId,
        $or: [{
          status: 'accepted'
        }, {
          status: 'started'
        }]
      }
    })
      .then((riders) => {
        if (riders == 0) {
          Rides.update({
            status: "finished"
          }, {
              where: {
                id: rideId
              }
            })
            .then(() => resolve())
            .catch((err) => reject([err]))
        }

        resolve()
      })
      .catch((err) => reject([err]))

  }
)

const rideRiderTransaction = (drivarId, riderId, rideRiderRecordId, fare, fareAfterCommission, rideId) =>new Promise((resolve, reject) => {
    //dbTransaction
    sequelize.transaction(function(t) {

      // chain all your queries here. make sure you return them.
      //rider transaction
      return UserTransactions.findOne({
        where: {
          sourceId: rideRiderRecordId,
        },
        transaction: t,
      }).then(function (userTransaction) {
          // Log rider transaction to amplitude
          userTransaction.status = 'successful';
          userTransaction.save().then(function() {
            eventEmitter.emit('TransactionCompleted', 'Ride Fare', userTransaction, drivarId, riderId, rideRiderRecordId, rideId);
          }).catch(errr => {
            console.log('Failed to update user transaction');
          })
          
          // Driver transaction
          return UserTransactions.create({
            id: createUuid(),
            userId: drivarId,
            sourceType: 'rideRevenue',
            sourceId: rideRiderRecordId,
            amount: fareAfterCommission,
            status: 'successful',
            creationDate: Date.now()
          }, {
              transaction: t
          }).then(function(driverTransaction) {
            // Log driver transaction to amplitude
            eventEmitter.emit('TransactionCompleted', 'Ride Revenue', driverTransaction, drivarId, riderId, rideRiderRecordId, rideId);
          }).catch(err => {
            console.log('Failed to create driver transaction');
          });
        });
    }).then(function (result) {
      // resolve(result)
    }).catch(function (err) {
      console.log(err)
    });
  }
)

const endRideAutomatically = myData => {
  const { userId, messageType, data } = myData
  RideRiders.findOne({
    where: { rideId: data.rideId, userId: data.riderId },
    attributes: ['id', 'rideId', 'userId', 'status'],
    include: [{
      model: Rides,
      attributes: ['driver', 'status'],
    }],
  }).then(rideRider => {
    if ( ! rideRider ||
          ['started', 'finished'].indexOf(rideRider.status) === -1 ||
          ['cancelled', 'deleted'].indexOf(rideRider.Ride.status) > -1) {
      return;
    }
    const otherUserId = userId == rideRider.userId ? rideRider.Ride.driver : rideRider.userId
    Users.findById(otherUserId).then((userData) => {
      createNotification(userData.picture, `Your ride with ${userData.firstName} ${userData.lastName} has <strong>ended</strong>`,
        8, userData.userId, userId, data.rideId, null)
    })

    // Hence this function is executed once for the driver and another time for rider
    // We need to avoid unnecessary duplicate operations and transactions
    // The following code will be executed once if the notified user is the rider
    if (userId == rideRider.Ride.driver) {
      return
    }

    UserTransactions.findOne({
      where: {
        userId: data.riderId,
        sourceId: rideRider.id
      }
    }).then((transaction) => {
        if (!transaction) {
          return console.error("No transaction found for user " + data.riderId + " and ride rider " + rideRider.id);
        }
        transaction.status = "successful"
        return transaction.save()
          .then(() => {
            // console.log("Transaction updated successfully")
          })
          .catch((err) => {
            console.error(err);
          })
    }).catch((err) => {
      console.error(err);
    })

    // get the ride fare and distance
    Rides.findById(data.rideId, {
      include: [{
        model: Groups
      }]
    }).then((rideObj) => {
        // update the rider record
        const newStatus = {
          distance: rideObj.distance,
          fare: rideObj.fare,
          fareAfterCommission: rideObj.fareAfterCommission,
          status: 'finished',
        }
        
        rideRider.update(newStatus)

        // update ride status if required
        updateFinishedRideIfRequired(data.rideId).then(() => {}).catch(err => {})

        let transactionFare, transactionFareAfterCommission
        // prepare the transactions fare according to if the groups has cash payment
        if (rideObj.Group && rideObj.Group.cashPayment) {
          transactionFare = 0
          transactionFareAfterCommission = 0
        } else {
          transactionFare = rideObj.fare
          transactionFareAfterCommission = rideObj.fareAfterCommission
        }
        // add rider and drivar transactions
        rideRiderTransaction(rideRider.Ride.driver, rideRider.userId, rideRider.id, transactionFare, transactionFareAfterCommission, data.rideId)

    }).catch((err) => reject([err]))
    
  }).catch(err => {
    console.log('Couldnt find ride rider to start automatically', err)
  })
}


module.exports = {
  rideAlerts() {
    return new CronJob('00 00 20 * * 0-6', (() => {
      console.log('Starting RideAlertsCronJob');
      sequelize.query("SELECT * FROM RideAlerts WHERE status='verified'", { type: sequelize.QueryTypes.SELECT })
        .then(async (alerts) => {
          console.log(`Found ${alerts.length} alerts`);
          alerts.forEach(async (oneAlert) => {
            console.log('Alerts for ', oneAlert);
            const loginToken = (await sequelize.query(`SELECT * FROM UserLogins WHERE userId='${oneAlert.userId}'`, { type: sequelize.QueryTypes.SELECT }))[0];
            if (!loginToken) {
              return console.log('Skipping. No login token for user', oneAlert.userId);
            }
            if (!loginToken.deviceId) {
              return console.log('Skipping. No device ID attached for', oneAlert.userId);
            }
            console.log('Login Token found', loginToken);
            const from = (await sequelize.query(`SELECT * FROM Locations WHERE id='${oneAlert.from}'`, { type: sequelize.QueryTypes.SELECT }))[0];
            const to = (await sequelize.query(`SELECT * FROM Locations WHERE id='${oneAlert.to}'`, { type: sequelize.QueryTypes.SELECT }))[0];
            const date = moment().add(1, 'd').format('YYYY-MM-DD');
            request(`${process.env.URL || 'http://localhost:3000'}/rides?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}&date=${date}&limit=100000&offset=0`, {
              headers: {
                loginToken: loginToken.loginToken,
              },
            }, (err, response) => {
              if (err) {
                return console.error(err);
              }
              const body = JSON.parse(response.body);
              const content = body.content;
              if (content && content.length !== 0) {
                // prepare data
                const notificationMsg = `${content.length} ${content.length == 1 ? 'ride' : 'rides'} found for your saved <strong>alert</strong> from: ${from.englishName} to: ${to.englishName}`;
                const pushNotificationMsg = `${content.length} ${content.length == 1 ? 'ride' : 'rides'} found for your saved alert from: ${from.englishName} to: ${to.englishName}`;
                const data = {
                  type: 'ride_alert',
                  title: 'New Rides Found',
                  message: notificationMsg,
                  from,
                  to,
                  date,
                  userId: oneAlert.userId,
                  alerId: oneAlert.id,
                };


                // create notification
                console.log(`Creating RideAlertNotification with message ${notificationMsg}`);
                createNotification(null, data.message, 12, null, oneAlert.userId, oneAlert.id, { from, to, date });

                // and send one signal notification
                data.message = pushNotificationMsg;
                sendOneSignalNotification([loginToken], data.title, data.message, data);
              }
            });
          });
        });
    }), (() => {
      console.log('******************************');
      console.log('RIDE ALERTS CRON STOPPED');
      console.log('******************************');
    }), true, 'Africa/Cairo');
  },
  testCron() {
    return new CronJob('*/5 * * * * *', (() => {
      console.log('5 seconds passed');
      // console.log(connection.state)
      sequelize.query("SELECT * FROM RideAlerts WHERE status='verified'", { type: sequelize.QueryTypes.SELECT })
        .then(async (alerts) => {
          console.log(alerts);
          alerts.forEach(async (oneAlert) => {
            console.log('Alerts for ', oneAlert);
            const loginToken = (await sequelize.query(`SELECT * FROM UserLogins WHERE userId='${oneAlert.userId}'`, { type: sequelize.QueryTypes.SELECT }))[0];
            if (!loginToken) {
              return console.log('Skipping. No login token for user', oneAlert.userId);
            }
            if (!loginToken.deviceId) {
              return console.log('Skipping. No device ID attached for', oneAlert.userId);
            }
            console.log('Login Token found', loginToken);
            const from = (await sequelize.query(`SELECT * FROM Locations WHERE id='${oneAlert.from}'`, { type: sequelize.QueryTypes.SELECT }))[0];
            const to = (await sequelize.query(`SELECT * FROM Locations WHERE id='${oneAlert.to}'`, { type: sequelize.QueryTypes.SELECT }))[0];
            const date = moment().add(1, 'd').format('YYYY-MM-DD');
            request(`${process.env.URL || 'http://localhost:3000'}/rides?fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}&date=${date}&limit=100000&offset=0`, {
              headers: {
                loginToken: loginToken.loginToken,
              },
            }, (err, response) => {
              if (err) {
                return console.error(err);
              }
              const body = JSON.parse(response.body);
              console.log('Response Body:', body);
              const content = body.content;
              if (content.length !== 0) {
                // prepare data
                const notificationMsg = `${content.length} ${content.length == 1 ? 'ride' : 'rides'} found for your saved <strong>alert</strong> from: ${from.englishName} to: ${to.englishName}`;
                const pushNotificationMsg = `${content.length} ${content.length == 1 ? 'ride' : 'rides'} found for your saved alert from: ${from.englishName} to: ${to.englishName}`;
                const data = {
                  type: 'ride_alert',
                  title: 'New Rides Found',
                  message: notificationMsg,
                  from,
                  to,
                  date,
                  userId: oneAlert.userId,
                  alerId: oneAlert.id,
                };

                // create notification
                createNotification(null, data.message, 12, null, oneAlert.userId, oneAlert.id, { from, to, date });

                // and send one signal notification
                data.message = pushNotificationMsg;
                return sendOneSignalNotification([loginToken], data.title, data.message, data);
              }
              console.log('Zero rides found for alert', oneAlert.id);
            });
          });
        });
    }), (() => {
      console.log('TEST CRON STOPPED');
    }), true, 'Africa/Cairo');
  },
  userUpcomingRideAlerts() {
    return new CronJob('00 00,30 * * * *', (() => {
      const now = moment().valueOf();
      const later = moment().add('31', 'minutes').valueOf();
      // sequelize.query(`SELECT * FROM RideRiders AS rrs INNER JOIN Rides AS rs ON rs.id = rrs.rideId INNER JOIN Users AS us ON rrs.userId = us.userId WHERE rs.dateTime > ${now} AND rs.dateTime <= ${later}`, {type: sequelize.QueryTypes.SELECT})
      sequelize.query(
        `
				SELECT
					ul.deviceId AS 'deviceId',
          ul.deviceName As 'deviceName',
						rs.id AS 'rideId',
						rs.driver AS 'driverId',
						ul2.deviceId AS 'driverDevice',
            ul2.deviceName AS 'driverDeviceName',
				FROM foorera_api.RideRiders rrs
				INNER JOIN foorera_api.Rides rs ON rs.id = rrs.rideId
				INNER JOIN foorera_api.UserLogins ul ON rrs.userId = ul.userId
				INNER JOIN foorera_api.UserLogins ul2 ON rs.driver = ul2.userId
				WHERE rs.dateTime > ${now} AND rs.dateTime < ${later} AND rrs.status = 'accepted';
				`,
				 { type: sequelize.QueryTypes.SELECT },
      )
        .then((riders) => {
          const driverDevices = [];
          const riderDevices = [];
          riders.forEach((rider) => {
            // Filter drivers' device Ids
            if (rider.driverDevice) {
                driverDevices.push({ deviceId: rider.driverDevice, deviceName: rider.driverDeviceName });
            }
            // Send notification to riders
            if (!rider.deviceId) return;
            riderDevices.push({ deviceId: rider.deviceId, deviceName: rider.deviceName });
          });

          if (riderDevices.length > 0) {
            sendOneSignalNotification(riderDevices, 'Foorera', 'Your ride is about to start');
          }
          // Send notification to drivers
          if (driverDevices.length > 0) {
            sendOneSignalNotification(driverDevices, 'Foorera', 'Your ride is about to start');
          }
        })
        .catch((err) => {
          console.error('Failed to run user ride alerts cron');
          console.error(err);
        });
    }), (() => {
      console.log('******************************');
      console.log('USERS RIDE ALERTS CRON STOPPED');
      console.log('******************************');
    }), true, 'Africa/Cairo');
  },
  oldPendingTransactions() {
    return new CronJob('00 00 00 * * *', (() => {
      // sequelize.query(`SELECT * FROM RideRiders AS rrs INNER JOIN Rides AS rs ON rs.id = rrs.rideId INNER JOIN Users AS us ON rrs.userId = us.userId WHERE rs.dateTime > ${now} AND rs.dateTime <= ${later}`, {type: sequelize.QueryTypes.SELECT})
      const now = momentTimeZone().tz('Africa/Cairo').valueOf();
      // UPDATE foorera_api.UserTransactions AS ut
      // SET ut.status = outdated
      sequelize.query(
        `
				UPDATE foorera_api.UserTransactions AS ut
					INNER JOIN foorera_api.RideRiders rrs ON ut.sourceId = rrs.id
					INNER JOIN foorera_api.Rides rs ON rrs.rideId = rs.id
				SET ut.status = "outdated"
				WHERE
					ut.status = 'pending'
					AND ut.sourceType = 'rideFees'
					AND rrs.status = 'pending'
					AND rs.dateTime < ${now}
					AND (rs.status IS NULL OR rs.status <> 'cancelled');
				`,
        // , {type: sequelize.QueryTypes.SELECT}
      )
        .then((transactions) => {
          console.log(transactions);
        })
        .catch((err) => {
          console.error('Failed to run old pending transactions cron');
          console.error(err);
        });
    }), (() => {
      console.log('******************************');
      console.log('OLD PENDING TRANSACTIONS CRON STOPPED');
      console.log('******************************');
    }), true, 'Africa/Cairo');
  },
  testCronJob() {
    return new CronJob('* * * * * *', function() {
      console.log('You will see this message every second');
    }, null, true, 'Africa/Cairo');
  },
  rideAboutToStartNotification() {

    const startRideAutomatically = myData => {
      console.log('Ride Starting Now **********************************************///////////////');
      const { userId, messageType, data } = myData
      RideRiders.findOne({
        where: { rideId: data.rideId, userId: data.riderId },
        attributes: ['id', 'rideId', 'userId', 'status'],
        include: [{
          model: Rides,
          attributes: ['driver', 'status'],
        }],
      }).then(rideRider => {
        if ( ! rideRider) { return }
        if (['started', 'accepted'].indexOf(rideRider.status) === -1 || ['cancelled', 'deleted'].indexOf(rideRider.Ride.status) > -1) {
          return;
        }

        rideRider.update({ status: 'started' }).then(() => {
          const otherUserId = userId == rideRider.userId ? rideRider.Ride.driver : rideRider.userId
          Users.findById(otherUserId).then((userData) => {
            createNotification(userData.picture, `Your ride with ${userData.firstName} ${userData.lastName} has <strong>started</strong>`,
              7, userData.userId, userId, data.rideId, null)
            //dispatchSuc(res, [])
          })
        }).catch(err => {
          console.log('Failed to start ride automatically')
        })
      }).catch(err => {
        console.log('Couldnt find ride rider to start automatically', err)
      })
    }

    return new CronJob('00 * * * * *', (() => {
      const now = momentTimeZone().tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm');
      redisClient.keys(`${now}*`, (err, response) => {
        if (err) {
          return console.error(err);
        }
        response.forEach((key) => {
          redisClient.get(key, (err, value) => {
            const data = JSON.parse(value);
            const { userId, messageType } = data;
            return UserLogins.findOne({
              where: {
                userId,
              },
            })
              .then((userLogin) => {
                switch (messageType) {
                  case 0: {
                    const myData = data.data;
                    myData.type = 'ride_alarm';
                    myData.title = 'Foorera';
                    myData.message = 'Your ride is starting in 30 minutes';
                    myData.userId = userId;
                    sendOneSignalNotification([userLogin], myData.title, myData.message, myData);
                    break;
                  }
                  case 1: {
                    const myData = data.data;
                    myData.type = 'ride_is_starting';
                    myData.title = 'Foorera';
                    myData.message = 'Your ride is starting in 10 minutes';
                    myData.userId = userId;
                    sendOneSignalNotification([userLogin], myData.title, myData.message, myData);
                    break;
                  }
                  case 2: {
                    // Automatically start ride at ride time
                    startRideAutomatically(data);
                    const myData = data.data;
                    myData.type = 'ride_started';
                    myData.title = 'Foorera';
                    myData.message = 'Your ride has started';
                    myData.userId = userId;
                    sendOneSignalNotification([userLogin], myData.title, myData.message, myData);
                    break;
                  }
                  case 3: {
                    // Automatically end the ride after 15 minutes
                    endRideAutomatically(data);
                    const myData = data.data;
                    myData.type = 'ride_ended';
                    myData.title = 'Foorera';
                    myData.message = 'Rate your ride';
                    myData.userId = userId;
                    sendOneSignalNotification([userLogin], myData.title, myData.message, myData);
                    break;
                  }
                  default: console.error('Wrong Message Type', messageType);
                }

                redisClient.del(key, (err, res) => console.log({ err, res }));
              })
              .catch(err => console.error(err));
          });
        });
      });
      // redisClient.
    }), (() => {
      console.log('******************************');
      console.log('RIDE ABOUT TO START NOTIFICATIONS CRON STOPPED');
      console.log('******************************');
    }), true, 'Africa/Cairo');
  },
};

