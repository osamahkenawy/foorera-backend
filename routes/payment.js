const {
  sequelize,
  UserCardTokens,
  PaymentPackages,
  UserLogins,
  Users,
  UserBillingAccounts,
  UserOrders,
  UserTransactions,
} = require('../models/index');
const {
  dispatchSuc,
  dispatchErr,
  checkLoginToken,
  createNotification,
  checkPermissions,
  prepareInput,
  createUuid,
  checkUserVerification,
  dispatchErrContent,
  sendDataByUserId,
} = require('../tools/tools');
const {
  paymentActions,
  validateHmac,
  calculateBalance,
  successfulOrderTransactionsAmount,
} = require('../tools/paymentAPI');
const {
  formatEgyptianMobileNumber,
  validateEgyptianMobileNumber,
} = require('../tools/validators');

const env = process.env.NODE_ENV || 'development';
const {
  cardIntegrationId,
  walletIntegrationId,
  extraFees,
  cardAuthAmount,
  cardAuthIntegrationId,
  amanIntegrationId,
} = require('../config/config')[env];


const getUserCards = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;

  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then((self) => {
        UserCardTokens.findAll({
          attributes: {
            exclude: ['token'],
          },
          where: {
            userId: self,
          },
        })
          .then((UserCards) => {
            dispatchSuc(res, UserCards);
          }).catch(err => dispatchErr(res, err));
      }).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err));
};

const addCardToken = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;
  if (!req.body.cardHolderName) {
    dispatchErr(res, ['cardHolderName is undefined']);
    return;
  }
  if (!req.body.cardNumber) {
    dispatchErr(res, ['cardNumber is undefined']);
    return;
  }
  if (!req.body.expiryYear) {
    dispatchErr(res, ['expiryYear is undefined']);
    return;
  }
  if (!req.body.expiryMonth) {
    dispatchErr(res, ['expiryMonth is undefined']);
    return;
  }
  if (!req.body.cvn) {
    dispatchErr(res, ['cvn is undefined']);
    return;
  }

  const cardHolderName = req.body.cardHolderName;
  const cardNumber = req.body.cardNumber;
  const expiryYear = req.body.expiryYear;
  const expiryMonth = req.body.expiryMonth;
  const cvn = req.body.cvn;
  const userId = req.params.id;

  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then((self) => {
        Users.findById(self)
          .then((userRecord) => {
            if (userRecord == null) {
              dispatchErr(res, ['Invalid userId']);
              return;
            }
            paymentActions('authentication').then((authData) => {
              const paymentKeyBody = {
                amount_cents: 0,
                currency: 'EGP',
                card_integration_id: cardIntegrationId,
                billing_data: {
                  first_name: userRecord.firstName,
                  last_name: userRecord.lastName,
                  phone_number: userRecord.cellphone == null ? 'not specified' : userRecord.cellphone,
                  email: userRecord.email,
                  shipping_method: 'DG',
                  apartment: 'not specified',
                  floor: 'not specified',
                  street: 'not specified',
                  building: 'not specified',
                  city: 'not specified',
                  country: 'not specified',
                  state: 'not specified',
                },
              };

              paymentActions('paymentKey', authData.token, paymentKeyBody)
                .then((paymentKeyData) => {
                  const tokenizationBody = {
                    pan: cardNumber,
                    cardholder_name: cardHolderName,
                    expiry_month: expiryMonth,
                    expiry_year: expiryYear,
                    cvn,
                    email: userRecord.email,
                  };
                  paymentActions('tokenization', paymentKeyData.token, tokenizationBody)
                    .then((tokenizationData) => {
                      const newUserCardTokensRecord = {
                        id: createUuid(),
                        userId: userRecord.userId,
                        token: tokenizationData.token,
                        maskedPan: tokenizationData.masked_pan,
                        cardSubtype: tokenizationData.card_subtype,
                      };
                      UserCardTokens.create(newUserCardTokensRecord).then(() => {
                        delete newUserCardTokensRecord.token;
                        dispatchSuc(res, newUserCardTokensRecord);
                      }).catch(err => dispatchErr(res, err));
                    }).catch(err => dispatchErr(res, err));
                }).catch(err => dispatchErr(res, err));
            }).catch(err => dispatchErr(res, err));
          }).catch(err => dispatchErr(res, err));
      }).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err));
};

