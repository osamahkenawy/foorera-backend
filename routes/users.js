const {
  sequelize,
  Sequelize,
  Users,
  UserLogins,
  UserCars,
  Locations,
  RideAlerts,
  RegularRide,
  RideRiders,
  GroupUsers,
  Groups,
  Rides,
  Notifications,
  RegularRideDays,
  RideAlertsDays,
  UserSocialNetworkAccounts,
  UserTransactions,
  AlertMatch
} = require('../models/index');
var {
  getUser,
  dispatchSuc,
  dispatchErr,
  checkLoginToken,
  checkPermissions,
  prepareInput,
  updateUser,
  createUuid,
  checkLocations,
  cryptPass,
  uploadPicture,
  checkUserVerification,
  dispatchErrContent,
  convertRegularRideToRide,
  getWeekDayIndex,
  isToday,
  getCurrentTime,
  formatDate,
  convertToRegularAlert,
  checkUserConsistency,
  getResetPasswordMail,
  cryptPass,
  comparePass,
} = require('../tools/tools');
const {
  getRegularRideById,
} = require('./regularRides');
const {
  getOrAddLocations,
} = require('../tools/geocoding');
const {
  calculateBalance,
  calculateActualBalance,
} = require('../tools/paymentAPI');
const {
  getRideById,
} = require('./rides');
const Q = require('q');
const wrap = require('co-express');

const { eventEmitter } = require('../events')

const env = process.env.NODE_ENV || 'development';
const { fbAppId, fbAppSecret } = require('../config/config.json')[env];
const request = require('request-promise');
const config = require('../config/config.json')[env];
const nodemailer = require('nodemailer');

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
  host: process.env.MAILGUN_HOST,
  port: process.env.MAILGUN_PORT,
  secure: false,
  auth: {
    user: process.env.MAILGUN_USER,
    pass: process.env.MAILGUN_PASS,
  },
});

// /users/:id route
const profile = (req, res, next) => {
  const loginToken = req.headers.logintoken;

  // Gets User object

  // The Promises chain firstly validates the loginToken then
  // if an userId is passed in the `params` this user is
  // searched and returned (if present), otherwise
  // the User object of the user that made the request is returned
  // userId in the `params` always comes first than the one
  // of whom made the request
  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      const uuid = req.params.id !== ''
        ? req.params.id
        : self;
      if (uuid == self) {
        getUser(loginToken, uuid, res);
      } else {
        // Edit (NO VERIFY)
        // checkUserVerification(self).then(() => {
          getUser(loginToken, uuid, res);
        // }).catch(err => dispatchErrContent(res, {
        //  verified: false,
        //}, ['What is your university or company?']));
      }
    })
    .catch(err => dispatchErr(res, err));
};

// /users/auth
const authenticateUser = (req, res) => {
  const { logintoken, loginToken } = req.headers;
  checkLoginToken(UserLogins, (logintoken || loginToken))
    .then((userId) => {
      dispatchSuc(res, userId);
    })
    .catch((err) => {
      dispatchErr(res, err);
    });
};

// /users/fetch
const fetchProfiles = async (req, res) => {
  const loginToken = req.headers.loginToken ? req.headers.loginToken : req.headers.logintoken;
  const users = req.body;
  if (!users) {
    dispatchErr(res, ['Users not defined']);
    return;
  }

  checkLoginToken(UserLogins, loginToken)
    .then(async (self) => {
      const usersPromises = users.map(user => Users.findOne({
        where: { userId: user },
        attributes: ['userId', 'firstName', 'lastName', 'picture', 'gender'],
      }));
      const fetchedUsers = await Promise.all(usersPromises);
      dispatchSuc(res, fetchedUsers);
    })
    .catch(err => dispatchErr(res, err));
};

// /users/:id (PUT) route
const editProfile = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const queries = req.query;
  const picture = req.body !== undefined ? req.body.picture : undefined;
  const pictureUrl = req.body !== undefined ? req.body.pictureUrl : undefined;
  const socialUrl = req.query.socialUrl;
  // Encrypt password (if present)
  const preparePass = newInfo => new Promise(
    (resolve, reject) => {
      if (newInfo.encPassword === undefined) {
        resolve(newInfo);
      } else {
        cryptPass(newInfo.encPassword)
          .then((encPass) => {
            newInfo.encPassword = encPass;
            resolve(newInfo);
          })
          .catch(err => reject([err]));
      }
    },
  );

  // The Promises chain firstly validates the loginToken then
  // checks that the logged user is actually trying to edit itself
  // and not others. If all of the Promises above get resolved
  // the query parameters are parsed and the User is updated
  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      Users.findOne({
        where: {
          email: queries.email,
          userId: {
            $ne: self,
          },
        },
      })
        .then((result) => {
          if (result) {
            dispatchErr(res, ['User with same email exists']);
          } else {
            prepareInput(queries)
              .then((newInfo) => {
                preparePass(newInfo)
                  .then((newInfo) => {
                    if (pictureUrl !== undefined) {
                      newInfo.picture = pictureUrl;
                      return updateUser(Users, self, newInfo);
                      // .then((result) => getUser(loginToken, self, res))
                      // .catch((err) => dispatchErr(res, err))
                    }
                    // picture !== undefined ?
                    if (picture) {
                      return uploadPicture(picture, self, newInfo)
                        .then(newInfo => updateUser(Users, self, newInfo),
                          // .then((result) => getUser(loginToken, self, res))
                          // .catch((err) => dispatchErr(res, err)))
                        );
                      // .catch((err) => dispatchErr(res, err))
                    }
                    return updateUser(Users, self, newInfo);
                    // .then((result) => getUser(loginToken, self, res))
                    // .catch((err) => dispatchErr(res, err))
                  })
                  .then(() => {
                    if (socialUrl) {
                      return UserSocialNetworkAccounts.findById(self)
                        .then((socialAccount) => {
                          if (socialAccount) {
                            socialAccount.socialUrl = socialUrl;
                            return socialAccount.save();
                          }
                        });
                    }
                  })
                  .then(() => getUser(loginToken, self, res))
                  .catch(err => dispatchErr(res, err));
              })
              .catch(err => dispatchErr(res, err));
          }
        })
        .catch((err) => {
          dispatchErr(res, err);
        });
    })
    .catch(err => dispatchErr(res, err));
};

