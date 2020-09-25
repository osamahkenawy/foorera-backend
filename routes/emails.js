const {
  GroupDomains,
  UserVerificationCo,
  UserLogins,
  Users,
  GroupUsers,
} = require('../models/index');
const {
  dispatchSuc,
  dispatchErr,
  createToken,
  createUuid,
} = require('../tools/tools');
const {
  getEmailVerificationMailTemp,
} = require('../email-verification-mail-temp');

const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];

const Random = require('random-js');
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

// /email/verify route
const verify = (req, res, next) => {
  let email;
  if (req.query.email === '' || req.query.email === undefined) {
    dispatchErr(res, ['No email address']);
    return;
  }
  email = req.query.email;


  let groupId;
  if (req.query.groupId === '' || req.query.groupId === undefined) {
    dispatchErr(res, ['No GroupId provided']);
    return;
  }
  groupId = req.query.groupId;

  const loginToken = req.headers.logintoken;

  // Extract domain name
  const domainName = email => email.replace(/.*@/, '');

  // Determine wheter to search groups for groupId or domain
  const where = {
    domain: domainName(email),
    groupId,
  };

  // Find domain
  const findDomain = () => new Promise(
    (resolve, reject) => {
      GroupDomains.findOne({
        attributes: ['domain', 'groupId'],
        where,
      })
        .then((domain) => {
          if (domain !== null) {
            console.log(domain);
            // groupId = domain.groupId
            resolve();
          } else {
            reject(['Sorry, your email address is not relevant to this group']);
          }
        })
        .catch(err => reject([err.message]));
    },
  );

  // Create random code between 0000 and 9999
  const createCode = () => new Promise(
    (resolve, reject) => {
      const random = new Random(Random.engines.browserCrypto);
      let code = String(random.integer(0, 9999));
      while (code.length < 4) {
        code = `0${code}`;
      }
      resolve({
        code,
      });
    },
  );


  // Send code to provided email
  const sendCode = (receiver, data) => new Promise(
    (resolve, reject) => {
      if (data.code === undefined || data.code === '') reject(['Invalid code']);

      const mailOptions = {
        from: '"Foorera" <support@foorera.com>', // sender address
        to: receiver, // list of receivers
        subject: 'Foorera Verification Code', // Subject line
        html: getEmailVerificationMailTemp(data.code), // html body
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return reject([error.stack]);
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
        resolve(data);
      });
    },
  );

  // Add record to UserVerificationCo or update existing one
  const saveCode = (data, userId) => new Promise(
    (resolve, reject) => {
      UserVerificationCo.find({
        where: {
          userId,
        },
      })
        .then((record) => {
          const newData = {
            code: data.code,
            sentTo: email,
            sentAt: Math.floor(Date.now() / 1000),
          };
          if (record !== null) {
            // If record exists update it
            const where = {
              where: {
                userId,
              },
            };
            UserVerificationCo.update(newData, where)
              .then(() => resolve())
              .catch(err => reject([err.message]));
          } else {
            // Create a new record
            newData.userId = userId;
            UserVerificationCo
              .create(newData)
              .then(() => resolve())
              .catch(err => reject([err.message]));
          }
        })
        .catch(err => reject([err.message]));
    },
  );

  const createGroupUsersLink = userId => new Promise(
    (resolve, reject) => {
      const newData = {
        groupId,
        userId,
      };
      GroupUsers.findOne({
        where: newData,
      })
        .then((groupUser) => {
          if (groupUser !== null) {
            groupUser.update({
              status: 'pending',
              joinEmail: email,
            })
              .then(() => resolve())
              .catch(err => reject([err.message]));
          } else {
            // set the join emain then create
            newData.joinEmail = email;
            GroupUsers
              .create(newData)
              .then(() => resolve())
              .catch(err => reject([err.message]));
          }
        })
        .catch(err => reject([err.message]));
    },
  );
  const withoutvalidation = () => new Promise(
    (resolve, reject) => {
      createCode()
        .then((data) => {
          saveCode(data)
            .then(() => {
              const newData = {
                status: 'pending code verification',
              };
              createGroupUsersLink()
                .then(() => dispatchSuc(res, []))
                .catch(err => dispatchErr(res, err));


              sendCode(email, data);
            })
            .catch(err => dispatchErr(res, err));
        })
        .catch(err => dispatchErr(res, err));
    },
  );


  const findTestDomain = () => new Promise(
    (resolve, reject) => {
      GroupDomains.findAll({
        attributes: ['groupId', 'domain'],
        where: {
          groupId,
        },
      })
        .then((domain) => {
          resolve(domain);
        })
        .catch(err => reject([err.message]));
    },
  );


  // Check that there are no verified GroupUsers entry that has the same groupId and joinEmail
  GroupUsers.findOne({
    where: {
      groupId,
      joinEmail: email,
      status: 'verified',
    },
  })
    .then((entry) => {
      if (entry) {
        throw Error('User with same email already joined this group');
      }
    })
    .then(() => {
      if (loginToken !== undefined) {
        UserLogins.findOne({
          attributes: ['userId'],
          where: {
            loginToken,
          },
        }).then((user) => {
          if (user !== null) {
            const userId = user.userId;

            findTestDomain().then((domainName) => {
              let check = false;
              for (let i = 0; i < domainName.length; i++) {
                if (domainName[i].domain === ';accept_all;') {
                  check = true;
                }
              }
              if (check === true) {
                createCode()
                  .then((data) => {
                    saveCode(data, userId)
                      .then(() => {
                        const newData = {
                          status: 'pending code verification',
                        };

                        createGroupUsersLink(userId)
                          .then(() => dispatchSuc(res, {
                            groupId,
                          }))
                          .catch(err => dispatchErr(res, err));

                        sendCode(email, data);
                      })
                      .catch(err => dispatchErr(res, err));
                  })
                  .catch(err => dispatchErr(res, err));
              } else {
                findDomain()
                  .then(() => createCode()
                    .then((data) => {
                      saveCode(data, userId)
                        .then(() => {
                          const newData = {
                            status: 'pending code verification',
                          };

                          createGroupUsersLink(userId)
                            .then(() => dispatchSuc(res, {
                              groupId,
                            }))
                            .catch(err => dispatchErr(res, err));

                          sendCode(email, data);
                        })
                        .catch(err => dispatchErr(res, err));
                    })
                    .catch(err => dispatchErr(res, err)))
                  .catch(err => dispatchErr(res, err));
              }
            });
          } else {
            const userId = createUuid();
            const loginToken = createToken();
            Users.create({
              userId,
            })
              .then((newUser) => {
                // Remove user's current UserLogins
                UserLogins.destroy({
                  where: {
                    userId,
                  },
                }).then(() => {
                  // Create new record
                  UserLogins.create({
                    userId,
                    loginToken,
                  }).then(() => {
                    findTestDomain().then((domainName) => {
                      let check = false;
                      for (let i = 0; i < domainName.length; i++) {
                        if (domainName[i].domain === ';accept_all;') {
                          check = true;
                        }
                      }
                      if (check === true) {
                        createCode()
                          .then((data) => {
                            saveCode(data, userId)
                              .then(() => {
                                const newData = {
                                  status: 'pending code verification',
                                };

                                createGroupUsersLink(userId)
                                  .then(() => dispatchSuc(res, {
                                    loginToken,
                                    groupId,
                                  }))
                                  .catch(err => dispatchErr(res, err));

                                sendCode(email, data);
                              })
                              .catch(err => dispatchErr(res, err));
                          })
                          .catch(err => dispatchErr(res, err));
                      } else {
                        findDomain()
                          .then(() => createCode()
                            .then((data) => {
                              saveCode(data, userId)
                                .then(() => {
                                  const newData = {
                                    status: 'pending code verification',
                                  };

                                  createGroupUsersLink(userId)
                                    .then(() => dispatchSuc(res, {
                                      loginToken,
                                      groupId,
                                    }))
                                    .catch(err => dispatchErr(res, err));


                                  sendCode(email, data);
                                })
                                .catch(err => dispatchErr(res, err));
                            })
                            .catch(err => dispatchErr(res, err)))
                          .catch(err => dispatchErr(res, err));
                      }
                    });
                  })
                    .catch(err => dispatchErr(res, err));
                })
                  .catch(err => dispatchErr(res, err));
              })
              .catch(err => dispatchErr(res, err));
          }
        });
      } else {
        const userId = createUuid();
        const loginToken = createToken();
        Users.create({
          userId,
        })
          .then((newUser) => {
            // Remove user's current UserLogins
            UserLogins.destroy({
              where: {
                userId,
              },
            }).then(() => {
              // Create new record
              UserLogins.create({
                userId,
                loginToken,

              }).then((userlogin) => {
                findTestDomain()
                  .then((domainName) => {
                    let check = false;
                    for (let i = 0; i < domainName.length; i++) {
                      if (domainName[i].domain === ';accept_all;') {
                        check = true;
                      }
                    }
                    if (check === true) {
                      createCode()
                        .then((data) => {
                          saveCode(data, userId)
                            .then(() => {
                              const newData = {
                                status: 'pending code verification',
                              };

                              createGroupUsersLink(userId)
                                .then(() => dispatchSuc(res, {
                                  loginToken,
                                  groupId,
                                }))
                                .catch(err => dispatchErr(res, err));

                              sendCode(email, data);
                            })
                            .catch(err => dispatchErr(res, err));
                        })
                        .catch(err => dispatchErr(res, err));
                    } else {
                      findDomain()
                        .then(() => createCode()
                          .then((data) => {
                            saveCode(data, userId)
                              .then(() => {
                                createGroupUsersLink(userId)
                                  .then(() => dispatchSuc(res, {
                                    loginToken,
                                    groupId,
                                  }))
                                  .catch(err => dispatchErr(res, err));

                                sendCode(email, data);
                              })
                              .catch(err => dispatchErr(res, err));
                          })
                          .catch(err => dispatchErr(res, err)))
                        .catch(err => dispatchErr(res, err));
                    }
                  }).catch(err => dispatchErr(res, [err.message]));
              }).catch(err => dispatchErr(res, [err.message]));
            })
              .catch(err => dispatchErr(res, err));
          })
          .catch(err => dispatchErr(res, err));
      }
    })
    .catch((err) => {
      dispatchErr(res, [err.message]);
    });
};