const deleteCardtokens = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;
  if (!req.body.cardId) {
    dispatchErr(res, ['Card id is undefined']);
    return;
  }
  const cardId = req.body.cardId;
  const userId = req.params.id;

  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then((self) => {
        UserCardTokens.findOne({
          where: {
            userId: self,
            id: cardId,
          },
        }).then((card) => {
          if (card == null) {
            dispatchErr(res, ['Card id is invalid']);
            return;
          }
          UserCardTokens.destroy({
            where: {
              id: cardId,
            },
          })
            .then(() => {
              dispatchSuc(res, []);
            }).catch(err => dispatchErr(res, err));
        }).catch(err => dispatchErr(res, err));
      }).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err));
};

const getPaymentPackages = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;

  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      PaymentPackages.findAll({
        order: 'amount',
      })
        .then((paymentPackages) => {
          dispatchSuc(res, paymentPackages);
        }).catch(err => dispatchErr(res, err));
    }).catch(err => dispatchErr(res, err));
};

const cardPayment = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;
  if (!req.body.cardId) {
    dispatchErr(res, ['Card id is undefined']);
    return;
  }
  // if (!req.body.cvn) {
  //   dispatchErr(res, ['CVN is undefined']);
  //   return;
  // }
  if (!req.body.packageId) {
    dispatchErr(res, ['Package id is undefined']);
    return;
  }
  const cardId = req.body.cardId;
  const packageId = req.body.packageId;
  // const cvn = req.body.cvn;

  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      Users.findOne({
        where: {
          userId: self,
        },
      })
        .then((userRecord) => {
          // if (userRecord.status != 'verified') {
          //   dispatchErrContent(res, {
          //     verified: false,
          //   }, ['What is your university or company?']);
          //   return;
          // }

          UserCardTokens.findOne({
            where: {
              id: cardId,
              userId: self,
            },
          })
            .then((cardRecord) => {
              // check the card record
              if (cardRecord == null) {
                dispatchErr(res, ['Sorry, this card is not found']);
                return;
              }

              PaymentPackages.findById(packageId)
                .then((packageRecord) => {
                  // check the package record
                  if (packageRecord == null) {
                    dispatchErr(res, ['Sorry, this package is not found']);
                    return;
                  }

                  paymentActions('authentication').then((authData) => {
                    const orderPrice = (packageRecord.amount + extraFees) * 100;
                    const orderBody = {
                      merchant_id: authData.profile.id,
                      amount_cents: orderPrice,
                      items: [{
                        name: `Foorera ${packageRecord.amount} EGP Package`,
                        amount_cents: orderPrice,
                      }],
                      shipping_data: {
                        first_name: userRecord.firstName,
                        last_name: userRecord.lastName,
                        phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
                        email: userRecord.email,
                        shipping_method: 'DG',
                      },
                      delivery_needed: false,
                    };

                    paymentActions('orderRegistration', authData.token, orderBody)
                      .then((orderRegistrationData) => {
                        const paymentKeyBody = {
                          token: cardRecord.token,
                          order_id: orderRegistrationData.id,
                          amount_cents: orderPrice,
                          currency: 'EGP',
                          card_integration_id: cardIntegrationId,
                          billing_data: {
                            first_name: userRecord.firstName,
                            last_name: userRecord.lastName,
                            phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
                            email: userRecord.email,
                            shipping_method: 'DG',
                            apartment: 'not specified',
                            floor: 'not specified',
                            street: 'not specified',
                            building: 'not specified',
                            city: 'not specified',
                            country: 'not specified',
                            state: 'not specified',
                          },
                        };

                        // save the order in UserOrders
                        const orderDataStr = JSON.stringify(orderRegistrationData);
                        const userOrderRecord = {
                          id: orderRegistrationData.id,
                          userId: self,
                          data: orderDataStr,
                          creationDate: Date.now(),
                        };
                        UserOrders.create(userOrderRecord)
                          .then(() => {
                            paymentActions('paymentKey', authData.token, paymentKeyBody)
                              .then((paymentKeyData) => {
                                dispatchSuc(res, {
                                  ...paymentKeyData, cardToken: cardRecord.token,
                                  maskedPan: cardRecord.maskedPan,
                                })

                                // const payBody = {
                                //   source: {
                                //     identifier: cardRecord.token,
                                //     subtype: 'TOKEN',
                                //     cvn,
                                //   },
                                //   billing: {
                                //     first_name: userRecord.firstName,
                                //     last_name: userRecord.lastName,
                                //     email: userRecord.email,
                                //     phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
                                //   },
                                //   payment_token: paymentKeyData.token,
                                // };
                                // paymentActions('payOrder', null, payBody)
                                //   .then((payData) => {
                                //     // respond with the pay api response
                                //     console.log('response11', payData);
                                //     res.send(payData);
                                //   }).catch(err => dispatchErr(res, err));
                              }).catch(err => dispatchErr(res, err));
                          }).catch(err => dispatchErr(res, err));
                      }).catch(err => dispatchErr(res, err));
                  }).catch(err => dispatchErr(res, err));
                }).catch(err => dispatchErr(res, err));
            }).catch(err => dispatchErr(res, err));
        }).catch(err => dispatchErr(res, err));
    }).catch(err => dispatchErr(res, err));
};