// /users/{:id}/car (PUT) route
const editcar = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const rawEditCar = req.body;
  rawEditCar.userId = req.params.id;
  const carId = rawEditCar.carId === undefined
    ? dispatchErr(res, ['Car id is required']) : rawEditCar.carId;
  rawEditCar.status = 'active';


  // check the user is the owner of the car
  const checkCarOwner = () => {
    new Promise(
      (resolve, reject) => {
        UserCars.findOne({
          attributes: ['userId', 'status'],
          where: {
            userId: rawEditCar.userId,
            id: carId,
          },
        })
          .then((carOwner) => {
            if (carOwner === null) {
              dispatchErr(res, ['you are not the owner of this car ']);
              return;
              // reject(["you are not the owner of this car"])
            } if (carOwner.status == 'deleted') {
              dispatchErr(res, ['This car is deleted']);
              return;
            }

            prepareInput(rawEditCar).then((editcar) => {
              console.log(editcar);
              const where = {
                where: {
                  id: carId,
                },
              };
              UserCars.update(editcar, where)
                .then(() => {
                  UserCars.findOne({
                    where: {
                      id: carId,
                    },
                  })
                    .then((result => dispatchSuc(res, result)))
                    .catch(err => dispatchErr(res, [err.message]));
                })
                .catch(err => dispatchErr(res, [err.message]));
            }).catch(err => dispatchErr(res, err));
          }).catch(err => reject([err]));
      },
    );
  };

  checkLoginToken(UserLogins, loginToken)
    .then((loggedUserId) => {
      checkPermissions(loggedUserId, rawEditCar.userId)
        .then(() => checkCarOwner())
        .catch(err => dispatchErr(res, err));
    })
    .catch(err => dispatchErr(res, err));
};

// /users/{:id}/car (Delete) route
const deleteCar = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const carId = req.body.carId === undefined ? dispatchErr(res, ['CarId is required']) : req.body.carId;

  // check car owner and is the car in active (ride || regular ride )
  const checkCarOwner = (userId) => {
    new Promise(
      (resolve, reject) => {
        UserCars.findOne({
          attributes: ['userId', 'status'],
          where: {
            userId,
            id: carId,
          },
        })
          .then((carOwner) => {
            if (carOwner === null) {
              dispatchErr(res, ['you are not the owner of this car ']);
              // reject(["you are not the owner of this car"])
              return;
            } if (carOwner.status == 'deleted') {
              dispatchErr(res, ['This car is deleted']);
              return;
            }

            // do the logic about delete car
            Rides.count({
              where: {
                driver: userId,
                carId,
                $or: [{
                  status: null,
                }, {
                  $and: [{
                    status: {
                      $ne: 'deleted',
                    },
                  }, {
                    status: {
                      $ne: 'cancelled',

                    },
                  }, {
                    status: {
                      $ne: 'finished',
                    },
                  }],
                }],
              },
            }).then((count1) => {
              RegularRide.count({
                where: {
                  driver: userId,
                  carId,
                  $or: [{
                    status: null,
                  }, {
                    $and: [{
                      status: {
                        $ne: 'deleted',
                      },
                    }, {
                      status: {
                        $ne: 'cancelled',

                      },
                    }, {
                      status: {
                        $ne: 'finished',
                      },
                    }],
                  }],
                },
              }).then((count2) => {
                const count = count1 + count2;
                if (count == 0) {
                  const editcar = {
                    status: 'deleted',
                  };
                  const where = {
                    where: {
                      id: carId,
                    },
                  };
                  UserCars.update(editcar, where)
                    .then(() => dispatchSuc(res, []))
                    .catch(err => dispatchErr(res, [err.message]));
                } else {
                  dispatchErr(res, ['This car is used in active rides']);
                }
              }).catch(err => dispatchErr(res, err));
            }).catch(err => dispatchErr(res, err));
          }).catch(err => dispatchErr(res, err));
      },
    );
  };


  checkLoginToken(UserLogins, loginToken)
    .then(loggedUserId => checkCarOwner(loggedUserId)).catch(err => dispatchErr(res, err));
};

