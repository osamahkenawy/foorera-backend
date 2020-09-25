const crypto = require('crypto');
const uuid = require('node-uuid');
const bcrypt = require('bcrypt-nodejs');
const winston = require('winston');
const first = require('lodash/first');
const Q = require('q');
const moment = require('moment');
const momentTimezone = require('moment-timezone');
const request = require('request-promise');

const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];

// prepare OneSignal client for sending push notifications
const OneSignal = require('onesignal-node');
const {
  calculateBalance,
} = require('./paymentAPI');
const {
  sequelize,
  Users,
  GroupUsers,
  Groups,
  RideRiders,
  Rides,
  Notifications,
  UserSocialNetworkAccounts,
  UserCars,
  UserLogins,
  RegularRide,
  RegularRideDays,
  FailedNotifications,
  PromoCodes,
} = require('../models/index');
const {
  getSupportMailTemp,
} = require('../support-mail-temp');

const osClient = new OneSignal.Client({
  app: { appAuthKey: config.oneSignalApiKey, appId: config.oneSignalAppId },
});

// Create response object
const packRes = (status, content = null, validation = []) => ({
  status,
  content,
  validation,
});

const dispatchSuc = (res, payload) => res.send(packRes(true, payload));

const dispatchErr = (res, err) => res.send(packRes(false, null, err));

const dispatchErrContent = (res, contant, err) => res.send(packRes(false, contant, err));
// Confirms userId identity
const checkUserConsistency = (userId, response) => userId === response;

// Creates loginToken
const createToken = () => {
  const sha = crypto.createHash('sha256');
  sha.update(Math.random().toString());
  return sha.digest('hex');
};

// Creates an uuid
const createUuid = () => uuid.v4();

// validate Date yyyy-mm-dd
const validateDate = (d) => {
  const regex = /(\d{4})-(\d{2})-(\d{2})/;
  return regex.test(d);
};

// validate time 00:00:00
const validateTime = (d) => {
  const regex = /^([01]\d|2[0-3])(:[0-5]\d){1,2}$/;
  return regex.test(d);
};

// Checks that logged user is the same who will be affected
// by the action
const checkPermissions = (loggedUser, userId) => new Promise(
  (resolve, reject) => {
    if (userId === undefined) {
      reject(['Missing userId']);
    }
    if (!checkUserConsistency(loggedUser, userId)) {
      reject(['Permission denied']);
    } else {
      resolve(loggedUser);
    }
  },
);

const checkUserVerification = userId => new Promise(
  (resolve, reject) => {
    Users.findById(userId)
      .then((userStatus) => {
        if (userStatus.status !== 'verified') {
          reject(['What is your university or company?']);
        } else resolve();
      }).catch(err => reject([err]));
  },
);

// Prepares input object filtering unused values
const prepareInput = input => new Promise(
  (resolve, reject) => {
    const obj = {};
    let count = 0;
    let key;
    for (key in input) {
      if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== '') {
        obj[key] = input[key];
        count++;
      }
    }
    count > 0
      ? resolve(obj)
      : reject(['No data passed']);
  },
);

// Updates the User attributes
const updateUser = (Users, userId, data) => new Promise(
  (resolve, reject) => {
    Users.find({
      attributes: {
        exclude: ['encPassword'],
      },
      where: {
        userId,
      },
    })
      .then((user) => {
        if (user !== null) {
          // Update existing user
          user.updateAttributes(data)
            .then((updatedUser) => {
              const newObj = {};
              let key;
              updatedUser = updatedUser.get();
              for (key in updatedUser) {
                if (key !== 'encPassword') {
                  newObj[key] = updatedUser[key];
                }
              }
              resolve(newObj);
            })
            .catch(err => reject([err.message]));
        } else {
          reject(['Unable to update']);
        }
      })
      .catch(err => reject([err.message]));
  },
);

// Checks login token against DB and returns userId
const checkLoginToken = (userLogins, loginToken) => new Promise(
  (resolve, reject) => {
    if (loginToken === undefined) {
      reject(['Missing loginToken']);
    }

    userLogins.findOne({
      attributes: ['userId'],
      where: {
        loginToken,
      },
    })
      .then((userLogin) => {
        if (userLogin !== null) {
          resolve(userLogin.userId);
        } else {
          reject(['Sorry your session is expired, please login again']);
        }
      })
      .catch(err => reject([err.message]));
  },
);