const walletPayment = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;

  if (!req.body.mobileNumber) {
    dispatchErr(res, ['mobileNumber is undefined']);
    return;
  }
  if (!req.body.packageId) {
    dispatchErr(res, ['Package id is undefined']);
    return;
  }
  const packageId = req.body.packageId;
  let mobileNumber = req.body.mobileNumber;

  // format and validate the mobile number
  mobileNumber = formatEgyptianMobileNumber(mobileNumber);
  if (!validateEgyptianMobileNumber(mobileNumber)) {
    dispatchErr(res, ['Invalid mobile number']);
    return;
  }

  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      Users.findOne({
        where: {
          userId: self,
        },
      })
        .then((userRecord) => {
          // if (userRecord.status != 'verified') {
          //   dispatchErrContent(res, {
          //     verified: false,
          //   }, ['What is your university or company?']);
          //   return;
          // }
          PaymentPackages.findById(packageId)
            .then((packageRecord) => {
              // check the package record
              if (packageRecord == null) {
                dispatchErr(res, ['Sorry, this package is not found']);
                return;
              }

              paymentActions('authentication').then((authData) => {
                const orderPrice = (packageRecord.amount + extraFees) * 100;
                const orderBody = {
                  merchant_id: authData.profile.id,
                  amount_cents: orderPrice,
                  items: [{
                    name: `Foorera ${packageRecord.amount} EGP Package`,
                    amount_cents: orderPrice,
                  }],
                  shipping_data: {
                    first_name: userRecord.firstName,
                    last_name: userRecord.lastName,
                    phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
                    email: userRecord.email,
                    shipping_method: 'DG',
                  },
                  delivery_needed: false,
                };

                paymentActions('orderRegistration', authData.token, orderBody)
                  .then((orderRegistrationData) => {
                    const paymentKeyBody = {
                      order_id: orderRegistrationData.id,
                      amount_cents: orderPrice,
                      currency: 'EGP',
                      card_integration_id: walletIntegrationId,
                      billing_data: {
                        first_name: userRecord.firstName,
                        last_name: userRecord.lastName,
                        phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
                        email: userRecord.email,
                        shipping_method: 'DG',
                        apartment: 'not specified',
                        floor: 'not specified',
                        street: 'not specified',
                        building: 'not specified',
                        city: 'not specified',
                        country: 'not specified',
                        state: 'not specified',
                      },
                    };
                    // save the order in UserOrders
                    const orderDataStr = JSON.stringify(orderRegistrationData);
                    const userOrderRecord = {
                      id: orderRegistrationData.id,
                      userId: self,
                      data: orderDataStr,
                      creationDate: Date.now(),
                    };
                    UserOrders.create(userOrderRecord)
                      .then(() => {
                        paymentActions('paymentKey', authData.token, paymentKeyBody)
                          .then((paymentKeyData) => {
                            const payBody = {
                              source: {
                                identifier: mobileNumber,
                                subtype: 'WALLET',
                              },
                              billing: {
                                first_name: userRecord.firstName,
                                last_name: userRecord.lastName,
                                email: userRecord.email,
                                phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
                              },
                              payment_token: paymentKeyData.token,
                            };

                            paymentActions('payOrder', null, payBody)
                              .then((payData) => {
                                // check redirect url
                                const redirectUrl = payData.redirect_url;
                                if (!redirectUrl) {
                                  dispatchErrContent(res, null, ['Error, please try again or contact support']);
                                  return;
                                }

                                // save redirect url with the order
                                UserOrders.update({
                                  redirectUrl,
                                }, {
                                  where: {
                                    id: orderRegistrationData.id,
                                  },
                                }).then(() => {
                                  // respond with the url
                                  dispatchSuc(res, {
                                    orderRedirectUrl: redirectUrl,
                                  });
                                }).catch(err => dispatchErr(res, err));
                              }).catch(err => dispatchErr(res, err));
                          }).catch(err => dispatchErr(res, err));
                      }).catch(err => dispatchErr(res, err));
                  }).catch(err => dispatchErr(res, err));
              }).catch(err => dispatchErr(res, err));
            }).catch(err => dispatchErr(res, err));
        }).catch(err => dispatchErr(res, err));
    }).catch(err => dispatchErr(res, err));
};