// /users/{:id}/car (POST) route
const addCar = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const rawNewCar = req.body;
  rawNewCar.userId = req.params.id;

  // set status of car to active
  rawNewCar.status = 'active';

  // required params
  if (rawNewCar.maker == undefined) {
    return dispatchErr(res, ['maker is required']);
  }
  if (rawNewCar.model == undefined) {
    return dispatchErr(res, ['model is required']);
  }
  if (rawNewCar.colorName == undefined) {
    return dispatchErr(res, ['colorName is required']);
  }
  if (rawNewCar.colorCode == undefined) {
    return dispatchErr(res, ['colorCode is required']);
  }
  if (rawNewCar.plateNumber == undefined) {
    return dispatchErr(res, ['plateNumber is required']);
  }
  checkLoginToken(UserLogins, loginToken)
    .then((loggedUserId) => {
      checkPermissions(loggedUserId, rawNewCar.userId)
        .then(() => prepareInput(rawNewCar)
          .then((newCar) => {
            newCar.id = createUuid();
            UserCars.create(newCar)
              .then(result => dispatchSuc(res, result))
              .catch(err => dispatchErr(res, err));
          })
          .catch(err => dispatchErr(res, err)))
        .catch(err => dispatchErr(res, err));
    })
    .catch(err => dispatchErr(res, err));
};

// /users/{:id}/ridealerts (POST) route
const addRideAlert = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const rawNewAlert = req.body;
  rawNewAlert.userId = req.params.id;
  rawNewAlert.from = req.body.from === undefined
    ? dispatchErr(res, ['No from passed'])
    : req.body.from;
  rawNewAlert.to = req.body.to === undefined
    ? dispatchErr(res, ['No to passed'])
    : req.body.to;
  const days = req.body.days === undefined || req.body.days === null || req.body.days.length == 0
    ? dispatchErr(res, ['No days passed'])
    : req.body.days;
  // This Promises chain validates loginToken, then
  // prepares the input, validates the locations and
  // their diversity, then eventually creates the ride alert
  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      checkPermissions(self, rawNewAlert.userId)
        .then(() => {
          prepareInput(rawNewAlert)
            .then((newAlert) => {
              newAlert.id = createUuid();
              newAlert.creationDate = Date.now();
              newAlert.status = 'verified';
              getOrAddLocations(newAlert.from, newAlert.to)
                .then((results) => {
                  if (results[0] == undefined || results[1] == undefined) dispatchErr(res, 'Can not find location of from or to');
                  newAlert.fromId = results[0].id;
                  newAlert.toId = results[1].id;
                  checkLocations(Locations, newAlert)
                    .then(newAlert => RideAlerts.create(newAlert)
                      .then(() => {
                        // insert ride alert days in RideAlertsDays table
                        const alertDays = [];
                        for (let i = 0; i < days.length; i++) {
                          alertDays.push({
                            rideAlertId: newAlert.id,
                            day: days[i],
                          });
                        }
                        RideAlertsDays.bulkCreate(alertDays)
                          .then(() => {
                            eventEmitter.emit('RideAlertCreated', newAlert, days, results[0], results[1])
                            dispatchSuc(res, null)
                          }).catch(err => dispatchErr(res, err));
                      })
                      .catch(err => dispatchErr(res, err)))
                    .catch(err => dispatchErr(res, err));
                })
                .catch(err => dispatchErr(res, err));
            })
            .catch(err => dispatchErr(res, err));
        })
        .catch(err => dispatchErr(res, err));
    })
    .catch(err => dispatchErr(res, err));
};

// /users/{:id}/ridealert (DELETE) route
const removeRideAlert = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;
  const alertId = req.body.alertId;
  // This Promises chain validates loginToken and then
  // proceeds to check if the user has a ride alert,
  // if so it deletes it
  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then(() => getAndAction({
        userId,
        alertId,
      }, 'delete', self)
        .then(() => dispatchSuc(res, null))
        .catch(err => dispatchErr(res, err)))
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// /users/{:id}/ridealert (PUT) route
const editRideAlert = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;
  const rawNewAlert = req.body;
  rawNewAlert.alertId = req.body.alertId === undefined
    ? dispatchErr(res, ['No alertId'])
    : req.body.alertId;
  rawNewAlert.from = req.body.from;
  rawNewAlert.to = req.body.to;
  if ((rawNewAlert.from !== undefined && rawNewAlert.to === undefined)
		|| (rawNewAlert.from === undefined && rawNewAlert.to !== undefined)) {
    dispatchErr(res, ['Both from and to locations must be sent or not']);
    return;
  }
  const locSent = (rawNewAlert.from !== undefined && rawNewAlert.to !== undefined);
  days = req.body.days !== undefined && req.body.days !== null && req.body.days.length == 0
    ? dispatchErr(res, ['No days passed'])
    : req.body.days;

  // Prepares the input and checks the locations
  // for existance and diversity
  const prepareAndCheck = (self, rawNewAlert) => new Promise(
    (resolve, reject) => {
      locSent == true
        ? getOrAddLocations(rawNewAlert.from, rawNewAlert.to)
          .then((results) => {
            rawNewAlert.fromId = results[0].id;
            rawNewAlert.toId = results[1].id;
            Promise.all([prepareInput(rawNewAlert), checkLocations(Locations, rawNewAlert)])
              .then(newAlert => resolve([self, newAlert[0]]))
              .catch(err => reject(err));
          })
          .catch(err => reject(err))
        : prepareInput(rawNewAlert)
          .then(newAlert => resolve([self, newAlert]))
          .catch(err => reject(err));
    },
  );

  // This Promises chain validates loginToken, then
  // prepares the input, validates the locations and
  // their diversity, then eventually edits the ride alert
  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then(() => prepareAndCheck(self, rawNewAlert)
        .then((results) => {
          const rawNewAlert = results[1];
          rawNewAlert.userId = userId;
          getAndAction(rawNewAlert, 'update', results[0])
            .then(() => dispatchSuc(res, null))
            .catch(err => dispatchErr(res, err));
        })
        .catch(err => dispatchErr(res, err)))
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// Shared method that checks ride alert existance, property and
// eventually updates or deletes it
let getAndAction = (newRideAlert, action, userId) => new Promise(
  (resolve, reject) => {
    RideAlerts.findOne({
      where: {
        id: newRideAlert.alertId,
      },
    })
      .then((rideAlert) => {
        if (rideAlert === null) {
          reject(['Invalid ride alert']);
          return;
        }
        if (userId !== rideAlert.userId) {
          reject(['Permission denied']);
          return;
        }
        if (action === 'update') {
          rideAlert.update(newRideAlert)
            .then(() => {
              if (newRideAlert !== null && newRideAlert.days !== undefined) {
                // remove old days
                RideAlertsDays.destroy({
                  where: {
                    rideAlertId: newRideAlert.alertId,
                  },
                })
                  .then(() => {
                    // insert the new days
                    const alertDays = [];
                    for (let i = 0; i < newRideAlert.days.length; i++) {
                      alertDays.push({
                        rideAlertId: newRideAlert.alertId,
                        day: newRideAlert.days[i],
                      });
                    }
                    RideAlertsDays.bulkCreate(alertDays)
                      .then(() => {
                        resolve();
                      }).catch(err => reject([err.message]));
                  }).catch(err => reject([err.message]));
              } else {
                resolve();
              }
            })
            .catch(err => reject([err.message]));
        } else {
          rideAlert.update({
            status: 'deleted',
          })
            .then(() => resolve())
            .catch(err => reject([err.message]));

          AlertMatch.destroy({
            where: {
              ride_alert_id: rideAlert.id,
            },
          }).then(() => {}).catch(err => {})
        }
      })
      .catch(err => reject(err.message));
  },
);