// Checks location existence and diversity
const checkLocations = (Locations, newRide) => new Promise(
  (resolve, reject) => {
    if (newRide.fromId === newRide.toId) {
      reject(['Same origin and destination']);
      return;
    }
    Promise.all([
      Locations.findOne({
        where: {
          id: newRide.fromId,
        },
      }),
      Locations.findOne({
        where: {
          id: newRide.toId,
        },
      }),
    ])
      .then((results) => {
        if (results[0] === null) reject(['Invalid from location']);
        if (results[1] === null) reject(['Invalid to location']);
        resolve(newRide);
      })
      .catch(err => reject([err.message]));
  },
);

// Encrypt password using bcrypt with salt
const cryptPass = plainPass => new Promise(
  (resolve, reject) => {
    bcrypt.genSalt(10, (err, salt) => {
      if (err) {
        reject(err);
        return;
      }
      bcrypt.hash(plainPass, salt, null, (err, hash) => {
        if (err) {
          reject(err);
        } else {
          resolve(hash);
        }
      });
    });
  },
);

// Compare user encrypted password with user input
const comparePass = (plainPass, userEncPass) => new Promise(
  (resolve, reject) => {
    bcrypt.compare(plainPass, userEncPass, (err, isMatch) => {
      if (err) {
        reject(err);
        return;
      }

      if (isMatch) resolve();
      else reject(['Wrong Password']);
    });
  },
);


// covert time fromat to 00:00 Am
const tConvert = (time) => {
  // Check correct time format and split into components
  time = time.toString().match(/^([01]\d|2[0-3])(:)([0-5]\d)(:[0-5]\d)?$/) || [time];

  if (time.length > 1) { // If time format correct
    time = time.slice(1); // Remove full string match value
    time[5] = +time[0] < 12 ? ' AM' : ' PM'; // Set AM/PM
    time[0] = +time[0] % 12 || 12; // Adjust hours
  }
  return time.join(''); // return adjusted time or original string
};

const createNotification = (imageUrl, content, type, imageTarget, user, target, extras) => request.post(config.notificationServerUrl, {
  body: {
    imageUrl, content, type, imageTarget, user, target, extras,
  },
  headers: {
    'auth-access-token': process.env.AUTH_ACCESS_TOKEN || 'W+MpU2F+Uq5L9pHzLNdntYInx2WDiEDgQmHkWNDr',
  },
  json: true,
})
  .then(() => {
    console.log('Notification created');
  })
  .catch((err) => {
    FailedNotifications.create({
      notification: {
        type: 'create',
        body: {
          imageUrl, content, type, imageTarget, user, target, extras,
        },
      },
    })
      .catch((err) => {
        console.error("Couldn't create failed notification entry");
        console.error(err);
      });
    console.error('Error creating notification');
    console.error(err);
  });

const formatNotificationDate = date => `${momentTimezone(date).tz('Africa/Cairo').format('ddd D MMM')} at ${moment(date).format('h:mm A')}`;

// send Data to clint
const sendData = (UserLogins, loginToken, data, addRecord) => {
  const addNotificationRecord = () => {
    new Promise(
      (resolve, reject) => {
        Notifications.create({
          id: createUuid(),
          userId: data.userId,
          message: data.message,
          type: data.type,
          data: data.data,
          timestamp: Date.now(),
        }).then(() => {
          resolve();
        })
          .catch(err => dispatchErr(res, err));
      },

    );
  };

  UserLogins.find({
    attributes: ['deviceId', 'deviceName'],
    where: {
      userId: data.userId,
    },
  })
    .then((user) => {
      if (addRecord) {
        addNotificationRecord();
      }

      sendOneSignalNotification([user], data.title, data.message, data);
    })
    .catch(err => dispatchErr(res, err));
};

// send notification to segment
const sendNotificationToSegment = (segment, title, message, data, save) => {
  const addNotificationRecord = function () {
    new Promise(
      (resolve, reject) => {
        Notifications.create({
          id: createUuid(),
          userId: null,
          message,
          type: null,
          data,
          timestamp: Date.now(),
        }).then(() => {
          resolve();
        })
          .catch(err => reject(err));
      },
    );
  };

  if (save) {
    addNotificationRecord();
    createNotification(null, message, null, null, null, null, data);
  }

  sendOneSignalNotification(segment, title, message, data);
};