const getBiilingaccounts = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;
  const userId = req.params.id;

  checkLoginToken(UserLogins, loginToken)
    .then(self => checkPermissions(self, userId)
      .then((self) => {
        UserBillingAccounts.findAll({
          attributes: {
            exclude: ['transferDetails'],
          },
          where: {
            userId: self,
            status: 'active',
          },
          order: 'creationDate DESC',
        })
          .then((Biilingaccounts) => {
            dispatchSuc(res, Biilingaccounts);
          }).catch(err => dispatchErr(res, err));
      }).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err));
};

const deleteBiilingaccounts = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;
  if (!req.body.id) {
    dispatchErr(res, ['id is undefined']);
    return;
  }
  const id = req.body.id;
  const userId = req.params.id;

  checkLoginToken(UserLogins, loginToken)
    .then(loggedUserId => checkPermissions(loggedUserId, userId)
      .then((loggedUserId) => {
        UserBillingAccounts.findById(id)
          .then((userBillingAccountRrecord) => {
            if (userBillingAccountRrecord == null || userBillingAccountRrecord.userId != loggedUserId) {
              dispatchErr(res, ['Sorry you are not the owner of this account']);
              return;
            }
            UserBillingAccounts.update({
              status: 'deleted',
            }, {
              where: {
                status: 'active',
                id,
                userId: loggedUserId,
              },
            }).then(() => dispatchSuc(res, []))
              .catch(err => dispatchErr(res, [err]));
          })
          .catch(err => dispatchErr(res, err));
      }).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err));
};

const addBiilingaccounts = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;

  if (!req.body.walletNumber) {
    dispatchErr(res, ['walletNumber is undefined']);
    return;
  }
  let walletNumber = req.body.walletNumber;

  if (!req.body.walletType) {
    dispatchErr(res, ['walletType is undefined']);
    return;
  }
  const walletType = req.body.walletType;
  const userId = req.params.id;

  checkLoginToken(UserLogins, loginToken)
    .then(loggedUserId => checkPermissions(loggedUserId, userId)
      .then((loggedUserId) => {
        // format the wallet number as egyptian mobile number
        walletNumber = formatEgyptianMobileNumber(walletNumber);
        const NewBillingAccounts = {
          id: createUuid(),
          accountNumber: walletNumber,
          accountType: walletType,
          userId: loggedUserId,
          creationDate: Date.now(),
        };
        UserBillingAccounts.create(NewBillingAccounts)
          .then(() => {
            dispatchSuc(res, NewBillingAccounts);
          })
          .catch(err => dispatchErr(res, [err.message]));
      }).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err));
};

const updateBiilingaccounts = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;

  if (!req.body.id) {
    dispatchErr(res, ['id is undefined']);
    return;
  }
  const id = req.body.id;

  if (!req.body.walletNumber) {
    dispatchErr(res, ['walletNumber is undefined']);
    return;
  }
  let walletNumber = req.body.walletNumber;

  if (!req.body.walletType) {
    dispatchErr(res, ['walletType is undefined']);
    return;
  }
  const walletType = req.body.walletType;
  const userId = req.params.id;

  checkLoginToken(UserLogins, loginToken)
    .then(loggedUserId => checkPermissions(loggedUserId, userId)
      .then((loggedUserId) => {
        UserBillingAccounts.findById(id)
          .then((userBillingAccountRrecord) => {
            if (userBillingAccountRrecord == null || userBillingAccountRrecord.userId != loggedUserId) {
              dispatchErr(res, ['Sorry you are not the owner of this account']);
              return;
            }
            // format the wallet number as egyptian mobile number
            walletNumber = formatEgyptianMobileNumber(walletNumber);
            UserBillingAccounts.update({
              accountNumber: walletNumber,
              accountType: walletType,
            }, {
              where: {
                id,
                userId: loggedUserId,
              },
            }).then(() => {
              userBillingAccountRrecord.set('accountNumber', walletNumber, {
                raw: true,
              });
              userBillingAccountRrecord.set('accountType', walletType, {
                raw: true,
              });
              dispatchSuc(res, userBillingAccountRrecord);
            })
              .catch(err => dispatchErr(res, [err]));
          })
          .catch(err => dispatchErr(res, err));
      }).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err));
};