// getRegularRide By id
const getRideAlertById = rideAlertId => new Promise((resolve, reject) => RideAlerts.findById(rideAlertId, {
  include: [{
    model: Users,
    as: 'user',
    attributes: ['userId', 'firstName', 'lastName', 'picture', 'gender', 'ridesWith'],
    include: [],
  },
  {
    model: Locations,
    as: 'from',
  },
  {
    model: Locations,
    as: 'to',
  },
  ],
}).then((rideAlert) => {
  if (rideAlert === null) {
    reject(['rideAlertId is invalid']);
  }

  RideAlertsDays.findAll({
    where: {
      rideAlertId: rideAlert.id,
    },
  })
    .then((days) => {
      // set ride alert days
      const daysArr = [];
      if (days != null) {
        for (let i = 0; i < days.length; i++) {
          daysArr.push(parseInt(days[i].day));
        }
      }
      rideAlert.set('days', daysArr, { raw: true });
      if (!rideAlert.days) {
        rideAlert.days = daysArr;
      }
      return GroupUsers.findOne({
        where: {
          userId: rideAlert.userId,
          status: 'verified',
        },
        order: 'createdAt ASC',
        include: [{
          model: Groups,
          required: false,
          // as: 'group',
          attributes: ['id', 'name', 'icon'],
          // include: []
        }],
      });

      // then resolve
      // resolve(rideAlert)
    })
    .then((groupUser) => {
      // console.log(groupUser);
      rideAlert.set('group', (groupUser) ? groupUser.Group : null, { raw: true });
      resolve(rideAlert);
    })
    .catch((err) => { console.error(err); reject([err.message]); });
}).catch((err) => {
  console.log(err);
  reject([err]);
}));

// /users/{:id}/ridealerts route
const getRideAlerts = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;
  const limit = req.query.limit == undefined ? 10 : parseInt(req.query.limit);
  const offset = req.query.offset == undefined ? 0 : parseInt(req.query.offset);

  const getData = () => new Promise(
    (resolve, reject) => {
      RideAlerts.findAll({
        where: {
          userId,
          status: 'verified',
        },
        limit,
        offset,
        order: 'creationDate DESC',
      })
        .then((rideAlerts) => {
          if (rideAlerts == null) {
            resolve([]);
          } else {
            const promises = [];
            for (let i = 0; i < rideAlerts.length; i++) {
              (function (i) {
                promises.push(getRideAlertById(rideAlerts[i].id));
              }(i));
            }
            const r = Q.all(promises).then((rideAlertsArr) => {
              resolve(rideAlertsArr);
            }).catch(err => reject([err.message]));
          }
        })
        .catch(err => reject(err));
    },
  );

  // This Promises chain validates loginToken, then
  // gets all the ride alerts where the user is the owner of it with some filteration
  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then((self) => {
        getData()
          .then(results => dispatchSuc(res, results))
          .catch(err => dispatchErr(res, err));
      })
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// /users/{:id}/regularrides route
const getRegularRides = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;
  const limit = req.query.limit == undefined ? 10 : parseInt(req.query.limit);
  const offset = req.query.offset == undefined ? 0 : parseInt(req.query.offset);

  const getData = () => new Promise(
    (resolve, reject) => {
      RegularRide.findAll({
        where: {
          driver: userId,
          $and: [{
            status: {
              $ne: 'deleted',
            },
          }, {
            status: {
              $ne: 'cancelled',

            },
          }],
        },
        limit,
        offset,
        order: 'time ASC',
      })
        .then((regularRides) => {
          if (regularRides == null) {
            resolve([]);
          } else {
            const promises = [];
            for (let i = 0; i < regularRides.length; i++) {
              (function (i) {
                promises.push(getRegularRideById(regularRides[i].id));
              }(i));
            }
            const r = Q.all(promises).then((regularRidesArr) => {
              resolve(regularRidesArr);
            }).catch(err => reject([err.message]));
          }
        })
        .catch(err => reject(err));
    },
  );

  // This Promises chain validates loginToken, then
  // gets all the regular rides where the user is the driver with some filteration
  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then((self) => {
        getData()
          .then(results => dispatchSuc(res, results))
          .catch(err => dispatchErr(res, err));
      })
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// get user notifications
const getNotifications = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;
  const limit = (req.query.limit === undefined) || (req.query.limit === null) ? 10 : req.query.limit;
  const offset = req.query.offset;


  checkLoginToken(UserLogins, loginToken)
    .then((loggedUserId) => {
      checkPermissions(loggedUserId, userId)
        .then(() => {
          const notificationsQuery = {
            attributes: ['id', 'userId', 'type', 'message', 'data', 'timestamp'],
            where: {
              $or: [{
                userid: userId,
              }, {
                userId: null,
              }],
            },
            order: 'timestamp DESC',
          };

          // add limit & offset
          if (limit !== undefined) notificationsQuery.limit = parseInt(limit);
          if (offset !== undefined) notificationsQuery.offset = parseInt(offset);

          Notifications.findAll(notificationsQuery)
            .then((notifications) => {
              dispatchSuc(res, notifications);
            }).catch(err => dispatchErr(res, err));
        }).catch(err => dispatchErr(res, err));
    }).catch(err => dispatchErr(res, err));
};