// send data Message to user

const sendDataByUserId = (UserLogins, data, addRecord) => {
  const addNotificationRecord = () => {
    new Promise(
      (resolve, reject) => {
        Notifications.create({
          id: createUuid(),
          userId: data.userId,
          message: data.message,
          type: data.type,
          data: data.data,
          timestamp: Date.now(),
        }).then(() => {
          resolve();
        }).catch((err) => {
          console.error('Creating payment notification failed');
          console.error(err);
          dispatchErr(res, err);
        });
      },
    );
  };

  UserLogins.findOne({
    attributes: ['deviceId', 'deviceName'],
    where: {
      userId: data.userId,
    },
  })
    .then((user) => {
      if (addRecord) {
        addNotificationRecord();
      }

      sendOneSignalNotification([user], data.title, data.message, data);
    })
    .catch(err => dispatchErr(res, err));
};

const uploadPicture = (imageData, userId, userInfo) => new Promise(
  (resolve, reject) => {
    const decodeBase64Image = dataString => dataString.replace(/^data:image\/png;base64,/, '');

    const imageBuffer = decodeBase64Image(imageData);
    // const { imagesDir } = config;
    const imageFileName = `${userId}.png`;

    require('fs').writeFile("../images/" + imageFileName, imageBuffer, 'base64', (err) => {
      if (err) reject([err.message]);
      else {
        userInfo.picture = imageFileName;
        resolve(userInfo);
      }
    });
  },
);

const sleep = (millis) => {
  const deferredResult = Q.defer();
  setTimeout(() => {
    deferredResult.resolve();
  }, millis);
  return deferredResult.promise;
};
const getGroupUsers = groupId => new Promise((resolve, reject) => Groups.findOne({
  attributes: ['id', 'name', 'status', 'icon', 'categoryId'],
  where: {
    id: groupId,
    status: {
      $ne: 'pending',
    },
  },
  order: 'name',
  include: [{
    model: GroupUsers,
    attributes: ['status'],
    required: false,
    include: [{
      model: Users,
      attributes: ['status'],
    }],
  }],
})
  .then((groups) => {
    if (groups === null) resolve(memberCount);
    else {
      var memberCount = 0;
      for (j = 0; groups.GroupUsers && j < groups.GroupUsers.length; j++) {
        if (groups.GroupUsers[j].status == 'verified'
							&& groups.GroupUsers[j].User && groups.GroupUsers[j].User.status == 'verified') memberCount++;
      }

      resolve(memberCount);
      // groups[i].set('memberCount', memberCount, { raw: true })
      // groups[i].set('GroupUsers', null, { raw: true })
    }
  })
  .catch(err => reject([err])));

