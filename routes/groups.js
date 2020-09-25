const {
  sequelize, Sequelize, Categories, Groups, GroupDomains, Rides, GroupAdmins, RegularRide, Users, UserCars, UserLogins, GroupUsers, RegularRideDays, Regions,
} = require('../models/index');
const map = require('lodash/map');
const {
  dispatchSuc, dispatchErr, checkLoginToken, prepareInput, createUuid, getAddGroupSupportMail,
  convertRegularRideToRide, getWeekDayIndex, isToday, getCurrentTime, formatDate,
} = require('../tools/tools');
const { getRegularRideById } = require('./regularRides');
const { getRideById } = require('./rides');
const Q = require('q');

const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];


const Random = require('random-js');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAILGUN_HOST,
  port: process.env.MAILGUN_PORT,
  secure: false,
  auth: {
    user: process.env.MAILGUN_USER,
    pass: process.env.MAILGUN_PASS,
  },
});

// /groupstypes route
const getGroupsTypes = (req, res, next) => {
  // This Promises chain doesn't require the user to be logged.
  // searches and returns all the group Categories
  Categories.findAll({
    order: ['name'],
  })
    .then((categories) => {
      categories === null
        ? dispatchSuc(res, [])
        : dispatchSuc(res, categories);
    })
    .catch(err => dispatchErr(res, [err.message]));
};

// /groupsregions route
const getGroupsRegions = (req, res, next) => {
  // This Promises chain doesn't require the user to be logged.
  // searches and returns all the group Regions
  Regions.findAll({
    order: ['name'],
  })
    .then((regions) => {
      regions === null
        ? dispatchSuc(res, [])
        : dispatchSuc(res, regions);
    })
    .catch(err => dispatchErr(res, [err.message]));
};

//  /groups/{groupId}/regularrides [GET]   // (Group Regular Rides)
const getGroupRegularRides = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const groupId = req.params.groupId;
  const limit = (req.query.limit === undefined) || (req.query.limit === null) ? 10 : req.query.limit;
  const offset = req.query.offset;
  if (!req.query.date) {
    dispatchErr(res, ' date is required ');
    return;
  }

  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      const groupQuery = {
        attributes: { exclude: ['toId', 'fromId'] },
        where: {
          groupId,
          $or: [{ status: null }, {
            $and: [
              {
                status: {
                  $ne: 'deleted',
                },
              },
            ],
          },
          ],
        },
      };

      if (limit !== undefined) groupQuery.limit = parseInt(limit);
      if (offset !== undefined) groupQuery.offset = parseInt(offset);


      // get regular rides in spasific groupId
      RegularRide.findAll(groupQuery).then((RegularRides) => {
        RegularRides === null
          ? { RegularRides: [] }
          : { RegularRides };

        const ridesList = [];
        for (let i = 0; i < RegularRides.length; i++) {
          (function (i) {
            ridesList.push(getRegularRideById(RegularRides[i].id));
          }(i));
        }
        Q.all(ridesList).then((result) => {
          dispatchSuc(res, result);
        }).catch(err => dispatchErr(res, err));


        // dispatchSuc(res, RegularRides)
      }).catch(err => dispatchErr(res, err));
    })
    .catch(err => dispatchErr(res, err));
};