const getUserRidesInfo = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;

  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then(self => RegularRide.count({
        where: {
          driver: userId,
          status: 'verified',
        },
        include: [{
          model: RegularRideDays,
          required: true,
        }],
      })
        .then((count) => {
          const resultObj = {
            hasRegularRides: count > 0,
          };
          dispatchSuc(res, resultObj);
        })
        .catch(err => dispatchErr(res, [err.message])))
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// /users/{:userId}/rides (with any status)
const getRides = (req, res, next) => {
  // check status to forward to suitable function
  if (req.query.status == 'finished') {
    pastRides(req, res, next);
  } else {
    planRides(req, res, next);
  }
};

// /users/{:userId}/rides
let planRides = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;

  // prepare params
  let limit = req.query.limit == undefined ? 10 : req.query.limit;
  limit = parseInt(limit);
  let offset = req.query.offset == undefined ? 0 : req.query.offset;
  offset = parseInt(offset);
  let week = req.query.week;
  if (week !== undefined) {
    week = parseInt(week);
  }

  const getRides = () => new Promise(
    (resolve, reject) => {
      // prepare const & vars
      const timestamp = new Date().getTime();

      // prepare the query
      // rides query
      let query = `SELECT id, dateTime FROM Rides
								WHERE (status IS NULL OR (status != 'finished' AND status != 'cancelled'))
								AND driver = '${userId}'
								AND (
									(
										NOT EXISTS (SELECT id FROM RideRiders WHERE rideId = Rides.id AND (status = 'accepted' OR status = 'started'))
										AND dateTime >= ${timestamp}
									)
									OR (
										EXISTS (SELECT id FROM RideRiders WHERE rideId = Rides.id AND (status = 'accepted' OR status = 'started'))
									)
								)
                UNION ALL`;

      // ride riders query
      query += ` SELECT RideRiders.rideId, Rides.dateTime FROM RideRiders
                INNER JOIN Rides ON rideId = Rides.id AND (Rides.status IS NULL OR Rides.status != 'cancelled')
								WHERE userId = '${userId}'
								AND (
									(
										RideRiders.status = 'accepted' OR RideRiders.status = 'started'
									)
									OR (
										(RideRiders.status IS NULL OR (RideRiders.status != 'finished'))
										AND Rides.dateTime >= ${timestamp}
									)
								)
								ORDER BY dateTime ASC LIMIT ${limit} OFFSET ${offset}`;

      // execute the query
      sequelize.query(query, {
        type: Sequelize.QueryTypes.SELECT,
      })
        .then((rides) => {
          // prepare result object
          const resultObj = {
            originalCount: 0,
            rides: [],
          };

          // check if null, create empty one
          if (rides == null) {
            resolve(resultObj);
            return;
          }

          // prepare final rides list
          const promises = [];
          for (let i = 0; i < rides.length; i++) {
            (function (i) {
            // add the get ride by id promise
              promises.push(getRideById(rides[i].id));
            }(i));
          }
          
          Q.all(promises)
            .then((result) => {
              resolve(promises);
            })
            .catch(err => reject([err.message]));
        })
        .catch(err => reject(err.message));
    },
  );

  const getRidesWithRegularRides = () => new Promise(
    (resolve, reject) => {
      const getTheRides = () => new Promise(
        (resolve, reject) => {
          // prepare const & vars
          const timestamp = new Date().getTime();
          const baseDate = new Date();
          if (week > 0) {
            var newDate = baseDate.getDate() + ((7 * week) - getWeekDayIndex(baseDate.toDateString()));
            baseDate.setDate(newDate);
          }
          var newDate = baseDate.getDate() + (7 - getWeekDayIndex(baseDate.toDateString()) - 1);
          const maxDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), newDate);

          // prepare the query
          // rides query
          let query = `SELECT id, date, time, dateTime, -1 AS day, false AS isRegularRide FROM Rides
														WHERE (status IS NULL OR (status != 'finished' AND status != 'cancelled'))
														AND driver = '${userId}'
														AND (
															(
																NOT EXISTS (SELECT id FROM RideRiders WHERE rideId = Rides.id AND (status = 'accepted' OR status = 'started'))
																AND date >= '${formatDate(baseDate)}' AND date <= '${formatDate(maxDate)}'
																AND dateTime >= ${timestamp}
															)
															OR (
																EXISTS (SELECT id FROM RideRiders WHERE rideId = Rides.id AND (status = 'accepted' OR status = 'started'))
															)
														)
                            UNION ALL`;

          // regular rides query
          query += ` SELECT RegularRide.id, DATE_ADD('${formatDate(baseDate)}', INTERVAL day - ${getWeekDayIndex(baseDate)} DAY) AS date, RegularRide.time,
                            UNIX_TIMESTAMP(CONCAT(DATE_FORMAT(DATE_ADD('${formatDate(baseDate)}', INTERVAL day - ${getWeekDayIndex(baseDate)} DAY), '%Y-%m-%d'), ' ', time)) * 1000 AS dateTime, RegularRideDays.day, true AS isRegularRide FROM RegularRide
                            INNER JOIN RegularRideDays ON RegularRide.id = RegularRideDays.regularRideId
                            WHERE (RegularRide.status IS NULL OR (RegularRide.status != 'finished' AND RegularRide.status != 'deleted'))`;
          if (isToday(baseDate)) {
            query += ` AND (day > ${getWeekDayIndex(baseDate)} OR (day = ${getWeekDayIndex(baseDate)} AND time >= '${getCurrentTime()}'))`;
          } else if (week == 0) {
            query += ` AND day > ${getWeekDayIndex(baseDate)}`;
          }
          query += ` AND NOT EXISTS (SELECT id FROM Rides WHERE regularRideId = RegularRide.id AND date = DATE_ADD('${formatDate(baseDate)}', INTERVAL day - ${getWeekDayIndex(baseDate)} DAY))
                            AND driver = '${userId}'
                            UNION ALL`;

          // ride riders query
          query += ` SELECT RideRiders.rideId, Rides.date, Rides.time, Rides.dateTime, -1 AS day, false AS isRegularRide FROM RideRiders
                            INNER JOIN Rides ON rideId = Rides.id AND (Rides.status IS NULL OR Rides.status != 'cancelled')
														WHERE userId = '${userId}'
														AND (
															(
																RideRiders.status = 'accepted' OR RideRiders.status = 'started'
															)
															OR (
																(RideRiders.status IS NULL OR (RideRiders.status != 'finished'))
																AND Rides.date >= '${formatDate(baseDate)}' AND Rides.date <= '${formatDate(maxDate)}' AND dateTime >= ${timestamp}
															)
														)
														ORDER BY dateTime ASC LIMIT ${limit} OFFSET ${offset}`;

          // execute the query
          sequelize.query(query, {
            type: Sequelize.QueryTypes.SELECT,
          })
            .then((rides) => {
              // prepare result object
              const resultObj = {
                originalCount: 0,
                rides: [],
              };

              // check if null, create empty one
              if (rides == null) {
                resolve(resultObj);
                return;
              }

              // prepare final rides list
              const promises = [];
              for (let i = 0; i < rides.length; i++) {
                (function (i) {
                // add the get ride promise
                  promises.push(getRide(rides[i]));
                }(i));
              }
              Q.all(promises)
                .then((result) => {
                  resolve(promises);
                })
                .catch(err => reject([err.message]));
            })
            .catch(err => reject(err.message));
        },
      );

      let getRide = rideObj => new Promise((resolve, reject) => {
        // check isRegularRide flag
        if (!rideObj.isRegularRide) {
          // normal ride,
          // get the ride and resolve
          getRideById(rideObj.id)
            .then(ride => resolve(ride))
            .catch(err => reject([err.message]));
        } else {
          // regualr ride,
          // get the final ride object of this regular ride and resolve
          getRegularRideById(rideObj.id)
            .then((regularRide) => {
              const convertedObj = convertRegularRideToRide(regularRide, rideObj.date);
              resolve(convertedObj);
            })
            .catch(err => reject([err.message]));
        }
      });


      getTheRides()
        .then(rides => resolve(rides))
        .catch(err => reject([err.message]));
    },
  );


  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then(() => {
        // check week if sent
        if (week === undefined) {
          // get normal rides
          getRides()
            .then(rides => dispatchSuc(res, rides))
            .catch(err => dispatchErr(res, err));
        } else {
          // get rides with regular rides
          getRidesWithRegularRides()
            .then(rides => dispatchSuc(res, rides))
            .catch(err => dispatchErr(res, err));
        }
      })
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};