const getUser = (loginToken, userId, res) => new Promise(
  (resolve, reject) => Users.findById(userId, {
    attributes: { exclude: ['encPassword'] },
    include: { model: GroupUsers, include: [Groups] },
  })
    .then((user) => {
      if (user !== null) {
        const groups = [];
        let count = 0;
        for (i = 0; user.GroupUsers && i < user.GroupUsers.length; i++) {
          if (user.GroupUsers[i].status == 'verified' && user.GroupUsers[i].Group.status == 'done') groups[count++] = user.GroupUsers[i].Group;
        }
        const groupMember = [];
        for (var i = 0; i < groups.length; i++) {
          (function (i) {
            groupMember.push(getGroupUsers(groups[i].id));
          }(i));
        }
        Q.all(groupMember).then((member) => {
          for (var i = 0; i < groups.length; i++) {
            groups[i].dataValues.memberCount = member[i];
          }


          user.set('Groups', groups, { raw: true });
          user.set('GroupUsers', null, { raw: true });
          RideRiders.findAll({ where: { userId, status: 'finished' } })
            .then((rideRidersAsRider) => {
              let ratingSum = 0;
              let rideRidersAsRiderActualCount = 0;
              for (i = 0; rideRidersAsRider && i < rideRidersAsRider.length; i++) {
                if (rideRidersAsRider[i].riderRating != undefined) {
                  rideRidersAsRiderActualCount++;
                  ratingSum += rideRidersAsRider[i].riderRating;
                }
              }

              RideRiders.findAll({
                where: { status: 'finished' },
                include: [{
                  model: Rides, as: 'ride', where: { driver: userId, status: 'finished' },
                }],
              })
                .then((rideRidersAsDriver) => {
                  let ratingDriver = 0;
                  let rideRidersAsDriverActualCount = 0;
                  for (i = 0; rideRidersAsDriver && i < rideRidersAsDriver.length; i++) {
                    if (rideRidersAsDriver[i].driverRating != undefined) {
                      rideRidersAsDriverActualCount++;
                      ratingDriver += rideRidersAsDriver[i].driverRating;
                    }
                  }

                  const ratedRidesCount = rideRidersAsRiderActualCount + rideRidersAsDriverActualCount;
                  ratingSum += ratingDriver;
                  let averageRating = 0;
                  if (ratedRidesCount > 0) averageRating = ratingSum / ratedRidesCount;
                  let doneRide = 0;
                  Rides.count({ where: { driver: userId, status: 'finished' } })
                    .then((count) => {
                      doneRide = rideRidersAsRider.length + count;
                      if (ratedRidesCount == 0) {
                        user.set({ rating: 3, completedRidesCount: doneRide }, { raw: true });
                      } else user.set({ rating: averageRating, completedRidesCount: doneRide }, { raw: true });
                      UserSocialNetworkAccounts.findById(userId)
                        .then((userAccount) => {
                          if (userAccount !== null) {
                            user.set({ socialUserId: userAccount.accountUsername }, { raw: true });
                            user.set({ socialUrl: userAccount.socialUrl }, { raw: true });
                          } else {
                            user.set({ socialUserId: null }, { raw: true });
                            user.set({ socialUrl: null }, { raw: true });
                          }

                          UserCars.findAll({
                            where: { userId, status: 'active' },
                          }).then((cars) => {
                            // set user cars
                            user.set({ cars }, { raw: true });

                            // check loginToken
                            if (loginToken != undefined && loginToken != null) {
                              // check get userLogin to check if personal profile
                              UserLogins.findOne({
                                where: {
                                  loginToken,
                                },
                              }).then((userLogin) => {
                                // prepare personal flag
                                const personal = !!(userLogin != undefined && userLogin != null
																			&& userLogin.userId == userId);

                                // check if personal
                                if (personal) {
                                  // This is my own profile
                                  user.set('loginToken', loginToken, { raw: true });
                                  calculateBalance(userId).then((balance) => {
                                    user.set('balance', balance, { raw: true });
                                    dispatchSuc(res, user);
                                  }).catch(err => dispatchSuc(res, user));
                                } else {
                                  // Return phone number only if there is an active ride between the
                                  // user viewing the profile and the profile owner
                                  const cellphone = user.cellphone;
                                  user.set({ 'cellphone': null }, { raw: true });
                                  Rides.findOne({
                                    where: {
                                      driver: userLogin.userId,
                                      $or: [
                                        { status: null },
                                        { $and: [
                                          { status: { $ne: 'deleted' } },
                                          { status: { $ne: 'cancelled' } },
                                          { status: { $ne: 'finished' } }
                                        ]}
                                      ]
                                    },
                                    include: [{
                                      model: RideRiders,
                                      where: {
                                        userId: userId,
                                        $or: [{ status: 'accepted' }, { status: 'started' }]
                                      }
                                    }]
                                  }).then((canSeeCellphone) => {
                                    if (canSeeCellphone == null) {
                                      // get profile user rides which have the calling user as 'accepted' or 'started' rider within
                                      RideRiders.findOne({
                                        where: {
                                          userId: userLogin.userId,
                                          $or: [
                                            { status: 'accepted' },
                                            { status: 'started' }
                                          ],
                                        },
                                        include: [{
                                          model: Rides,
                                          where: {
                                            driver: userId,
                                            $or: [
                                              { status: null },
                                              { $and: [
                                                { status: { $ne: 'deleted' } },
                                                { status: { $ne: 'cancelled' } },
                                                { status: { $ne: 'finished' }
                                              }],
                                            }],
                                          },
                                        }],
                                      }).then((canSeeCellphone) => {
                                        if (canSeeCellphone == null) {
                                          dispatchSuc(res, user)
                                        } else {
                                          user.set({ cellphone }, { raw: true });
                                          dispatchSuc(res, user)
                                        }
                                      }).catch((err) => dispatchSuc(res, user))
                                    } else {
                                      user.set({ cellphone }, { raw: true });
                                      dispatchSuc(res, user)
                                    }
                                  }).catch((err) => dispatchSuc(res, user))

                                  // Helloooooooooooooooooooo
                                  // dispatchSuc(res, user);
                                }
                              })
                                .catch(err => dispatchSuc(res, user));
                            } else {
                              dispatchSuc(res, user);
                            }
                          })
                            .catch(err => dispatchErr(res, err));
                        })
                        .catch(err => dispatchErr(res, err));
                    })
                    .catch(err => dispatchErr(res, err));
                })
                .catch(err => dispatchErr(res, err));
            })
            .catch(err => dispatchErr(res, err));
        }).catch(err => dispatchErr(res, err));
      } else dispatchErr(res, ['User not found']);
    })
    .catch(err => dispatchErr(res, [err.message])),
);