const acceptNotification = (req, res, next) => {
  const hmac = req.query.hmac;
  const bodyParams = req.body;
  const bodyObj = bodyParams.obj;
  const transactionType = 'TRANSACTION';
  const tokenType = 'TOKEN';

  // validate the request type, if not = 'transaction' or 'token' will terminate the process
  const validateReqType = () => new Promise(
    (resolve, reject) => {
      const reqType = bodyParams.type;
      if (reqType.toUpperCase() === transactionType.toUpperCase()
					|| reqType.toUpperCase() === tokenType.toUpperCase()) {
        resolve(reqType);
      } else reject(['Not a transaction or a token, nothing to do']);
    },
  );

  // prepare successful transaction records to be added in the db according to the transaction type
  const prepareSuccessfulTransactionRecords = (userId, orderId) => new Promise(
    (resolve, reject) => {
      // prepare transaction records
      if (bodyObj.is_voided) {
        // 2 transactions, one negative and the second is positive
        // get order's balanceRechargeFees transaction from the db
        UserTransactions.findOne({
          where: {
            sourceId: orderId,
            sourceType: 'balanceRechargeFees',
          },
        })
          .then((rechargeFeesTransaction) => {
            // prepare recharge fees amount
            let rechargeFeesAmount = extraFees;
            if (rechargeFeesTransaction != null) {
              rechargeFeesAmount = rechargeFeesTransaction.amount * -1;
            }

            // 1st transaction
            const transaction1Record = {
              id: createUuid(),
              userId,
              sourceType: 'transactionVoid',
              sourceId: orderId,
              amount: (bodyParams.obj.amount_cents / 100) * -1,
              status: 'successful',
              creationDate: Date.now(),
            };

            // prepare the transaction record
            const transaction2Record = {
              id: createUuid(),
              userId,
              sourceType: 'balanceRechargeFeesRefund',
              sourceId: orderId,
              amount: rechargeFeesAmount,
              status: 'successful',
              creationDate: Date.now(),
            };

            // resolve
            resolve([transaction1Record, transaction2Record]);
          })
          .catch((err) => {
            reject([err.message]);
          });
      } else if (bodyObj.is_refunded) {
        // prepare the transaction
        var transaction1Record = {
          id: createUuid(),
          userId,
          sourceType: 'transactionRefund',
          sourceId: orderId,
          amount: (bodyParams.obj.refunded_amount_cents / 100) * -1,
          status: 'successful',
          creationDate: Date.now(),
        };

        // resolve
        resolve([transaction1Record]);
      } else {
        // 2 transactions, one positive and the second is negative
        // 1st transaction
        var transaction1Record = {
          id: createUuid(),
          userId,
          sourceType: bodyObj.is_auth ? 'cardAuth' : 'balanceRecharge',
          sourceId: orderId,
          amount: bodyParams.obj.amount_cents / 100,
          status: 'successful',
          creationDate: Date.now(),
        };

        // 2nd trasnaction
        const transaction2Record = {
          id: createUuid(),
          userId,
          sourceType: bodyObj.is_auth ? 'cardAuthRefund' : 'balanceRechargeFees',
          sourceId: orderId,
          amount: bodyParams.obj.amount_cents == 100 ? bodyParams.obj.amount_cents / 100 * -1 : extraFees * -1,
          status: 'successful',
          creationDate: Date.now(),
        };

        // resolve
        resolve([transaction1Record, transaction2Record]);
      }
    },
  );

  // prepare failed transaction record to be added in the db according to the transaction type
  const prepareFailedTransactionRecord = (userId, orderId) => new Promise(
    (resolve, reject) => {
      // prepare transaction records
      if (bodyObj.is_voided) {
        var transactionRecord = {
          id: createUuid(),
          userId,
          sourceType: 'transactionVoid',
          sourceId: orderId,
          amount: (bodyParams.obj.amount_cents / 100) * -1,
          status: 'failed',
          creationDate: Date.now(),
        };
      } else if (bodyObj.is_refunded) {
        var transactionRecord = {
          id: createUuid(),
          userId,
          sourceType: 'transactionRefund',
          sourceId: orderId,
          amount: (bodyParams.obj.refunded_amount_cents / 100) * -1,
          status: 'failed',
          creationDate: Date.now(),
        };
      } else {
        var transactionRecord = {
          id: createUuid(),
          userId,
          sourceType: bodyObj.is_auth ? 'cardAuth' : 'balanceRecharge',
          sourceId: orderId,
          amount: bodyParams.obj.amount_cents / 100,
          status: 'failed',
          creationDate: Date.now(),
        };
      }

      // resolve
      resolve(transactionRecord);
    },
  );

  const createTransactions = (transaction1Record, transaction2Record) => new Promise(
    (resolve, reject) => {
      if (transaction2Record === undefined) {
        // just 1st record, insert normally
        UserTransactions.create(transaction1Record)
          .then(() => resolve())
          .catch(err => reject([err.message]));
      } else {
        // two transactions, insert using sequelize transaction
        sequelize.transaction(t => UserTransactions.create(
          transaction1Record, {
            transaction: t,
          },
        )
          .then(userTransactions => UserTransactions.create(
            transaction2Record, {
              transaction: t,
            },
          ))).then((result) => {
          resolve();
        }).catch((err) => {
          reject([err]);
        });
      }
    },
  );

  // process the transaction
  const processTranscation = (userId, orderId) => new Promise(
    (resolve, reject) => {
      if (bodyObj.success) {
        // prepare the transaction records to be saved in the db
        prepareSuccessfulTransactionRecords(userId, orderId)
          .then((transactionRecords) => {
            // create the transactions
            createTransactions(transactionRecords[0], transactionRecords[1])
              .then(() => {
                // update redirect url with the order to NULL
                UserOrders.update({
                  redirectUrl: null,
                }, {
                  where: {
                    id: orderId,
                  },
                }).then(() => {
                  // respond
                  dispatchSuc(res, null);

                  // get the user balance
                  calculateBalance(userId)
                    .then((userBalance) => {
                      // send fcm msg to the user
                      const data = {
                        type: 'balance_updated',
                        title: 'Balance Updated',
                        message: 'Your balance has been updated',
                        userId,
                        balance: userBalance,
                        // data is deprecated, used only for notifications db table
                        data: `{ "balance":${userBalance},"type":"` + 'balance_updated' + '","message":"Your balance has been updated" }',
                      };

                      sendDataByUserId(UserLogins, data, false);
                      createNotification(null, 'Your balance has been updated', null, null, userId, null, null);
                    });
                }).catch(err => dispatchErr(res, err));
              })
              .catch(err => dispatchErr(res, err));
          })
          .catch(err => dispatchErr(res, err));
      } else if (!bodyParams.obj.pending) {
        // prepare failed transaction record
        prepareFailedTransactionRecord(userId, orderId)
          .then((transactionRecord) => {
            // create the record
            createTransactions(transactionRecord)
              .then(() => {
                // update the redirect url
                UserOrders.update({
                  redirectUrl: null,
                }, {
                  where: {
                    id: orderId,
                  },
                }).then(() => {
                  if (bodyParams.obj.data.message) {
                    reject([bodyParams.obj.data.message]);
                  } else reject(['Failed transaction']);
                }).catch(err => reject([err]));
              })
              .catch(err => dispatchErr(res, err));
          })
          .catch(err => dispatchErr(res, err));
      } else {
        reject(['Transaction is pending']);
      }
    },
  );

  // process the token
  const processToken = userId => new Promise(
    (resolve, reject) => {
      // add new card token in UserCardTokens
      const newUserCardTokensRecord = {
        id: createUuid(),
        userId,
        token: bodyObj.token,
        maskedPan: bodyObj.masked_pan,
        cardSubtype: bodyObj.card_subtype,
      };
      UserCardTokens.create(newUserCardTokensRecord)
        .then(() => dispatchSuc(res, null))
        .catch(err => dispatchErr(res, err));
    },
  );


  validateReqType()
    .then((reqType) => {
      // prepare vars
      const orderId = reqType === transactionType ? bodyObj.order.id : bodyObj.order_id;
      const hmacApiType = reqType === transactionType ? 'notificationTransaction' : 'notificationToken';
      validateHmac(bodyObj, hmac, hmacApiType)
        .then(() => {
          UserOrders.findOne({
            where: {
              id: orderId,
            },
          })
            .then((orderRecord) => {
              // process according to the request type
              if (reqType === transactionType) {
                processTranscation(orderRecord.userId, orderRecord.id)
                  .catch(err => dispatchErr(res, err));
              } else {
                processToken(orderRecord.userId)
                  .catch(err => dispatchErr(res, err));
              }
            }).catch(err => dispatchErr(res, [err]));
        }).catch(err => dispatchErr(res, err));
    }).catch(err => dispatchErr(res, err));
};