// get incoming Rides
const groupRides = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const groupId = req.params.groupId;

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
      const query = {
        attributes: { exclude: ['toId', 'fromId'] },
        order: [['dateTime', 'ASC']],
        where: {
          groupId,
          dateTime: {
            $gte: new Date().getTime(),
          },
          $or: [{ status: null }, {
            $and: [
              {
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
              },
            ],
          },
          ],
        },
        offset: parseInt(offset),
        limit: parseInt(limit),
      };

      Rides.findAll(query)
        .then((rides) => {
          if (rides == null) {
            resolve([]);
          } else {
            const promises = [];
            for (let i = 0; i < rides.length; i++) {
              (function (i) {
                promises.push(getRideById(rides[i].id));
              }(i));
            }
            const r = Q.all(promises).then((ridesArr) => {
              resolve(ridesArr);
            }).catch(err => reject([err.message]));
          }
        }).catch(err => reject([err.message]));
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
                            WHERE (status IS NULL OR (status != 'cancelled' AND status != 'deleted' AND status != 'finished'))
                            AND date >= '${formatDate(baseDate)}' AND date <= '${formatDate(maxDate)}'
                            AND dateTime >= ${timestamp}
                            AND groupId = '${groupId}'
                            UNION ALL`;

          // regular rides query
          query += ` SELECT RegularRide.id, DATE_ADD('${formatDate(baseDate)}', INTERVAL day - ${getWeekDayIndex(baseDate)} DAY) AS date, RegularRide.time,
                            UNIX_TIMESTAMP(CONCAT(DATE_FORMAT(DATE_ADD('${formatDate(baseDate)}', INTERVAL day - ${getWeekDayIndex(baseDate)} DAY), '%Y-%m-%d'), ' ', time)) * 1000 AS dateTime, RegularRideDays.day, true AS isRegularRide FROM RegularRide
                            INNER JOIN RegularRideDays ON RegularRide.id = RegularRideDays.regularRideId
                            WHERE (RegularRide.status IS NULL OR (RegularRide.status != 'cancelled' AND RegularRide.status != 'deleted' AND RegularRide.status != 'finished'))`;
          if (isToday(baseDate)) {
            query += ` AND (day > ${getWeekDayIndex(baseDate)} OR (day = ${getWeekDayIndex(baseDate)} AND time >= '${getCurrentTime()}'))`;
          } else if (week == 0) {
            query += ` AND day > ${getWeekDayIndex(baseDate)}`;
          }
          query += ` AND NOT EXISTS (SELECT id FROM Rides WHERE regularRideId = RegularRide.id AND date = DATE_ADD('${formatDate(baseDate)}', INTERVAL day - ${getWeekDayIndex(baseDate)} DAY))
                            AND groupId = '${groupId}'
                            ORDER BY dateTime ASC LIMIT ${limit} OFFSET ${offset}`;

          // execute the query
          sequelize.query(query, { type: Sequelize.QueryTypes.SELECT })
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
    .then((self) => {
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
    .catch(err => dispatchErr(res, err));
};

// function used to route to the suitable function according to the url path parts
const groupsInfo = (req, res, next) => {
  const id = req.params.groupId;
  if (id === 'userscount') {
    getGroupUsersCount(req, res, next);
  } else {
    getGroupInfo(req, res, next);
  }
};

// /groups/{:id} route
let getGroupInfo = (req, res, next) => {
  const groupId = req.params.groupId;
  let groupObj = {};

  // Get specific group object
  const getSingleGroup = () => new Promise(
    (resolve, reject) => {
      Groups.findById(groupId, {
        attributes: { exclude: ['categoryId'] },
        include: [
          { model: Categories, as: 'category' },
        ],
      })
        .then((group) => {
          if (group === null) {
            reject(['No group found']);
            return;
          }
          groupObj = group.get();
          resolve();
        })
        .catch(err => reject([err.message]));
    },
  );

  // Fill in array of domains associated with group
  const getGroupDomains = () => new Promise(
    (resolve, reject) => {
      GroupDomains.findAll({
        attributes: ['domain'],
        where: { groupId: groupObj.id },
      })
        .then((domains) => {
          if (domains === null) {
            groupObj.domains = [];
            return;
          }
          groupObj.domains = domains.map(domain => domain.get('domain'));
          resolve();
        })
        .catch(err => reject([err.message]));
    },
  );

  // Fill in array of admins associated with group
  const getGroupAdmins = () => new Promise(
    (resolve, reject) => {
      GroupAdmins.findAll({
        attributes: { exclude: ['groupId', 'userId'] },
        where: { groupId: groupObj.id },
        include: [
          { model: Users, as: 'user' },
        ],
      })
        .then((admins) => {
          if (admins === null) {
            groupObj.admins = [];
            return;
          }
          groupObj.admins = admins.map(admins => admins.get('user'));
          GroupUsers.findAndCountAll({
            where: { groupId: groupObj.id },
            include: [{
              model: Users, where: { status: 'verified' },
            }],
          })
            .then((result) => {
              groupObj.memberCount = result.count;
              resolve();
            })
            .catch(err => reject([err.message]));
        })
        .catch(err => reject([err.message]));
    },
  );

  // This Promise chain doesn't require the user to be logged.
  // It searches for a group with the given groupId, then
  // looks for its domains and its admins
  getSingleGroup()
    .then(() => getGroupDomains()
      .then(() => getGroupAdmins()
        .then(() => dispatchSuc(res, groupObj))
        .catch(err => dispatchErr(res, err)))
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// /groups route
const getGroupList = async (req, res, next) => {
  const offset = req.query.offset;
  const limit = req.query.limit;

  // TODO: return domains array
  const query = req.query.q === undefined || req.query.q === ''
    ? {
      attributes: ['id', 'name', 'status', 'icon', 'categoryId'],
      where: { status: { $ne: 'pending' } },
      order: 'name',
      include: [{
        model: GroupUsers,
        attributes: ['status'],
        required: false,
        include: [{
          model: Users,
          attributes: ['status'],
        }],
        raw: false,
      },
      {
        model: GroupDomains,
        attributes: ['domain'],
        required: false,
      }],
    }
    : {
      where: { name: { $like: `%${req.query.q}%` }, status: { $ne: 'pending' } },
      attributes: ['id', 'name', 'status', 'icon', 'categoryId'],
      order: 'name',
      include: [{
        model: GroupUsers,
        attributes: ['status'],
        required: false,
        include: [{
          model: Users,
          attributes: ['status'],
        }],
      },
      {
        model: GroupDomains,
        attributes: ['domain'],
        required: false,
      }],
    };

  // add offset & limit of possible
  if (limit && offset) {
    query.offset = parseInt(offset);
    query.limit = parseInt(limit);
  }

  // This Promises doesn't require loginToken validation
  // proceeds to list the group
  try {
    const groups = await Groups.findAll(query);
    if (groups === null) {
      dispatchSuc(res, []);
    } else {
      for (i = 0; i < groups.length; i++) {
        let memberCount = 0;
        for (j = 0; groups[i].GroupUsers && j < groups[i].GroupUsers.length; j++) {
          if (groups[i].GroupUsers[j].status == 'verified'
                        && groups[i].GroupUsers[j].User && groups[i].GroupUsers[j].User.status == 'verified') {
            memberCount++;
          }
        }

        groups[i].set('memberCount', memberCount, { raw: true });
        groups[i].set('GroupUsers', null, { raw: true });
        const groupDomains = await getDomainByGroupId(groups[i].id) || [];
        const groupDomainsResponse = groupDomains.map(obj => ({ domain: obj.domain }));
        groups[i].set('GroupDomains', groupDomainsResponse, { raw: true });
      }
      dispatchSuc(res, groups);
    }
  } catch (error) {
    dispatchSuc(res, [error.message]);
  }
};


const getDomainByGroupId = async (groupId) => {
  const groupDomains = await GroupDomains.findAll({
    where: { groupId },
    raw: true,
  });
  return groupDomains;
};


// /group/{:groupId}/leave route
const leaveGroup = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const groupId = req.params.groupId;

  // This Promises chain validates loginToken and then
  // proceeds to remove the user from the group
  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      GroupUsers.findOne({
        where: {
          groupId,
          userId: self,
        },
      })
        .then((groupLink) => {
          if (groupLink === null) {
            dispatchErr(res, ['User does not belong to group']);
            return;
          }
          groupLink.destroy()
            .then(() => dispatchSuc(res, []))
            .catch(err => dispatchErr(res, [err.message]));
        })
        .catch(err => dispatchErr(res, [err.message]));
    })
    .catch(err => dispatchErr(res, err));
};

// /groups (POST) route
const addGroup = (req, res, next) => {
  // get contct params
  const params = req.body;
  const { name } = params;
  const businessEmail = params.business_email;
  const phoneNumber = params.phone_number;
  // validate required params
  if (name === undefined) {
    return dispatchErr(res, ['name is required']);
  }
  if (phoneNumber === undefined) {
    return dispatchErr(res, ['phone_number is required']);
  }


  Groups.findOne({
    where: Sequelize.and(
      { status: 'done' },
      Sequelize.where(Sequelize.fn('lower', Sequelize.col('name')), sequelize.fn('lower', req.body.name)),
    ),
  })
    .then((group) => {
      if (group) {
        dispatchErr(res, ["Couldn't add group. Another group with the same name exists"]);
      } else {
        // This Promises chain prepares the input passed
        // eliminating the unused fields and then inserts
        // the new group
        prepareInput(params)
          .then((newGroup) => {
            newGroup.id = createUuid();
            Groups.create(newGroup)
              .then(() => {
                sendEmails(newGroup);
                dispatchSuc(res, []);
              })
              .catch(err => dispatchErr(res, [err.message]));
          })
          .catch(err => dispatchErr(res, [err.message]));
      }
    })
    .catch(err => dispatchErr(res, err));

  // Get group category name
  const getCategoryName = group => new Promise(
    (resolve, reject) => {
      Categories.findOne({ where: { id: group.categoryId } })
        .then((category) => {
          if (category != null) {
            resolve(category.name);
          } else {
            resolve(null);
          }
        })
        .catch(() => resolve(null));
    },
  );

  // Get group region name
  const getRegionName = group => new Promise(
    (resolve, reject) => {
      Regions.findOne({ where: { id: group.regionId } })
        .then((region) => {
          if (region != null) {
            resolve(region.name);
          } else {
            resolve(null);
          }
        })
        .catch(() => resolve(null));
    },
  );

  // Send email
  const sendUserEmail = () => new Promise(
    (resolve, reject) => {
      // client mail options
      const mailOptions = {
        from: '"Foorera Support" <support@foorera.com>',
        to: businessEmail,
        subject: `${params.name} Group`,
        html: getAddGroupSupportMail(),
      };

      // send and resolve
      transporter
        .sendMail(mailOptions)
        .then(() => { resolve(); })
        .catch((err) => { reject(err); });
    },
  );

  // Send email
  const sendFooreraFeedbackEmail = group => new Promise(
    (resolve, reject) => {
      getCategoryName(group)
        .then(categoryName => getRegionName(group)
          .then((regionName) => {
            // foorera mail options
            const mailBody = `id: ${group.id}
                                <br />name: ${params.name}
                                <br />category: ${categoryName}
                                <br />region: ${regionName}
                                <br />Business Email: ${businessEmail}
                                <br />phone number: ${phoneNumber}`;

            const mailOptions = {
              from: '"Foorera Feedback" <support@foorera.com>',
              to: 'feedback@foorera.com',
              subject: 'New group added',
              html: mailBody,
            };

            // send and resolve
            transporter
              .sendMail(mailOptions)
              .then(resolve)
              .catch(err => reject(err));
          })
          .catch(err => reject([err.message])))
        .catch(err => reject([err.message]));
    },
  );

  // Send feedback and user emails
  let sendEmails = group => new Promise(
    (resolve, reject) => {
      sendUserEmail()
        .then(resolve)
        .catch(err => reject(err));
      sendFooreraFeedbackEmail(group)
        .then(resolve)
        .catch(err => reject(err));
    },
  );
};

const getGroupRidesInfo = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const groupId = req.params.groupId;

  checkLoginToken(UserLogins, loginToken)
    .then(self => RegularRide.count({
      where: {
        groupId,
        status: 'verified',
      },
      include: [{ model: RegularRideDays, required: true }],
    })
      .then((count) => {
        const resultObj = { hasRegularRides: count > 0 };
        dispatchSuc(res, resultObj);
      })
      .catch(err => dispatchErr(res, [err.message])))
    .catch(err => dispatchErr(res, err));
};

// /groups/memberscount route
let getGroupUsersCount = (req, res, next) => {
  const loginToken = req.headers.logintoken;

  // check login token
  checkLoginToken(UserLogins, loginToken)
    .then((userId) => {
      // get members count
      GroupUsers.count({ where: { status: 'verified' } })
        .then((count) => {
          dispatchSuc(res, { groupUsersCount: count });
        })
        .catch(err => dispatchErr(res, [err]));
    })
    .catch(err => dispatchErr(res, err));
};

module.exports = {
  getGroupsTypes,
  getGroupInfo,
  getGroupList,
  leaveGroup,
  addGroup,
  groupRides,
  getGroupRegularRides,
  getGroupRidesInfo,
  getGroupsRegions,
  getGroupUsersCount,
  groupsInfo,
};