const getAddGroupSupportMail = () => {
  const mailBody = `Hi,

We can’t wait for you to start your rides with Foorera! We will let you know once your group is created. Spread the word!

<i>Make your group bigger and share with your colleagues to get more rides.</i>`;
  return getSupportMailTemp(mailBody);
};

const getResetPasswordMail = (token) => {
  const mailBody = `Hello,

You have just requested a password reset for your Foorera account, use the token <b>${token}</b> to reset your password from your Foorera application.

If this wasn't you, it's safe to ignore this Email.`;

  return getSupportMailTemp(mailBody);
};

const getDayName = (date) => {
  const dateObject = new Date(date);
  return dateObject.toString().substring(0, 3);
};

const getWeekDayIndex = (date) => {
  // convert the date string
  const dateObject = new Date(date);

  // prepare the date index as (sat) is the start of the week
  let dayIndex = dateObject.getDay();
  dayIndex = ((dayIndex * 2) + 1) - dayIndex;
  dayIndex = dayIndex > 6 ? 0 : dayIndex;

  // return with it
  return dayIndex;
};

const isToday = (date) => {
  // prepare the date
  if (typeof date === 'string' || date instanceof String) {
    const dateParts = date.split('-');
    date = new Date(dateParts[0], parseInt(dateParts[1]) - 1, dateParts[2]);
  }
  const currentDate = new Date();
  return date.getDate() == currentDate.getDate() && date.getMonth() == currentDate.getMonth() && date.getFullYear() == currentDate.getFullYear();
};

const getCurrentTime = () => {
  const currentDate = new Date();
  return currentDate.toTimeString().split(' ')[0];
};

const formatDate = (date) => {
  let month = `${date.getMonth() + 1}`;


  let day = `${date.getDate()}`;


  const year = date.getFullYear();

  if (month.length < 2) month = `0${month}`;
  if (day.length < 2) day = `0${day}`;

  return [year, month, day].join('-');
};

const convertToTimestamp = (date, time) => new Date(`${date} ${time}`).getTime();

const convertRegularRideToRide = (regularRide, date) => {
  const ride = {
    id: null,
    regularRideId: regularRide.id,
    driver: regularRide.driver,
    groupId: regularRide.groupId,
    carId: regularRide.carId,
    fromId: regularRide.fromId,
    toId: regularRide.toId,
    seats: regularRide.seats,
    date,
    dateTime: convertToTimestamp(date, regularRide.time),
    time: regularRide.time,
    status: null,
    distance: regularRide.distance,
    fare: null,
    fareAfterCommission: null,
    user: null,
    Group: regularRide.Group,
    from: regularRide.from,
    to: regularRide.to,
    car: regularRide.car,
    riders: [],
  };

  return ride;
};