const acceptResponse = (req, res, next) => {
  const hmac = req.query.hmac;

  const queryParams = req.query;
  const orderId = queryParams.order;

  const updateRedirectionUrl = () => new Promise(
    (resolve, reject) => {
      // check if 3d secure
      const is_3d_secure = queryParams.is_3d_secure;
      if (is_3d_secure.toLowerCase() == 'true') {
        // save redirect url with the order
        UserOrders.update({
          redirectUrl: queryParams.redirect_url_3d_secure,
        }, {
          where: {
            id: orderId,
          },
        }).then(() => {
          resolve();
        }).catch(err => reject([err]));
      } else {
        resolve();
      }
    },
  );

  validateHmac(queryParams, hmac, 'responseTransaction')
    .then(() => {
      updateRedirectionUrl()
        .then(() => {
          UserOrders.findOne({
            where: {
              id: orderId,
            },
          })
            .then((orderRecord) => {
              UserTransactions.findAll({
                where: {
                  sourceId: orderId,
                  userId: orderRecord.userId,
                },
              }).then((userTransactions) => {
                calculateBalance(orderRecord.userId)
                  .then((balance) => {
                    successfulOrderTransactionsAmount(orderRecord.userId, orderId)
                      .then((totalTransactionsAmount) => {
                        let transactionMsg = null;
                        if (queryParams.data != undefined) {
                          transactionMsg = queryParams.data.message;
                        }

                        const resObj = {
                          ...queryParams,
                          redirection_url: orderRecord.redirectUrl,
                          orderRedirectUrl: orderRecord.redirectUrl,
                          successfulTransactionsAmount: totalTransactionsAmount,
                          transactionMessage: transactionMsg,
                          transactions: userTransactions,
                          userBalance: balance,
                        };

                        res.send(resObj)

                        // dispatchSuc(res, resObj);
                      }).catch(err => dispatchErr(res, err));
                  }).catch(err => dispatchErr(res, err));
              }).catch(err => dispatchErr(res, err));
            }).catch(err => dispatchErr(res, err));
        })
        .catch(err => dispatchErr(res, err));
    }).catch(err => dispatchErr(res, err));
};

