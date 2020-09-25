/**
 * Created by DELL on 2/2/2017.
 */
const { sequelize, Sequelize, Rides } = require('../models/index');
const { createUuid } = require('./tools');
const { Locations, Groups } = require('../models/index');
const requestify = require('requestify');

const env = process.env.NODE_ENV || 'development';
const {
  rideFareStarting, rideFareFirst25KM, rideFareAfter25KMTo100,
  rideFareAfter25KMToLongerThan100,
  rideFareStartingCommission, rideFareCommission,
} = require('../config/config')[env];

const calculateShortestRideDist = (origin, destination) => new Promise(
  (resolve, reject) => {
    // prepare configs
    const appId = process.env.HERE_APP_ID;
    const appCode = process.env.HERE_APP_CODE;

    // prepare here route url
    let url = 'https://route.cit.api.here.com/routing/7.2/calculateroute.json';
    url += `?app_id=${appId}&app_code=${appCode}`;
    url += `&waypoint0=geo!${origin.lat},${origin.lng}`;
    url += `&waypoint1=geo!${destination.lat},${destination.lng}`;
    url += '&mode=shortest;car;traffic:disabled';

    // send the request
    requestify.get(url)
      .then((response) => {
        // get distance in km
        const distance = response.getBody().response.route[0].summary.distance;
        distanceKm = distance / 1000;

        // and resolve
        resolve(distanceKm);
      })
      .catch((err) => {
        reject(err);
      });
  },
);

const RideDistanceFareByRideId = (rideId, timeOut, locations) => new Promise(
  (resolve, reject) => {
    setTimeout(() => {
      Rides.findById(rideId, {
        include: [
          { model: Locations, as: 'from' },
          { model: Locations, as: 'to' },
          { model: Groups },
        ],
      }).then((ride) => {
        let from, to
        if ( ! ride) {
          from = locations.from
          to = locations.to
        } else {
          from = ride.from
          to = ride.to
        }
        // calculate shortest distance using google maps distance api
        calculateShortestRideDist(from, to)
          .then((rideDist) => {
            // check group km fare to set final fare, fareAfterCommission
            let fareAfterCommission = 0
            if (ride && ride.Group && ride.Group.kmFare) {
              // the group has a fare,

              // calculate fare according to group km fare
              var fare = rideDist * ride.Group.kmFare; // calculate fare for the distance
              fare += rideFareStarting; // add starting value
              fare = Math.ceil(fare); // round the number to highest integer

              // calculate foorera commission according to general rideFare for the first 30 km
              var fooreraCommission = rideDist * rideFareCommission; // calculate commission for the distance
              fooreraCommission += rideFareStartingCommission; // add starting value
              fooreraCommission = Math.ceil(fooreraCommission); // round the number to highest integer

              // calculate fare after commission
              fareAfterCommission = fare - fooreraCommission;
            } else {
              // group doesn't have a fare,

              // divide distance to first and after 25 km distance
              const first25KmDistance = rideDist <= 25 ? rideDist : 25;
              const after25KmDistance = rideDist <= 25 ? 0 : rideDist - 25;
              let calculatedRideFareAfter25KM;
              // calculate fare
              var fare = first25KmDistance * rideFareFirst25KM; // calculate first 25 km fare

              if (rideDist > 100) {
                calculatedRideFareAfter25KM = after25KmDistance * rideFareAfter25KMToLongerThan100;
              } else if (rideDist > 25) {
                calculatedRideFareAfter25KM = after25KmDistance * rideFareAfter25KMTo100;
              } else {
                calculatedRideFareAfter25KM = 0;
              }


              fare += calculatedRideFareAfter25KM; // add after 30 km fare

              fare += rideFareStarting; // add starting fare
              fare = Math.ceil(fare); // round the number to highest integer

              // calculate foorera commission
              var fooreraCommission = fare * rideFareCommission; // calculate foorera commission
              fooreraCommission += rideFareStartingCommission; // add starting commission
              fooreraCommission = Math.ceil(fooreraCommission); // round the number to highest integer

              // calculate fare after commission
              fareAfterCommission = fare - fooreraCommission;
            }

            const distanceFare = {
              distance: rideDist,
              fare,
              fareAfterCommission,
            };

            if ( ! ride && locations) {
              resolve(distanceFare);
            }

            Rides.update(distanceFare, { where: { id: rideId } }).then(res => {
              // resolve
              resolve(distanceFare);
            }).catch(err => console.log(err));
          }).catch(err => console.log(err));
      }).catch(err => reject(err));
    }, timeOut);
  },

);


// const PI = 3.141592
// let radians = function (angle) {
//     return angle / (180 / PI)
// }

const radians = function (degrees) {
  return degrees * Math.PI / 180;
};

const MAX_DIST = 5;
const dist = function (from, to) {
  return 6371 * Math.acos(Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.cos(radians(to.lng) - radians(from.lng)) + Math.sin(radians(from.lat)) * Math.sin(radians(to.lat)));
};

const addLocation = loc => new Promise(
  (resolve, reject) => {
    loc.id = createUuid();
    Locations.create(loc)
      .then((result) => {
        resolve(result);
      })
      .catch((err) => {
        reject(err);
      });
  },
);

const getOrAddLocation = loc => new Promise(
  (resolve, reject) => {
    // get locations where distance between them and loc == 0 m
    // prepare select query
    const query = `SELECT *, dist(lat, lng, ${loc.lat}, ${loc.lng}) AS distance
            FROM Locations WHERE dist(lat, lng, ${loc.lat}, ${loc.lng}) = 0 ORDER BY distance`;

    // execute the query
    sequelize.query(query, { type: Sequelize.QueryTypes.SELECT })
      .then((locations) => {
        // check locations arr
        if (locations != undefined && locations != null && locations.length > 0) {
          // set nearset location as the first location in the arr
          var nearestLocation = locations[0];
        }

        // check nearest location
        if (nearestLocation != undefined) {
          // resolve with this location
          resolve(nearestLocation);
        } else {
          // add the locaton
          addLocation(loc)
            .then((location) => {
              // resolve with added location
              resolve(location);
            })
            .catch((err) => {
              // error, reject
              reject(err);
            });
        }
      })
      .catch((err) => {
        // add the locaton
        addLocation(loc)
          .then((location) => {
            // resolve with added location
            resolve(location);
          })
          .catch((err) => {
            // error, reject
            reject(err);
          });
      });
  },
);

const getOrAddLocations = (from, to) => new Promise(
  (resolve, reject) => {
    const results = [];
    getOrAddLocation(from)
      .then((locFrom) => {
        results[0] = locFrom;
        getOrAddLocation(to)
          .then((locTo) => {
            results[1] = locTo;
            resolve(results);
          })
          .catch(err => reject([err.message]));
      })
      .catch(err => reject([err.message]));
  },
);

const getDistancBetweenCoordinates = (lon1, lat1, lon2, lat2) => {
  const R = 6371e3; // metres
  const φ1 = radians(lat1);
  const φ2 = radians(lat2);
  const Δφ = radians(lat2 - lat1);
  const Δλ = radians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2)
        + Math.cos(φ1) * Math.cos(φ2)
        * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c;
  return d;
};
module.exports = { getOrAddLocations, RideDistanceFareByRideId, getDistancBetweenCoordinates };
