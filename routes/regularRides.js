var {
  sequelize, Sequelize, RegularRide, Locations, GroupUsers, UserCars, UserLogins, Groups, Users, Locations, RegularRideDays,
} = require('../models/index');
const {
  dispatchSuc, dispatchErr, checkLoginToken, validateTime, prepareInput, createUuid, checkLocations, removeDuplicates, checkUserVerification,
  dispatchErrContent, checkUserRidesOnDaysAndTime, validatePromoCode,
} = require('../tools/tools');
const { getOrAddLocations, getDistancBetweenCoordinates } = require('../tools/geocoding');
const Q = require('q');

const { eventEmitter } = require('../events')

// /regularrides route
const addRegularRide = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const rawNewRide = req.body;
  if (req.body.returnTime) var returnTime = req.body.returnTime;

  groupId = req.body.groupId;
  rawNewRide.from = req.body.from === undefined
    ? dispatchErr(res, ['No from passed'])
    : req.body.from;
  if (!rawNewRide.from.englishName) {
    dispatchErr(res, ['No name passed for from point']);
  }
  rawNewRide.to = req.body.to === undefined
    ? dispatchErr(res, ['No to passed'])
    : req.body.to;
  if (!rawNewRide.to.englishName) {
    dispatchErr(res, ['No name passed for to point']);
  }
  days = req.body.days === undefined || req.body.days === null || req.body.days.length == 0
    ? dispatchErr(res, ['No days passed'])
    : req.body.days;
  const { from, to } = req.body;
  const distanceBetweenCoordinates = getDistancBetweenCoordinates(parseFloat(from.lng), parseFloat(from.lat), parseFloat(to.lng), parseFloat(to.lat));
  if (distanceBetweenCoordinates < 1000) {
    return dispatchErr(res, ['Sorry, distance between pickup and dropoff location is less than 1 km']);
  }

  if ( ! rawNewRide.ride_alert_id) {
    rawNewRide.ride_alert_id = null;
  }

  // set the regular ride id
  rawNewRide.id = createUuid();

  // This Promises chain  prepares the input, validates the locations and
  // their diversity, then eventually creates the ride
  const checkLocation = (loggedUserId, groupId, carId) => new Promise(
    (resolve, reject) => {
      prepareInput(rawNewRide)
        .then((newRide) => {
          newRide.carId = carId;
          newRide.driver = loggedUserId;
          newRide.groupId = groupId;
          newRide.creationDate = Date.now();
          getOrAddLocations(rawNewRide.from, rawNewRide.to)
            .then((results) => {
              if (results[0] === undefined
                                    || results[1] === undefined) reject('Can not find location');
              newRide.fromId = results[0].id;
              newRide.toId = results[1].id;
              newRide.status = 'verified';
              checkLocations(Locations, newRide)
                .then((newRide) => {
                  checkPromoCode(groupId)
                    .then(() => {
                      RegularRide.create(newRide)
                        .then(() => {
                          newRide.locationFrom = results[0]
                          newRide.locationTo = results[1]
                          eventEmitter.emit('RideCreated', newRide, 'Regular')
                          // insert ride days in RegularRideDays table
                          const rideDays = [];
                          for (let i = 0; i < newRide.days.length; i++) {
                            rideDays.push({
                              regularRideId: newRide.id,
                              day: newRide.days[i],
                            });
                          }
                          RegularRideDays.bulkCreate(rideDays);

                          if (returnTime) {
                            newRide.id = createUuid();
                            newRide.time = returnTime;
                            getOrAddLocations(rawNewRide.from, rawNewRide.to)
                              .then((results) => {
                                if (results[0] === undefined
                                                                        || results[1] === undefined) reject('Can not find location');
                                newRide.fromId = results[1].id;
                                newRide.toId = results[0].id;
                                newRide.status = 'verified';
                                checkLocations(Locations, newRide)
                                  .then((newRide) => {
                                    RegularRide.create(newRide)
                                      .then(() => {
                                        newRide.locationFrom = results[1]
                                        newRide.locationTo = results[0]
                                        eventEmitter.emit('RideCreated', newRide, 'Regular')
                                        // insert ride days in RegularRideDays table
                                        const rideDays = [];
                                        for (let i = 0; i < newRide.days.length; i++) {
                                          rideDays.push({
                                            regularRideId: newRide.id,
                                            day: newRide.days[i],
                                          });
                                        }
                                        RegularRideDays.bulkCreate(rideDays)
                                          .then(() => {
                                            dispatchSuc(res, null);
                                          }).catch(err => dispatchErr(res, [err.message]));
                                      }).catch(err => dispatchErr(res, [err.message]));
                                  }).catch(err => dispatchErr(res, [err.message]));
                              }).catch(err => dispatchErr(res, [err.message]));
                          } else {
                            dispatchSuc(res, null);
                          }
                        })
                        .catch(err => dispatchErr(res, [err.message]));
                    })
                    .catch(err => dispatchErr(res, err));
                })
                .catch(err => dispatchErr(res, err));
            })
            .catch(err => dispatchErr(res, err));
        })
        .catch(err => dispatchErr(res, err));
    },
  );
  const checkCarOwner = (userId) => {
    new Promise(
      (resolve, reject) => {
        let where;
        req.body.carId === undefined
          ? where = { userId, status: 'active' }
          : where = { userId, id: req.body.carId };
        UserCars.findOne({
          attributes: ['userId', 'status', 'id'],
          where,
        })
          .then((carOwner) => {
            if (carOwner === null && (req.body.carId === undefined)) {
              console.log('you are not the owner of this car ');
              dispatchErr(res, ['Please add your car in your profile section']);
              return;
              // reject(["you are not the owner of this car"])
            } if (carOwner === null) {
              console.log('Please add your car in your profile section');
              dispatchErr(res, ['Please add your car in your profile section']);
            } else if (carOwner.status == 'active') {
              rawNewRide.carId = req.body.carId === undefined
                ? carOwner.id
                : req.body.carId;
              const self = userId;
              // check if user have already joined at least one group
              // // Edit (NO VERIFY)
              // Call the checkLocation method directly with null groupId
              checkLocation(self, null, rawNewRide.carId);
              // GroupUsers.findOne({ where: { userId: self, status: 'verified' } })
              //   .then((userGroup) => {
              //     if (userGroup == null) dispatchErr(res, 'You should join a group first');
              //     else if (groupId !== null && groupId !== undefined) {
              //       // // Edit (NO VERIFY)
              //       GroupUsers.findOne({ where: { userId: self, groupId, status: 'verified'} })
              //         .then((group) => {
              //           if (group == null) dispatchErr(res, 'You are not a member of this group');
              //           else {
              //             // add ride to the rides table
              //             // createUserRide(self, groupId)
              //             checkLocation(self, groupId, rawNewRide.carId);
              //           }
              //         })
              //         .catch(err => dispatchErr(res, err.message));
              //     } else { // in case of groupId is not sent, but already joined a group
              //       groupId = userGroup.groupId;
              //       checkLocation(self, groupId, rawNewRide.carId);
              //       // createUserRide(self, groupId)
              //       // dispatchSuc(res, "in case of groupId is not sent, but already joined a group")
              //     }
              //   })
              //   .catch(err => dispatchErr(res, err.message));
            } else {
              console.log('Please add your car in your profile section');
              dispatchErr(res, ['Please add your car in your profile section']);
            }
          });
      },
    );
  };

  let checkPromoCode = groupId => new Promise((resolve, reject) => {
    if (rawNewRide.promoCode) {
      validatePromoCode(rawNewRide.promoCode, groupId)
        .then(() => resolve())
        .catch(err => reject(err));
    } else {
      resolve();
    }
  });

  // This Promises chain validates loginToken, then
  // prepares the input, validates the locations and
  // their diversity, then eventually creates the ride
  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      Users.findById(self)
        .then((userRecord) => {
          // // Edit (NO VERIFY)
          // if (userRecord.status != 'verified') {
          //   dispatchErrContent(res, { verified: false }, ['You must join a group first']);
          //   return;
          // }
          
          // Edit (NO VERIFY)
          //checkUserVerification(self).then(() =>
            checkUserRidesOnDaysAndTime(self, days, rawNewRide.time, false, rawNewRide.id)
              .then(() => {
                if (rawNewRide.returnTime !== undefined) {
                  checkUserRidesOnDaysAndTime(self, days, rawNewRide.returnTime, true, rawNewRide.id)
                    .then(() => {
                      checkCarOwner(self);
                    })
                    .catch(err => dispatchErr(res, err));
                } else {
                  checkCarOwner(self);
                }
              })
              .catch(err => dispatchErr(res, err))
              //).catch(err => dispatchErrContent(res, { verified: false }, err));
        })
        .catch(err => dispatchErr(res, err));
    })
    .catch(err => dispatchErr(res, err));
};