// checks if the user has rides or regular rides at date and time to let him create new rides
const checkUserRidesAtDateAndTime = (userId, date, time, isReturnRide) => new Promise(
  (resolve, reject) => {
    Rides.count({
      where: {
        driver: userId,
        date,
        time,
        $or: [{
          status: null,
        },
        {
          $and: [{
            status: {
              $ne: 'deleted',
            },
          },
          {
            status: {
              $ne: 'cancelled',
            },
          },
          {
            status: {
              $ne: 'finished',
            },
          },
          ],
        },
        ],
      },
    })
      .then((count) => {
        if (count > 0) {
          if (!isReturnRide) {
            reject(['You have a ride on this date, time']);
          } else {
            reject(['You have a ride on this date, return time']);
          }
        } else {
          RegularRide.count({
            where: {
              driver: userId,
              time,
              $and: [{
                status: {
                  $ne: 'deleted',
                },
              },
              {
                status: {
                  $ne: 'cancelled',
                },
              },
              {
                status: {
                  $ne: 'finished',
                },
              },
              ],
            },
            include: [{
              model: RegularRideDays,
              required: true,
              where: {
                day: getWeekDayIndex(date),
              },
            }],
          })
            .then((count) => {
              if (count > 0) {
                if (!isReturnRide) {
                  reject(['You have a ride on this date, time']);
                } else {
                  reject(['You have a ride on this date, return time']);
                }
              } else {
                resolve();
              }
            })
            .catch(err => reject([err.message]));
        }
      })
      .catch(err => reject([err.message]));
  },
);

// checks if the user has rides or regular rides on day and time to let him create new rides
const checkUserRidesOnDaysAndTime = (userId, days, time, isReturnRide, regularRideId) => new Promise(
  (resolve, reject) => {
    // prepare days clause str
    let daysClause = '';
    for (i = 0; days && i < days.length; i++) {
      if (i > 0) {
        daysClause += ' OR ';
      }
      daysClause += `weekDayIndex(date) = ${days[i]}`;
    }

    Rides.count({
      where: {
        driver: userId,
        time,
        dateTime: {
          $gte: Date.now(),
        },
        $and: [
          [daysClause],
        ],
        $or: [{
          status: null,
        },
        {
          $and: [{
            status: {
              $ne: 'deleted',
            },
          },
          {
            status: {
              $ne: 'cancelled',
            },
          },
          {
            status: {
              $ne: 'finished',
            },
          },
          ],
        },
        ],
      },
    })
      .then((count) => {
        if (count > 0) {
          if (!isReturnRide) {
            reject(['You have rides on some of these days, time']);
          } else {
            reject(['You have rides on some of these days, return time']);
          }
        } else {
          // prepare the daysClause arr
          const daysClause = [];
          for (i = 0; days && i < days.length; i++) {
            daysClause.push({
              day: days[i],
            });
          }

          RegularRide.count({
            where: {
              id: {
                $ne: regularRideId,
              },
              driver: userId,
              time,
              $and: [{
                status: {
                  $ne: 'deleted',
                },
              },
              {
                status: {
                  $ne: 'cancelled',
                },
              },
              {
                status: {
                  $ne: 'finished',
                },
              },
              ],
            },
            include: [{
              model: RegularRideDays,
              required: true,
              where: {
                $or: daysClause,
              },
            }],
          })
            .then((count) => {
              if (count > 0) {
                if (!isReturnRide) {
                  reject(['You have some rides on some of these days, time']);
                } else {
                  reject(['You have some rides on some of these days, return time']);
                }
              } else {
                resolve();
              }
            })
            .catch(err => reject([err.message]));
        }
      })
      .catch(err => reject([err.message]));
  },
);

const fcmHttpRequest = function(body) {
  return request({
    method: 'POST',
    uri: 'https://fcm.googleapis.com/fcm/send',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'key=' + config.fcmServerKey,
    },
  }).then(res => {}).catch(err => {});
}