const getAuthOrder = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;

  checkLoginToken(UserLogins, loginToken)
    .then(self => Users.findById(self)
      .then((userRecord) => {
        if (userRecord == null) {
          dispatchErr(res, ['Invalid userId']);
          return;
        }
        // get weaccept token
        paymentActions('authentication').then((authData) => {
          // create the order body
          const orderPrice = cardAuthAmount * 100;
          const orderBody = {
            merchant_id: authData.profile.id,
            amount_cents: orderPrice,
            items: [{
              name: 'Credit Card Authorization',
              amount_cents: orderPrice,
            }],
            shipping_data: {
              first_name: userRecord.firstName,
              last_name: userRecord.lastName,
              phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
              email: userRecord.email,
              shipping_method: 'DG',
            },
            delivery_needed: false,
          };

          // create the order in weaccept servers
          paymentActions('orderRegistration', authData.token, orderBody)
            .then((orderRegistrationData) => {
              // save the order in UserOrders
              const orderDataStr = JSON.stringify(orderRegistrationData);
              const userOrderRecord = {
                id: orderRegistrationData.id,
                userId: self,
                data: orderDataStr,
                creationDate: Date.now(),
              };
              UserOrders.create(userOrderRecord)
                .then(() => {
                  // create weaccept payment token body
                  const paymentKeyBody = {
                    order_id: orderRegistrationData.id,
                    amount_cents: orderPrice,
                    currency: 'EGP',
                    card_integration_id: cardIntegrationId, // cardAuthIntegrationId,
                    billing_data: {
                      first_name: userRecord.firstName,
                      last_name: userRecord.lastName,
                      phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
                      email: userRecord.email,
                      shipping_method: 'DG',
                      apartment: 'not specified',
                      floor: 'not specified',
                      street: 'not specified',
                      building: 'not specified',
                      city: 'not specified',
                      country: 'not specified',
                      state: 'not specified',
                    },
                  };

                  // get weaccept payment token
                  paymentActions('paymentKey', authData.token, paymentKeyBody)
                    .then((paymentKeyData) => {
                      // prepare the response content and respond with it
                      const content = {
                        orderId: orderRegistrationData.id,
                        paymentToken: paymentKeyData.token,
                      };
                      dispatchSuc(res, content);
                    }).catch(err => dispatchErr(res, err));
                }).catch(err => dispatchErr(res, err));
            }).catch(err => dispatchErr(res, err));
        }).catch(err => dispatchErr(res, err));
      }).catch(err => dispatchErr(res, err))).catch(err => dispatchErr(res, err));
};