// /regularrides/:id (PUT) route
const editRegularRide = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const rawNewRide = req.body;
  rawNewRide.from = req.body.from;
  rawNewRide.time = validateTime(req.body.time) === true ? req.body.time : dispatchErr(res, ['Time format is not valid ']);
  rawNewRide.to = req.body.to;
  if ((rawNewRide.from !== undefined && rawNewRide.to === undefined)
        || (rawNewRide.from === undefined && rawNewRide.to !== undefined)) {
    dispatchErr(res, ['Both from and to locations must be sent or not']);
    return;
  }
  if (rawNewRide.from && !rawNewRide.from.englishName) {
    dispatchErr(res, ['No name passed for from point']);
  }
  if (rawNewRide.to && !rawNewRide.to.englishName) {
    dispatchErr(res, ['No name passed for to point']);
  }
  const locSent = (rawNewRide.from !== undefined && rawNewRide.to !== undefined);
  const { from, to } = req.body;
  if (locSent) {
    const distanceBetweenCoordinates = getDistancBetweenCoordinates(parseFloat(from.lng), parseFloat(from.lat), parseFloat(to.lng), parseFloat(to.lat));
    if (distanceBetweenCoordinates < 1000) {
      return dispatchErr(res, ['Sorry, distance between pickup and dropoff location is less than 1 km']);
    }
  }
  days = req.body.days !== undefined && req.body.days !== null && req.body.days.length == 0
    ? dispatchErr(res, ['No days passed'])
    : req.body.days;

  // Prepares the input and checks the locations
  // for existance and diversity
  const prepareAndCheck = (self, rawNewRide) => new Promise(
    (resolve, reject) => {
      locSent == true
        ? getOrAddLocations(rawNewRide.from, rawNewRide.to)
          .then((results) => {
            rawNewRide.fromId = results[0].id;
            rawNewRide.toId = results[1].id;
            Promise.all([prepareInput(rawNewRide), checkLocations(Locations, rawNewRide)])
              .then(newRide => resolve([self, newRide[0]]))
              .catch(err => reject(err));
          })
          .catch(err => reject(err))
        : prepareInput(rawNewRide)
          .then(newRide => resolve([self, newRide]))
          .catch(err => reject(err));
    },
  );

  // This Promises chain validates loginToken, then
  // prepares the input, validates the locations and
  // their diversity, then eventually edits the ride
  checkLoginToken(UserLogins, loginToken)
    .then(self => prepareAndCheck(self, rawNewRide)
      .then((results) => {
        const newRide = results[1];
        newRide.id = req.params.id;

        checkUserRidesOnDaysAndTime(self, days, newRide.time, false, newRide.id)
          .then(() => getAndAction(newRide, 'update', results[0])
            .then(() => dispatchSuc(res, []))
            .catch(err => dispatchErr(res, err)))

          .catch(err => dispatchErr(res, err));
      })
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// /regularrides/:id (DELETE) route
const removeRegularRide = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const rideId = req.params.id;

  // This Promises chain validates loginToken and then
  // proceeds to validate the ride, its property and
  // then deletes it
  checkLoginToken(UserLogins, loginToken)
    .then(self => getAndAction({ id: rideId }, 'delete', self)
      .then(() => dispatchSuc(res, null))
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// Shared method that checks ride existance, property and
// eventually updates or deletes it
let getAndAction = (newRide, action, driverId) => new Promise(
  (resolve, reject) => {
    RegularRide.findOne({ where: { id: newRide.id } })
      .then((ride) => {
        if (ride === null) {
          reject(['Invalid regular ride']);
          return;
        }
        if (driverId !== ride.driver) {
          reject(['Permission denied']);
          return;
        }
        if (action === 'update') {
          delete newRide.promoCode;
          ride.update(newRide)
            .then(() => {
              if (newRide !== null && newRide.days !== undefined) {
                // remove old days
                RegularRideDays.destroy({
                  where: {
                    regularRideId: newRide.id,
                  },
                })
                  .then(() => {
                    // insert the new days
                    const rideDays = [];
                    for (let i = 0; i < newRide.days.length; i++) {
                      rideDays.push({
                        regularRideId: newRide.id,
                        day: newRide.days[i],
                      });
                    }
                    RegularRideDays.bulkCreate(rideDays)
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
          ride.update({ status: 'deleted' })
            .then(() => resolve())
            .catch(err => reject([err.message]));
        }
      })
      .catch(err => reject(err.message));
  },
);

// getRegularRide By id
const getRegularRideById = regularRideId => new Promise((resolve, reject) => RegularRide.findById(regularRideId, {
  include: [
    {
      model: Users, as: 'user', attributes: ['userId', 'firstName', 'lastName', 'picture', 'gender', 'ridesWith', 'cellphone'], include: [],
    },
    { model: Groups },
    { model: UserCars },
    { model: Locations, as: 'from' },
    { model: Locations, as: 'to' },
  ],
}).then((regularRide) => {
  if (regularRide === null) {
    reject(['regularRideId is invalid']);
  }

  RegularRideDays.findAll({ where: { regularRideId: regularRide.id } })
    .then((days) => {
      // set regular ride days
      const daysArr = [];
      if (days != null) {
        for (let i = 0; i < days.length; i++) {
          daysArr.push(parseInt(days[i].day));
        }
      }
      regularRide.set('days', daysArr, { raw: true });
      if (!regularRide.days) {
        regularRide.days = daysArr;
      }

      Groups.findOne({
        attributes: ['id', 'name', 'status', 'icon', 'categoryId'],
        where: { id: regularRide.Group ? regularRide.Group.id : 0, status: { $ne: 'pending' } },
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
          // if (groups === null) resolve(memberCount);


          var memberCount = 0;
          if (groups && groups.GroupUsers) {
            for (j = 0; groups.GroupUsers && j < groups.GroupUsers.length; j++) {
              if (groups.GroupUsers[j].status == 'verified'&& groups.GroupUsers[j].User && groups.GroupUsers[j].User.status == 'verified') {
                memberCount++; 
              }
              // Edited (NO VERIFY)
              // memberCount++;
            }
          }

          // remove unrequired group data
          if (regularRide.Group) {
            delete regularRide.Group.dataValues.hr_email;
            delete regularRide.Group.dataValues.contact_email;
            delete regularRide.Group.dataValues.phone_number;
            delete regularRide.Group.dataValues.private;
            delete regularRide.Group.dataValues.kmFare;
            delete regularRide.Group.dataValues.cashPayment;
          }

          // add some required data to the regular ride obj
          if (regularRide.Group) {
            regularRide.Group.dataValues.memberCount = memberCount;
          }
          regularRide.set('driver', regularRide.user, { raw: true });
          regularRide.set('user', null, { raw: true });
          regularRide.car = regularRide.UserCar;
          regularRide.set('UserCar', null, { raw: true });

          resolve(regularRide);
        })
        .catch(err => err.message ? reject[err.message] : reject[err]);
    })
    .catch(err => reject([err.message]));
}).catch((err) => {
  console.log(err);
  reject([err]);
}));

const searchRegularRides = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  if (!req.query.date) {
    dispatchErr(res, ' date is required ');
    return;
  }

  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      // Edit (NO VERIFY)
      //checkUserVerification(self).then(() => {
          // prepare params
          const from = {
            lat: req.query.fromLat != undefined ? req.query.fromLat : undefined,
            lng: req.query.fromLng != undefined ? req.query.fromLng : undefined,
          };
          const to = {
            lat: req.query.toLat != undefined ? req.query.toLat : undefined,
            lng: req.query.toLng != undefined ? req.query.toLng : undefined,
          };
          let limit = req.query.limit == undefined ? 10 : req.query.limit;
          limit = parseInt(limit);
          let offset = req.query.offset == undefined ? 0 : req.query.offset;
          offset = parseInt(offset);

          // check from point
          if (from.lat != undefined || from.lng != undefined) {
            // ensure lat & lng are not undefined
            if (from.lat == undefined || from.lng == undefined) {
              dispatchErr(res, ['From point is undefined']);
              return;
            }
          }

          // check to point
          if (to.lat != undefined || to.lng != undefined) {
            // ensure lat & lng are not undefined
            if (to.lat == undefined || to.lng == undefined) {
              dispatchErr(res, ['To point is undefined']);
              return;
            }
          }

          // check the two points
          if (from.lat == undefined && from.lng == undefined
                        && to.lat == undefined && to.lng == undefined) {
            dispatchErr(res, ['From and to points are undefined']);
            return;
          }

          // prepare shared search query
          const searchQuery = `SELECT RegularRide.id AS regularRideId, RegularRide.from, RegularRide.to, RegularRide.carId, RegularRide.status, RegularRide.driver, RegularRide.time FROM RegularRide
                    INNER JOIN Locations AS locationsFrom ON RegularRide.from = locationsFrom.id
                    INNER JOIN Locations AS locationsTo ON RegularRide.to = locationsTo.id
                    WHERE (RegularRide.status IS NULL OR (RegularRide.status != 'cancelled' AND RegularRide.status != 'deleted' AND RegularRide.status != 'finished'))`;

          // prepare search query 1
          let searchQuery1 = searchQuery;
          if (from.lat != undefined && from.lng != undefined) {
            searchQuery1 += ` AND dist(locationsFrom.lat, locationsFrom.lng, ${from.lat}, ${from.lng}) <= 2.5`;
          }
          if (to.lat != undefined && to.lng != undefined) {
            searchQuery1 += ` AND dist(locationsTo.lat, locationsTo.lng, ${to.lat}, ${to.lng}) <= 2.5`;
          }
          searchQuery1 += ` LIMIT ${limit} OFFSET ${offset}`;

          const result = [];
          sequelize.query(searchQuery1, { type: Sequelize.QueryTypes.SELECT })
            .then((timeRides) => {
              if (timeRides == null) {
                timeRides = [];
              }

              const rides = removeDuplicates(timeRides, 'regularRideId');

              rides.sort((a, b) => {
                const keyA = new Date(parseInt(a.time));


                const keyB = new Date(parseInt(b.time));
                // Compare the 2 dates
                if (keyA < keyB) return -1;
                if (keyA > keyB) return 1;
                return 0;
              });
              const ridesList = [];
              for (let i = 0; i < rides.length; i++) {
                (function (i) {
                  ridesList.push(getRegularRideById(rides[i].regularRideId));
                }(i));
              }
              Q.all(ridesList).then((result) => {
                dispatchSuc(res, result);
              }).catch(err => dispatchErr(res, err));
            }).catch(err => dispatchErr(res, err.message));
        // }).catch(err => dispatchErrContent(res, { verified: false }, err));
    })
    .catch(err => dispatchErr(res, err));
};

module.exports = {
  addRegularRide, editRegularRide, removeRegularRide, searchRegularRides, getRegularRideById,
};




// SELECT Rides.id, Rides.from, Rides.to, Rides.time, -1 AS day, Rides.groupId, Groups.private, false AS isRegularRide FROM Rides
//     INNER JOIN Locations AS locationsFrom ON Rides.from = locationsFrom.id
//     INNER JOIN Locations AS locationsTo ON Rides.to = locationsTo.id
//     LEFT JOIN Groups ON Rides.groupId = Groups.id
//     WHERE (Rides.status IS NULL OR (Rides.status != 'cancelled' AND Rides.status != 'deleted' AND Rides.status != 'finished'))
//     AND Rides.dateTime >= 1563248540312 AND dist(locationsFrom.lat, locationsFrom.lng, 30.0328642, 31.4100122 ) <= 2.5 AND dist(locationsTo.lat, locationsTo.lng, 30.5765383, 31.5040656 ) <= 2.5 AND Rides.date = '2019-07-26' AND (private = 0 OR (private = 1 AND EXISTS (SELECT userId FROM GroupUsers WHERE userId = '8203896d-1b11-42f7-b2df-549a5af17e19' AND groupId = Rides.groupId)))

// UNION ALL

// SELECT RegularRide.id, RegularRide.from, RegularRide.to, RegularRide.time, RegularRideDays.day, RegularRide.groupId, Groups.private, true AS isRegularRide FROM RegularRide
//     INNER JOIN Locations AS locationsFrom ON RegularRide.from = locationsFrom.id
//     INNER JOIN Locations AS locationsTo ON RegularRide.to = locationsTo.id
//     INNER JOIN RegularRideDays ON RegularRide.id = RegularRideDays.regularRideId
//     LEFT JOIN Groups ON RegularRide.groupId = Groups.id
//     WHERE (RegularRide.status IS NULL OR (RegularRide.status != 'cancelled' AND RegularRide.status != 'deleted' AND RegularRide.status != 'finished'))
//     AND dist(locationsFrom.lat, locationsFrom.lng, 30.0328642, 31.4100122) <= 2.5 AND dist(locationsTo.lat, locationsTo.lng, 30.5765383, 31.5040656) <= 2.5
//     AND day = 6 AND (private = 0 OR (private = 1 AND EXISTS (SELECT userId FROM GroupUsers WHERE userId = '8203896d-1b11-42f7-b2df-549a5af17e19' AND groupId = RegularRide.groupId)))
//     AND NOT EXISTS(SELECT id FROM Rides WHERE regularRideId = RegularRide.id AND date = '2019-07-26')
//         ORDER BY time ASC LIMIT 15 OFFSET 0