let sendOneSignalNotification = function(target, title, body, data) {

  if ((target instanceof Array && target[0] && target[0].deviceId && target[0].deviceId.length > 50) || typeof target === 'string') {
    // We have fcm token or topic here
    if ( ! data) {
      data = {};
    }
    const recepient = target instanceof Array ? 'registration_ids' : 'to';
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }

    if (typeof target === 'string') {
      return fcmHttpRequest({
        to: '/topics/' + target,
        priority: 'high',
        notification: { title, body },
        data: { ...data },
      });
    } else {
      const iosDevices = target.filter(token => token.deviceName === 'ios');
      const androidDevices = target.filter(token => token.deviceName === 'android');
      if (iosDevices.length > 0) {
        fcmHttpRequest({
          registration_ids: iosDevices.map(device => device.deviceId),
          priority: 'high',
          notification: { title, body, sound: 'default' },
          sound: 'default',
          data: { ...data },
          content_available: true,
          apns: {
            payload: {
              aps: {
                sound: 'default'
              },
            },
          },
        });
      }

      if (androidDevices.length > 0) {
        fcmHttpRequest({
          registration_ids: androidDevices.map(device => device.deviceId),
          priority: 'high',
          data: {
            title,
            body,
            ...data,
          },
          content_available: true,
          android: {
            notification: {
              sound: 'default'
            },
          },
        });
      }
    }
    
  } else {
    // Onesignal notification
    const osNotification = new OneSignal.Notification({
      content_available: true,
      contents: {
        en: body,
      },
    });

    // main parameters
    osNotification.setParameter('mutable_content', true);
    osNotification.setParameter('headings', { en: title || 'Foorera' });

    // add data if possible
    if (data) {
      if (typeof data === 'string') {
        osNotification.setParameter('data', JSON.parse(data));
      } else if (typeof data === 'object') {
        osNotification.setParameter('data', data);
      }
    }

    // check send to all or send to specific users
    if (target) {
      if (target instanceof Array) {
        osNotification.setTargetDevices(target.map(device => device.deviceId));
      } else {
        osNotification.setFilters([
          {
            field: 'tag', key: 'topic', relation: 'is', value: target,
          },
        ]);
      }
    } else {
      osNotification.setIncludedSegments(['All']);
    }

    // send the notification
    osClient.sendNotification(osNotification, (err, httpResponse, data) => {
      if (!err) {
        console.log('OneSignal Result:--------------', data);
      } else {
        console.error('Error:----------------', err);
      }
    });
  }
};

const convertToRegularAlert = (obj, type) => {
  const regularAlert = {
    id: obj.id,
    user: type === 'regular_ride' ? obj.driver : obj.user,
    from: obj.from,
    to: obj.to,
    days: obj.days,
    status: obj.status,
    creationDate: obj.creationDate,
    group: obj.Group,
    car: obj.UserCar,
    seats: obj.seats,
    time: obj.time,
    type,
  };

  return regularAlert;
};

const validatePromoCode = async (promoCodeName, groupId) => {
  try {
    return await tryValidatePromoCode(promoCodeName, groupId);
  } catch (error) {
    winston.error(error);
    throw error;
  }
};


const tryValidatePromoCode = async (promoCodeName, groupId) => {
  const promoCode = await findPromoCodeByName(promoCodeName);
  if (!promoCode) {
    throw new Error(["Promo code dosen't exist for group"]);
  }
  const promoCodeGroupId = promoCode.groupId;
  const promoCodeExpirationDate = new moment(promoCode.expirationDate);

  if (promoCodeExpirationDate.isBefore(moment())) {
    throw new Error(['Promo code is expired']);
  }
  return promoCodeExpirationDate;
};


const findPromoCodeByName = async (promoCodeName) => {
  const promoCode = first(await PromoCodes.findAll({
    where: {
      name: promoCodeName,
    },
  }));
  return promoCode;
};


module.exports = {
  getUser,
  dispatchSuc,
  dispatchErr,
  checkUserConsistency,
  validateTime,
  createToken,
  validateDate,
  createUuid,
  checkPermissions,
  prepareInput,
  updateUser,
  checkLoginToken,
  checkLocations,
  cryptPass,
  comparePass,
  createNotification,
  formatNotificationDate,
  sendData,
  uploadPicture,
  sendDataByUserId,
  tConvert,
  sendNotificationToSegment,
  checkUserVerification,
  dispatchErrContent,
  getAddGroupSupportMail,
  getResetPasswordMail,
  getDayName,
  convertToTimestamp,
  convertRegularRideToRide,
  getWeekDayIndex,
  isToday,
  getCurrentTime,
  formatDate,
  checkUserRidesAtDateAndTime,
  checkUserRidesOnDaysAndTime,
  convertToRegularAlert,
  sendOneSignalNotification,
  validatePromoCode,
};
