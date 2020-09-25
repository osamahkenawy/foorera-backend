const {
  sequelize,
  Sequelize,
  RideAlerts,
  Users,
  Locations,
  UserLogins,
} = require('../models/index');

const {
  dispatchSuc,
  dispatchErr,
  checkLoginToken,
} = require('../tools/tools');

const {
  getRideAlertById,
} = require('./users');

const Q = require('q');

const maxSearchDistance = 2.5;

const getRideAlerts = function (req, res) {
  const loginToken = req.headers.logintoken;
  const offset = req.query.offset ? parseInt(req.query.offset) : 0;
  const limit = req.query.offset ? parseInt(req.query.limit) : 10;
  const {
    fromLat, fromLng, toLat, toLng,
  } = req.query;

  // check from coordinates
  const fromExists = fromLat || fromLng;
  if (fromExists && (!fromLat || !fromLng)) {
    dispatchErr(res, ['From point is undefined']);
    return;
  }

  // check from coordinates
  const toExists = toLat || toLng;
  if (toExists && (!toLat || !toLng)) {
    dispatchErr(res, ['To point is undefined']);
    return;
  }

  const getRideAlerts = () => new Promise((resolve, reject) => {
    // prepare the query
    let query = `SELECT RideAlerts.id FROM RideAlerts
				INNER JOIN Locations AS locationsFrom ON RideAlerts.from = locationsFrom.id
				INNER JOIN Locations AS locationsTo ON RideAlerts.to = locationsTo.id
				WHERE RideAlerts.status = 'verified'`;
    if (fromLat && fromLng) {
      query += ` AND dist(locationsFrom.lat, locationsFrom.lng, ${fromLat}, ${fromLng}) <= ${maxSearchDistance}`;
    }
    if (toLat && toLng) {
      query += ` AND dist(locationsTo.lat, locationsTo.lng, ${toLat}, ${toLng}) <= ${maxSearchDistance}`;
    }
    query += ` ORDER BY creationDate DESC LIMIT ${limit} OFFSET ${offset}`;

    // execute the query
    sequelize.query(query, {
      type: Sequelize.QueryTypes.SELECT,
    })
      .then((rideAlerts) => {
        // check ride alerts
        if (!rideAlerts) {
          resolve([]);
        }

        // prepare final ride alerts list
        const promises = [];
        for (let i = 0; i < rideAlerts.length; i++) {
          (function (i) {
          // add the get ride alert promise
            promises.push(getRideAlertById(rideAlerts[i].id));
          }(i));
        }
        Q.all(promises)
          .then((result) => {
            resolve(promises);
          })
          .catch(err => reject([err.message]));
      })
      .catch(err => reject([err.message]));
  });

  checkLoginToken(UserLogins, loginToken)
    .then(() => getRideAlerts()
      .then(rideAlerts => dispatchSuc(res, rideAlerts))
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

module.exports = {
  getRideAlerts,
};