const amanPayment = (req, res, next) => {
  if (!req.headers.logintoken) {
    dispatchErr(res, ['Logintoken is undefined']);
    return;
  }
  const loginToken = req.headers.logintoken;
  if (!req.body.packageId) {
    dispatchErr(res, ['Package id is undefined']);
    return;
  }
  const packageId = req.body.packageId;

  checkLoginToken(UserLogins, loginToken)
    .then((self) => {
      Users.findOne({
        where: {
          userId: self,
        },
      })
        .then((userRecord) => {
          // if (userRecord.status != 'verified') {
          //   dispatchErrContent(res, {
          //     verified: false,
          //   }, ['What is your university or company?']);
          //   return;
          // }

          PaymentPackages.findById(packageId)
            .then((packageRecord) => {
              // check the package record
              if (packageRecord == null) {
                dispatchErr(res, ['Sorry, this package is not found']);
                return;
              }

              paymentActions('authentication').then((authData) => {
                const orderPrice = (packageRecord.amount + extraFees) * 100;
                const orderBody = {
                  merchant_id: authData.profile.id,
                  amount_cents: orderPrice,
                  items: [{
                    name: `Foorera ${packageRecord.amount} EGP Package`,
                    amount_cents: orderPrice,
                  }],
                  shipping_data: {
                    first_name: userRecord.firstName,
                    last_name: userRecord.lastName,
                    phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
                    email: userRecord.email,
                    shipping_method: 'DG',
                  },
                  delivery_needed: false,
                };

                paymentActions('orderRegistration', authData.token, orderBody)
                  .then((orderRegistrationData) => {
                    const paymentKeyBody = {
                      order_id: orderRegistrationData.id,
                      amount_cents: orderPrice,
                      currency: 'EGP',
                      integration_id: amanIntegrationId,
                      billing_data: {
                        first_name: userRecord.firstName,
                        last_name: userRecord.lastName,
                        phone_number: Boolean(userRecord.cellphone) == false ? 'not specified' : userRecord.cellphone,
                        email: userRecord.email,
                        shipping_method: 'DG',
                        apartment: 'not specified',
                        floor: 'not specified',
                        street: 'not specified',
                        building: 'not specified',
                        city: 'not specified',
                        country: 'not specified',
                        state: 'not specified',
                      },
                    };

                    // save the order in UserOrders
                    const orderDataStr = JSON.stringify(orderRegistrationData);
                    const userOrderRecord = {
                      id: orderRegistrationData.id,
                      userId: self,
                      data: orderDataStr,
                      creationDate: Date.now(),
                    };
                    UserOrders.create(userOrderRecord)
                      .then(() => {
                        paymentActions('paymentKey', authData.token, paymentKeyBody)
                          .then((paymentKeyData) => {
                            const payBody = {
                              source: {
                                identifier: 'AGGREGATOR',
                                subtype: 'AMAN',
                              },
                              payment_token: paymentKeyData.token,
                            };
                            paymentActions('payOrder', null, payBody)
                              .then((payData) => {
                                // check bill ref
                                if (payData && payData.data && payData.data.bill_reference) {
                                  // response with the bill ref
                                  dispatchSuc(res, { amanBillRef: payData.data.bill_reference.toString() });
                                } else {
                                  dispatchErr(res, ["Can't get the bill reference, please contact support."]);
                                }
                              }).catch(err => dispatchErr(res, err));
                          }).catch(err => dispatchErr(res, err));
                      }).catch(err => dispatchErr(res, err));
                  }).catch(err => dispatchErr(res, err));
              }).catch(err => dispatchErr(res, err));
            }).catch(err => dispatchErr(res, err));
        }).catch(err => dispatchErr(res, err));
    }).catch(err => dispatchErr(res, err));
};

module.exports = {
  getUserCards,
  addCardToken,
  deleteCardtokens,
  getPaymentPackages,
  cardPayment,
  walletPayment,
  getBiilingaccounts,
  deleteBiilingaccounts,
  updateBiilingaccounts,
  addBiilingaccounts,
  acceptNotification,
  acceptResponse,
  getAuthOrder,
  amanPayment,
};
