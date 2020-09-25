const request = require('request-promise');
const { UserTransactions } = require('../models/index');
const crypto = require('crypto');

const env = process.env.NODE_ENV || 'development';
const { paymentAuthUserName, paymentAuthPassword, hmacSecretKey } = require('../config/config.json')[env];

let options;

const paymentAction = (action, token, body) => {
  switch (action) {
    case 'authentication':
      options = {
        method: 'POST',
        uri: 'https://accept.paymobsolutions.com/api/auth/tokens',
        body: {
          username: paymentAuthUserName,
          password: paymentAuthPassword,
        },
        headers: {
          'content-type': 'application/json',
        },
        json: true, // Automatically stringifies the body to JSON
      };
      break;
    case 'paymentKey':
      options = {
        method: 'POST',
        uri: `https://accept.paymobsolutions.com/api/acceptance/payment_keys?token=${token}`,
        body,
        headers: {
          'content-type': 'application/json',
        },
        json: true, // Automatically stringifies the body to JSON
      };
      break;
    case 'tokenization':
      options = {
        method: 'POST',
        uri: `https://accept.paymobsolutions.com/api/acceptance/tokenization?payment_token=${token}`,
        body,
        headers: {
          'content-type': 'application/json',
        },
        json: true, // Automatically stringifies the body to JSON
      };
      break;
    case 'orderRegistration':
      options = {
        method: 'POST',
        uri: `https://accept.paymobsolutions.com/api/ecommerce/orders?token=${token}`,
        body,
        headers: {
          'content-type': 'application/json',
        },
        json: true, // Automatically stringifies the body to JSON
      };
      break;
    case 'payOrder':
      options = {
        method: 'POST',
        uri: 'https://accept.paymobsolutions.com/api/acceptance/payments/pay',
        body,
        headers: {
          'content-type': 'application/json',
        },
        json: true, // Automatically stringifies the body to JSON
      };
      break;
    case 'payOrderWithTokenization':
      options = {
        method: 'POST',
        uri: 'https://accept.paymobsolutions.com/api/acceptance/payments/pay',
        body,
        headers: {
          'content-type': 'application/json',
        },
        json: true, // Automatically stringifies the body to JSON
      };
      break;
    default:
  }
};

const calculateBalance = userId => new Promise(
  (resolve, reject) => {
    UserTransactions.sum('amount', { where: { userId, status: 'successful' } }).then((balance) => {
      // set balance = 0 if required
      balance = balance == null || isNaN(balance) ? 0 : balance;
      resolve(balance);
    }).catch(err => reject(err));
  },
);

const calculateActualBalance = userId => new Promise(
  (resolve, reject) => {
    UserTransactions.sum('amount', { where: { userId, status: { $or: ['successful', 'pending'] } } }).then((balance) => {
      // set balance = 0 if required
      balance = balance == null || isNaN(balance) ? 0 : balance;
      resolve(balance);
    }).catch(err => reject(err));
  },
);

const successfulOrderTransactionsAmount = (userId, orderId) => new Promise(
  (resolve, reject) => {
    UserTransactions.sum('amount', {
      where: {
        userId,
        sourceId: orderId,
        status: 'successful',
      },
    })
      .then((totalAmount) => {
        // set totalOrderAmount = 0 if required
        totalAmount = totalAmount == null || isNaN(totalAmount) ? 0 : totalAmount;
        resolve(totalAmount);
      }).catch(err => reject(err));
  },
);

const paymentActions = (action, token, body) => new Promise(
  (resolve, reject) => {
    paymentAction(action, token, body);
    request(options)
      .then((data) => {
        resolve(data);
      }).catch((err) => {
        // check if can get a message
        if (err.error !== null && isObject(err.error) && Boolean(err.error.error)) {
          reject([err.error.error]);
        } else if (err !== null && isObject(err) && Boolean(err.error)) {
          reject(err.error);
        } else {
          reject(err);
        }
      });
  },
);

let isObject = obj => typeof obj === 'object';

const validateHmac = (paramsObj, originalHmac, reqType) => new Promise(
  (resolve, reject) => {
    const typeNotificationTransaction = 'notificationTransaction';
    const typeResponseTransaction = 'responseTransaction';
    const typeNotificationToken = 'notificationToken';

    // prepare values arr according to the type
    if (reqType === typeNotificationTransaction || reqType === typeResponseTransaction) {
      const orderId = reqType === typeNotificationTransaction ? paramsObj.order.id : paramsObj.order;
      var valuesArr = [
        paramsObj.amount_cents,
        paramsObj.created_at,
        paramsObj.currency,
        paramsObj.error_occured,
        paramsObj.has_parent_transaction,
        paramsObj.id,
        paramsObj.integration_id,
        paramsObj.is_3d_secure,
        paramsObj.is_auth,
        paramsObj.is_capture,
        paramsObj.is_refunded,
        paramsObj.is_standalone_payment,
        paramsObj.is_voided,
        orderId,
        paramsObj.owner,
        paramsObj.pending,
        paramsObj.source_data.pan,
        paramsObj.source_data.sub_type,
        paramsObj.source_data.type,
        paramsObj.success,
      ];
    } else if (reqType === typeNotificationToken) {
      var valuesArr = [
        paramsObj.card_subtype,
        paramsObj.created_at,
        paramsObj.email,
        paramsObj.id,
        paramsObj.masked_pan,
        paramsObj.merchant_id,
        paramsObj.order_id,
        paramsObj.token,
      ];
    } else {
      reject(['Invalid type']);
    }

    let concValues = '';
    for (const val of valuesArr) {
      concValues += val;
    }
    calculatedHmac = crypto.createHmac('sha512', hmacSecretKey).update(concValues).digest('hex');
    if (calculatedHmac == originalHmac) {
      resolve();
    } else reject(['Invalid hmac']);
  },
);

module.exports = {
  paymentActions, calculateBalance, calculateActualBalance, validateHmac, successfulOrderTransactionsAmount,
};
