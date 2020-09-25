const request = require('request-promise');
const {
  UserSocialNetworkAccounts, UserLogins, Users, GroupUsers,
} = require('../models/index');
const {
  getUser, dispatchSuc, dispatchErr, dispatchErrContent, checkUserConsistency, createToken, checkLoginToken,
  checkPermissions, prepareInput, updateUser, createUuid, checkLocations, cryptPass, uploadPicture, comparePass,
} = require('../tools/tools');

const env = process.env.NODE_ENV || 'development';
const { fbAppId, fbAppSecret } = require('../config/config.json')[env];

// /login/social route
const socialLogin = (req, res, next) => {
  const socialUserId = req.query.userid;
  const socialauthToken = req.query.authToken;
  const deviceName = req.query.deviceName;
  const deviceId = req.query.deviceId;
  const loginToken = req.headers.logintoken;
  const socialUrl = req.query.socialUrl;
  // Prepares Facebook url
  const prepareFBUrl = (authToken) => {
    const FB_APP_ID = fbAppId;
    const FB_APP_SECRET = fbAppSecret;
    const FB_URL = 'https://graph.facebook.com/debug_token';
    return `${FB_URL}?input_token=${authToken}&access_token=${FB_APP_ID}|${FB_APP_SECRET}`;
  };

  // Checks if sent auth token is valid
  const isValidToken = () => new Promise(
    (resolve, reject) => {
      const url = prepareFBUrl(socialauthToken);
      request(url)
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

  // Checks if user is returning or new
  const isExistingUser = () => new Promise(
    (resolve, reject) => {
      UserSocialNetworkAccounts.findOne({
        attributes: ['userId'],
        where: {
          accountUsername: socialUserId,
        },
      })
        .then((userSocialLogin) => {
          const response = userSocialLogin === null
            ? { returning: false }
            : { returning: true, userId: userSocialLogin.userId };
          resolve(response);
        })
        .catch(err => reject([err.message]));
    },
  );

  // Creates a UserLogin if needed deleting all current user's UserLogins or updates UserLogin if needed
  const newUserLogin = userId => new Promise(
    (resolve, reject) => {
      const loginToken = createToken();
      Users.findOne({ where: { userId } })
        .then((user) => {
          UserSocialNetworkAccounts.findById(userId)
            .then((userSocialNetworkAccRecord) => {
              if (socialUrl) {
                userSocialNetworkAccRecord.socialUrl = socialUrl;
                return userSocialNetworkAccRecord.save();
              }
            })
            .then(() => {
              let profile_completed;
              profile_completed = !(user.firstName === undefined || user.firstName === '' || user.firstName === null
                                    || user.lastName === undefined || user.lastName === '' || user.lastName === null
                                    || user.gender === undefined || user.gender === '' || user.gender === null
                                    || user.email === undefined || user.email === '' || user.email === null);
              UserLogins.find({
                where: {
                  userId,
                  deviceId,
                },
              })
                .then((loginRecord) => {
                  if (loginRecord !== null) {
                    // Update existing record
                    loginRecord.updateAttributes({
                      loginToken,
                    })
                      .then(updatedRecord => dispatchSuc(res, {
                        profile_completed, loginToken: updatedRecord.loginToken, userId, returning: true,
                      }))
                      .catch(err => dispatchErr(res, err.message));
                  } else {
                    // Remove user's current UserLogins
                    UserLogins.destroy(
                      {
                        where: {
                          userId,
                        },
                      },
                    ).then(() => {
                      // Create new record
                      UserLogins.create({
                        deviceId,
                        userId,
                        loginToken,
                        deviceName,
                      })
                        .then(user => dispatchSuc(res, {
                          profile_completed, loginToken: user.loginToken, userId, returning: false,
                        }))
                        .catch(err => dispatchErr(res, err.message));
                    })
                      .catch(err => dispatchErr(res, err));
                  }
                })
                .catch(err => dispatchErr(res, err.message));
            })
            .catch((err) => {
              dispatchErr(res, [err.message]);
            });
        })
        .catch(err => dispatchErr(res, ['mismatching userId']));
    },
  );

  // Creates a new SocialNetworkLogin
  const createNewSocialLogin = userId => new Promise(
    (resolve, reject) => {
      UserSocialNetworkAccounts.create({
        userId,
        accountKey: 'FB_ACC',
        accountUsername: socialUserId,
        socialUrl,
      })
        .then(newUserLogin(userId))
        .catch(err => dispatchSuc(res, err));
    },
  );

  // Creates a new User
  const createNewUser = () => new Promise(
    (resolve, reject) => {
      const newId = createUuid();
      Users.create({
        userId: newId,
      })
        .then(newUser => createNewSocialLogin(newUser.userId))
        .catch(err => dispatchErr(res, err));
    },
  );

  // add the `UserSocialNetworkAccounts` record using this `userId`
  const getActualUser = userId => new Promise(
    (resolve, reject) => {
      UserSocialNetworkAccounts.create({
        userId,
        accountKey: 'FB_ACC',
        accountUsername: socialUserId,
        socialUrl,
      })
        .then(newUserLogin(userId))
        .catch(err => dispatchSuc(res, err));
    },
  );

  // This Promises chain firstly checks if
  // the supplied authToken is valid,
  // if the User is new or returning
  // then creates it or refreshes its login accordingly
  // If any promise gets rejected the whole chain stops
  // and an error is sent back
  // isValidToken()
  //   .then(() =>
  if (loginToken !== undefined) {
    UserLogins.findOne({
      attributes: ['userId'],
      where: { loginToken },
    }).then((user) => {
      if (user !== null) {
        const userId = user.userId;
        isValidToken()
          .then(() => {
            const rawEditUserLogin = { deviceId, deviceName };
            const where = { where: { loginToken } };
            UserLogins.update(rawEditUserLogin, where)
              .then(() => {
                isExistingUser()
                  .then((resp) => {
                    if (resp.returning) {
                      // Returning user
                      newUserLogin(resp.userId);
                    } else {
                      // add the `UserSocialNetworkAccounts` record using this `userId`
                      getActualUser(userId);
                    }
                  })
                  .catch(err => dispatchErr(res, err));
              }).catch(err => dispatchErr(res, err));
          }).catch(err => dispatchErr(res, err));
      } else {
        isValidToken()
          .then(() => isExistingUser()
            .then((resp) => {
              if (resp.returning) {
                // Returning user
                newUserLogin(resp.userId);
              } else {
                // New User
                createNewUser();
              }
            })
            .catch(err => dispatchErr(res, err)))
          .catch(err => dispatchErr(res, err));
      }
    });
  } else {
    isValidToken()
      .then(() => isExistingUser()
        .then((resp) => {
          if (resp.returning) {
            // Returning user
            newUserLogin(resp.userId);
          } else {
            // New User
            createNewUser();
          }
        })
        .catch(err => dispatchErr(res, err)))
      .catch(err => dispatchErr(res, err));
  }
};

// /login/normal route
const normalLogin = (req, res, next) => {
  const email = req.query.email;
  const password = req.query.password;
  const deviceId = req.query.deviceId;
  const deviceName = req.query.deviceName;

  const validateInputs = () => new Promise((resolve, reject) => {
    if (!email) {
      reject(['Email is required']);
    } else if (!password) {
      reject(['Password is required']);
    } else {
      resolve();
    }
  });

  const findUser = () => new Promise((resolve, reject) => {
    Users.findOne({ where: { email } })
      .then((user) => {
        if (user) {
          resolve(user);
        } else {
          reject(['No user found with this email or phone number']);
        }
      })
      .catch(err => reject([err.message]));
  });

  const getProfileCompleted = user => new Promise((resolve, reject) => {
    let profileCompleted;
    profileCompleted = !(user.firstName === undefined || user.firstName === '' || user.firstName === null
                || user.lastName === undefined || user.lastName === '' || user.lastName === null
                || user.gender === undefined || user.gender === '' || user.gender === null
                || user.email === undefined || user.email === '' || user.email === null);

    resolve(profileCompleted);
  });

  const createLoginToken = userId => new Promise((resolve, reject) => {
    const loginToken = createToken();
    UserLogins.destroy({
      where: {
        userId,
      },
    })
      .then(() => {
        UserLogins.create({
          deviceId,
          userId,
          loginToken,
          deviceName,
        })
          .then(user => resolve(loginToken))
          .catch(err => reject([err.message]));
      })
      .catch(err => reject([err.message]));
  });

  validateInputs()
    .then(() => findUser()
      .then(user => comparePass(password, user.encPassword)
        .then(() => getProfileCompleted(user)
          .then(profileCompleted => createLoginToken(user.userId)
            .then((loginToken) => {
              const content = {
                userId: user.userId,
                loginToken,
                profile_completed: profileCompleted,
              };

              dispatchSuc(res, content);
            })
            .catch(err => dispatchErr(res, err)))
          .catch(err => dispatchErr(res, err)))
        .catch(err => dispatchErr(res, ['Incorrect password'])))
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

// /login/register route
const register = (req, res, next) => {
  const loginToken = req.headers.logintoken;

  // FIXME: data is being sent as query parameter "req.query", it should be sent in "req.body"
  const queries = req.query;
  const picture = req.body ? req.body.picture : undefined;
  const pictureUrl = req.body ? req.body.pictureUrl : undefined;
  // Encrypt password (if present)
  const preparePass = password => new Promise(
    (resolve, reject) => {
      if (!password) {
        resolve(password);
      } else {
        cryptPass(password)
          .then((encPassword) => {
            resolve(encPassword);
          })
          .catch(err => reject([err]));
      }
    },
  );


  Users.findOne({
    where: {
      email: queries.email,
    },
  })
    .then((result) => {
      if (result) {
        dispatchErr(res, ['User with same email exists']);
        return;
      }
      if (loginToken) {
        // This Promises chain starts with two Promises
        // the former validates the loginToken,
        // the latter parses the request and returns an User obj
        // then the User is updated
        // If any promise gets rejected the whole chain stops
        // and an error is sent back
        Promise.all([checkLoginToken(UserLogins, loginToken), prepareInput(queries)])
          .then(results => preparePass(queries.password)
            .then((encPassword) => {
              results[1].encPassword = encPassword;
              results[1].emailVerified = 1;
              if (!(results[1].email && results[1].firstName && results[1].lastName && results[1].gender)) {
                dispatchErr(res, ['Not provided all required params']);
                return;
              }
              GroupUsers.count({ where: { userId: results[0], status: 'verified' } })
                .then((groups) => {
                  if (groups > 0) results[1].status = 'verified';
                  if (pictureUrl !== null && pictureUrl !== undefined) {
                    results[1].picture = pictureUrl;
                    updateUser(Users, results[0], results[1])
                      .then(result => getUser(loginToken, results[0], res))
                      .catch(err => dispatchErr(res, err));
                  } else if (picture) {
                    uploadPicture(picture, results[0], results[1])
                      .then(newInfo => updateUser(Users, results[0], newInfo)
                        .then(result => getUser(loginToken, results[0], res))
                        .catch(err => dispatchErr(res, err)))
                      .catch(err => dispatchErr(res, err));
                  } else {
                    updateUser(Users, results[0], results[1])
                      .then(result => getUser(loginToken, results[0], res))
                      .catch(err => dispatchErr(res, err));
                  }
                }).catch(err => dispatchErr(res, err));
            })
            .catch(err => dispatchErr(res, err)))
          .catch(err => dispatchErr(res, err));
      } else {
        prepareInput(queries)
          .then((rawQueries) => {
            Object.assign(rawQueries, { emailVerified: 0 });
            preparePass(queries.password)
              .then((encPassword) => {
                rawQueries.encPassword = encPassword;
                if (!(rawQueries.email && rawQueries.firstName && rawQueries.lastName && rawQueries.gender && rawQueries.password)) {
                  dispatchErr(res, ['Not provided all required params']);
                  return;
                }

                const userId = createUuid();
                const loginToken = createToken();

                UserLogins.create({
                  userId,
                  loginToken,
                  deviceId: rawQueries.deviceId,
                  deviceName: rawQueries.deviceName,
                })
                  .then(() => {
                    rawQueries.userId = userId;
                    Users.create(rawQueries)
                      .then(() => {
                        if (!pictureUrl && picture) {
                          uploadPicture(picture, userId, rawQueries)
                            .then((newInfo) => {
                              updateUser(Users, userId, newInfo)
                                .then(result => getUser(loginToken, userId, res))
                                .catch(err => dispatchErr(res, err));
                            })
                            .catch(err => dispatchErr(res, err));
                        } else {
                          getUser(loginToken, userId, res);
                        }
                      })
                      .catch(err => dispatchErr(res, [err.message]));
                  })
                  .catch(err => dispatchErr(res, [err.message]));
              })
              .catch(err => dispatchErr(res, err));
          })
          .catch(err => dispatchErr(res, [err.message]));
      }
    })
    .catch((err) => {
      dispatchErr(res, err);
    });
};

// /login/deviceid route
const updateDeviceId = (req, res, next) => {
  // get params
  const loginToken = req.headers.logintoken;
  const deviceId = req.body.deviceId;

  // validate the device id
  if (!deviceId) {
    dispatchErr(res, ['Missing deviceId']);
    return;
  }

  // update the device id in the db
  const updateDeviceId = () => new Promise(
    (resolve, reject) => {
      // prepare the queries
      const userLogin = { deviceId };
      const whereClause = { where: { loginToken } };

      // update the db
      UserLogins.update(userLogin, whereClause)
        .then(() => {
          resolve();
        }).catch(err => reject([err.message]));
    },
  );

  // check
  checkLoginToken(UserLogins, loginToken)
    .then(() => {
      updateDeviceId()
        .then(() => {
          dispatchSuc(res, null);
        })
        .catch((err) => {
          dispatchErr(res, err);
        });
    })
    .catch((err) => {
      dispatchErr(res, err);
    });
};

module.exports = {
  socialLogin, normalLogin, register, updateDeviceId,
};