// /users/{:userId}/rides?status=finished
let pastRides = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;

  // prepare params
  let limit = req.query.limit == undefined ? 10 : req.query.limit;
  limit = parseInt(limit);
  let offset = req.query.offset == undefined ? 0 : req.query.offset;
  offset = parseInt(offset);

  const getData = () => new Promise(
    (resolve, reject) => {
      // prepare const & vars
      const timestamp = new Date().getTime();

      // prepare the query
      // rides query
      let query = `SELECT id, dateTime FROM Rides
                WHERE status = 'finished'
                AND driver = '${userId}'
                UNION ALL`;

      // ride riders query
      query += ` SELECT RideRiders.rideId, Rides.dateTime FROM RideRiders
                INNER JOIN Rides ON rideId = Rides.id
                WHERE userId = '${userId}'
                AND RideRiders.status = 'finished'
                ORDER BY dateTime DESC LIMIT ${limit} OFFSET ${offset}`;

      // execute the query
      sequelize.query(query, {
        type: Sequelize.QueryTypes.SELECT,
      })
        .then((rides) => {
          // prepare result object
          const resultObj = {
            originalCount: 0,
            rides: [],
          };

          // check if null, create empty one
          if (rides == null) {
            resolve(resultObj);
            return;
          }

          // prepare final rides list
          const promises = [];
          for (let i = 0; i < rides.length; i++) {
            (function (i) {
            // add the get ride by id promise
              promises.push(getRideById(rides[i].id));
            }(i));
          }
          Q.all(promises)
            .then((result) => {
              resolve(promises);
            })
            .catch(err => reject([err.message]));
        })
        .catch(err => reject(err.message));
    },
  );


  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then(() => {
        getData()
          .then(rides => dispatchSuc(res, rides))
          .catch(err => dispatchErr(res, err));
      })
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// /users/{:userId}/regularandalerts
const getRegularAndAlerts = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;
  const limit = req.query.limit ? parseInt(req.query.limit) : 10;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;

  const getData = () => new Promise(
    (resolve, reject) => {
      const getTheData = () => new Promise(
        (resolve, reject) => {
          // prepare the query
          // regular rides query
          let query = `SELECT id, creationDate, 'regular_ride' AS type FROM RegularRide
                            WHERE status = 'verified' AND driver = '${userId}'
                            UNION ALL`;

          // ride alerts query
          query += ` SELECT id, creationDate, 'ride_alert' AS type FROM RideAlerts
													WHERE status = 'verified' AND userId = '${userId}'
													ORDER BY creationDate DESC LIMIT ${limit} OFFSET ${offset}`;

          // execute the query
          sequelize.query(query, {
            type: Sequelize.QueryTypes.SELECT,
          })
            .then((data) => {
              // check data and resolve if required
              if (!data) {
                resolve([]);
              }

              // prepare final data list
              const promises = [];
              for (let i = 0; i < data.length; i++) {
                (function (i) {
                // add the get data item promise
                  promises.push(getDataItemPromise(data[i]));
                }(i));
              }
              Q.all(promises)
                .then((result) => {
                  resolve(promises);
                })
                .catch(err => reject([err.message]));
            })
            .catch(err => reject(err.message));
        },
      );

      let getDataItemPromise = dataItem => new Promise((resolve, reject) => {
        // check type
        if (dataItem.type === 'regular_ride') {
          // regular ride,
          // get the regular ride and convert it to regular alert and resolve
          getRegularRideById(dataItem.id)
            .then((regularRide) => {
              const dataObj = convertToRegularAlert(regularRide, dataItem.type);
              resolve(dataObj);
            })
            .catch(err => reject([err.message]));
        } else {
          // ride alert,
          // get the ride alert and convert it to regular alert and resolve
          getRideAlertById(dataItem.id)
            .then((rideAlert) => {
              const dataObj = convertToRegularAlert(rideAlert, dataItem.type);
              resolve(dataObj);
            })
            .catch(err => reject([err.message]));
        }
      });


      getTheData()
        .then(rides => resolve(rides))
        .catch(err => reject([err.message]));
    },
  );


  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then(() => {
        getData()
          .then(rides => dispatchSuc(res, rides))
          .catch(err => dispatchErr(res, err));
      })
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// /users/{:id}/connectfacebook (POST) route
const connectFacebook = (req, res, next) => {
  // get params
  const userId = req.params.id;
  const loginToken = req.headers.logintoken;
  const socialUserId = req.body.socialUserId;
  const socialAuthToken = req.body.socialAuthToken;
  const socialUrl = req.body.socialUrl;

  // Validates params
  const validateParams = () => new Promise(
    (resolve, reject) => {
      if (!socialUserId) {
        reject(['socialUserId is required']);
      } else if (!socialAuthToken) {
        reject(['socialAuthToken is required']);
      } else {
        resolve();
      }
    },
  );

  // Checks if sent social auth token is valid
  const isValidAuthToken = () => new Promise(
    (resolve, reject) => {
      // prepare the url
      let fbUrl = 'https://graph.facebook.com/debug_token';
      fbUrl += `?input_token=${socialAuthToken}&access_token=${fbAppId}|${fbAppSecret}`;

      // send the facebook graph request
      request(fbUrl)
        .then((body) => {
          const data = JSON.parse(body).data;
          if (data.error) {
            // Malformed access token
            reject([data.error.message]);
          }
          checkUserConsistency(socialUserId, data.user_id)
            ? resolve()
            : reject(['Invalid access token']);
        })
        .catch(err => reject([err.message]));
    },
  );

  // Checks and ensures that the social user id is not linked to another account
  const validateSocialUserId = () => new Promise(
    (resolve, reject) => {
      UserSocialNetworkAccounts.findOne({
        where: {
          accountKey: 'FB_ACC',
          accountUsername: socialUserId,
          userId: {
            $ne: userId,
          },
        },
      })
        .then((socialAccount) => {
          if (socialAccount) {
            reject(['Sorry, this facebook account is already linked to another profile']);
          } else {
            resolve();
          }
        })
        .catch(err => reject([err.message]));
    },
  );

  // updates the social url if exists and the user already has facebook profiel,
  // or creates new user social network accoutn record
  const connectFacebook = () => new Promise(
    (resolve, reject) => {
      // find the user social account
      UserSocialNetworkAccounts.findOne({
        where: {
          userId,
          accountKey: 'FB_ACC',
          accountUsername: socialUserId,
        },
      })
        .then((socialAccount) => {
          // check if already have social account
          if (socialAccount) {
            // check the social url to update it
            if (socialUrl) {
              // update it
              socialAccount.socialUrl = socialUrl;
              socialAccount.save()
                .then(() => resolve())
                .catch(err => reject([err.message]));
            } else {
              // social url is not found, just resolve
              resolve();
            }
          } else {
            UserSocialNetworkAccounts.create({
              userId,
              accountKey: 'FB_ACC',
              accountUsername: socialUserId,
              socialUrl,
            })
              .then(() => resolve())
              .catch(err => reject([err.message]));
          }
        })
        .catch(err => reject([err.message]));
    },
  );

  validateParams()
    .then(() => checkLoginToken(UserLogins, loginToken)
      .then(self => checkPermissions(self, userId)
        .then(() => isValidAuthToken()
          .then(() => validateSocialUserId()
            .then(() => connectFacebook()
              .then(() => getUser(loginToken, userId, res)).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err));
};

// /users/balance/details
const userBalanceDetails = (req, res) => {
  const loginToken = req.headers.logintoken || req.headers.loginToken;
  let userId;
  // UserLogins.findOne({
  // 	where: {
  // 		loginToken
  // 	}
  // })
  checkLoginToken(UserLogins, loginToken)
    .then((userId) => {
      const promiseArray = [];
      promiseArray.push(calculateBalance(userId));
      promiseArray.push(UserTransactions.sum('amount', { where: { userId, status: 'pending' } }));
      promiseArray.push(UserTransactions.sum('amount', { where: { userId, status: 'successful', sourceType: 'rideRevenue' } }));
      return Promise.all(promiseArray);
    })
    .then((resolved) => {
      const total = resolved[0] || 0;
      const pending = Math.abs(resolved[1]) || 0;
      const earning = resolved[2] || 0;
      const promocodes = 0;
      const actual = total - pending - earning - promocodes;

      const details = {
        total,
        actual,
        pending: pending * -1,
        earning,
        promocodes,
      };
      dispatchSuc(res, details);
    })
    .catch((err) => {
      dispatchErr(res, err);
    });
};

const resetPassword = async (req, res, next) => {
  const token = req.body.token;
  const newPassword = req.body.password;
  try {
    user = await Users.findOne({
      where: {
        passwordResetToken: token,
      },
    });

    if (user === null || user === undefined) {
      dispatchErr(res, ['Invalid password reset token']);
      return;
    }

    encryptedPassword = await cryptPass(newPassword);

    await user.updateAttributes({
      encPassword: encryptedPassword,
    });

    await UserLogins.destroy({
      where: {
        userId: user.userId,
      },
    });

    dispatchSuc(res, []);
  } catch (err) {
    console.error(err);
    dispatchErr(res, ['Unable to process your request, if the issue persists, please contact our support']);
  }
};

const requestResetPassword = async (req, res, next) => {
  const email = req.body.email;
  if (email === undefined || email === null || email === '') {
    dispatchErr(res, ['Email missing']);
    return;
  }

  // generate random 6 character string
  const token = Math.random().toString(36).substring(2, 8);
  mailBody = getResetPasswordMail(token);
  try {
    user = await Users.findOne({
      where: {
        email,
      },
    });

    if (user === null || user === undefined) {
      dispatchErr(res, ['User not found']);
      return;
    }

    await user.updateAttributes({
      passwordResetToken: token,
    });

    // client mail options
    const mailOptions = {
      from: '"Foorera Support" <support@foorera.com>',
      to: email,
      subject: 'Foorera Password Reset',
      html: mailBody,
    };

    // send and resolve
    transporter.sendMail(mailOptions);

    dispatchSuc(res, []);
  } catch (err) {
    console.error(err);
    dispatchErr(res, ['Unable to process your request, if the issue persists, please contact our support']);
  }
};

const changePassword = async (req, res, next) => {
  const loginToken = req.headers.logintoken || req.headers.loginToken;
  const email = req.body.email;
  const password = req.body.password;
  const newPassword = req.body.newPassword;

  try {
    userId = await checkLoginToken(UserLogins, loginToken);
    if (userId === null || userId === undefined) {
      dispatchErr(res, ['Invalid login']);
      return;
    }
    user = await User.findOne({
      where: {
        userId,
      },
    });

    if (user === null || user === undefined) {
      dispatchErr(res, ['Invalid login']);
      return;
    }

    if (user.email !== email) {
      dispatchErr(res, ['Invalid login']);
      return;
    }

    try {
      await comparePass(password, user.encPassword);
    } catch (err) {
      dispatchErr(res, ['Wrong password']);
      return;
    }

    encryptedPassword = await cryptPass(newPassword);

    await user.updateAttributes({
      encPassword: encryptedPassword,
    });

    await UserLogins.destroy({
      where: {
        userId: user.userId,
      },
    });

    dispatchSuc(res, []);
  } catch (err) {
    console.error(err);
    dispatchErr(res, ['Unable to process your request, if the issue persists, please contact our support']);
  }
};

module.exports = {
  profile,
  authenticateUser,
  fetchProfiles,
  editProfile,
  addCar,
  editcar,
  deleteCar,
  addRideAlert,
  removeRideAlert,
  editRideAlert,
  getRegularRides,
  getNotifications,
  getUserRidesInfo,
  getRideAlerts,
  getRideAlertById,
  getRides,
  planRides,
  pastRides,
  getRegularAndAlerts,
  connectFacebook,
  userBalanceDetails,
  resetPassword,
  requestResetPassword,
  changePassword,
};