// /email/checkcode route
const checkCode = (req, res, next) => {
  if (req.query.groupId === '' || req.query.groupId === undefined) {
    dispatchErr(res, ['No groupId provided']);
    return;
  }
  const groupId = req.query.groupId;

  const code = req.query.code;
  let loginToken;
  if (req.headers.loginToken === '' || req.headers.loginToken) {
    dispatchErr(res, ['No loginToken provided']);
    return;
  }
  loginToken = req.headers.logintoken;

  // Searches the record for the given code & userId
  // if found deletes it
  const findCode = userId => new Promise(
    (resolve, reject) => {
      if (code === '' || code === undefined) {
        reject(['No code provided']);
        return;
      }
      UserVerificationCo.findOne({
        where: {
          userId,
          code,
        },
      })
        .then((record) => {
          if (record === null) {
            reject(['Invalid code']);
            return;
          }
          record.destroy()
            .then(() => resolve())
            .catch(err => reject([err.message]));
        })
        .catch(err => dispatchErr(res, [err.message]));
    },
  );

  const updateGroupUsersLink = userId => new Promise(
    (resolve, reject) => {
      GroupUsers
        .update({
          status: 'verified',
        }, {
          where: {
            userId,
            groupId,
          },
        })
        .then(() => resolve())
        .catch(err => reject([err.message]));
    },
  );
  // This Promises chain no longer requires a loginToken but
  // instead an userId. Then searches in the UserVerificationCo
  // table for a record that corresponds with the code && userId,
  // if so deletes the record and updates user's status to 'verified'
  // and GroupUsers to 'verified'

  UserLogins.findOne({
    attributes: ['userId'],
    where: {
      loginToken,
    },
  }).then((user) => {
    if (user !== null) {
      const userId = user.userId;
      findCode(userId)
        .then(() => {
          Users.findById(userId)
            .then((userRecord) => {
              const newData = {
                status: 'verified',
              };
              if (userRecord.email !== null && userRecord.firstName !== null && userRecord.lastName !== null && userRecord.gender !== null) {
                updateUserStatus(userId, newData)
                  .then(() => {
                    updateGroupUsersLink(userId)
                      .then(() => dispatchSuc(res, []))
                      .catch(err => dispatchErr(res, err));
                  })
                  .catch(err => dispatchErr(res, err));
              }
              updateGroupUsersLink(userId)
                .then(() => dispatchSuc(res, []))
                .catch(err => dispatchErr(res, err));
            })
            .catch(err => dispatchErr(res, err));
        })
        .catch(err => dispatchErr(res, err));
    } else {
      dispatchErr(res, ['Sorry your session is expired, please login again']);
    }
  }).catch(err => dispatchErr(res, err.message));
};

// Shared method to update User's status
let updateUserStatus = (self, newData) => new Promise(
  (resolve, reject) => {
    const where = {
      where: {
        userId: self,
      },
    };
    Users.findOne({
      where: {
        userId: self,
      },
    })
      .then((user) => {
        if (user == null) {
          reject(['No user found....']);
        } else {
          user.update(newData)
            .then(() => resolve())
            .catch(err => reject([err.message]));
        }
      });
  },
);

module.exports = {
  verify,
  checkCode,
};
