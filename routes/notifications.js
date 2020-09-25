const {
  dispatchSuc, dispatchErr, dispatchErrContent, sendNotificationToSegment, checkLoginToken, sendOneSignalNotification,
} = require('../tools/tools');
const { UserLogins, FailedNotifications } = require('../models/index');

const env = process.env.NODE_ENV || 'development';
const config = require('../config/config.json')[env];
const request = require('request');
const axios = require('axios').default;

const sendToAll = (req, res, next) => {
  sendToSegment(req, res, next, null);
};

const sendNotification = (req, res, next) => {
  const id = req.params.id;
  if (id == 'android') {
    sendToSegment(req, res, next, 'android');
  } else if (id == 'ios') {
    sendToSegment(req, res, next, 'ios');
  } else {
    sendToUser(req, res, next);
  }
};

let sendToSegment = (req, res, next, segment) => {
  if (req.body.authKey === config.customAuthKey) {
    const title = req.body.title;
    const message = req.body.message;
    const data = req.body.data;

    sendNotificationToSegment(segment, title, message, data, false);
    dispatchSuc(res, []);
  } else {
    dispatchErr(res, ['Access Denied']);
  }
};

let sendToUser = (req, res, next) => {
  const userId = req.params.id;
  const authKey = req.body.authKey;
  const title = req.body.title;
  const message = req.body.message;
  const data = req.body.data;

  if (authKey === config.customAuthKey) {
    UserLogins.findOne({
      attributes: ['deviceId', 'deviceName'],
      where: {
        userId,
      },
    })
      .then((user) => {
        if (user) {
          sendOneSignalNotification([user], title, message, data);
          dispatchSuc(res, null);
        } else {
          dispatchErr(res, ['User not found']);
        }
      })
      .catch(err => dispatchErr(res, [err.message]));
  } else {
    dispatchErr(res, ['Access Denied']);
  }
};

const getNotifications = (req, res, next) => {
  checkLoginToken(UserLogins, req.headers.logintoken)
    .then((userId) => {
      req.query.userId = userId;
      request.get(`${config.notificationServerUrl}/?${Object.keys(req.query).map(key => `${key}=${req.query[key]}`).join('&')}`, {
        headers: {
          'auth-access-token': 'W+MpU2F+Uq5L9pHzLNdntYInx2WDiEDgQmHkWNDr',
        },
      }, (err, response, body) => {
        if (err) {
          return dispatchErr(res, err);
        }
        return dispatchSuc(res, JSON.parse(body));
      });
    })
    .catch((err) => {
      console.error(err);
      dispatchErr(res, err);
    });
};

const getNotificationsCount = (req, res, next) => {
  checkLoginToken(UserLogins, req.headers.logintoken)
    .then((userId) => {
      req.query.userId = userId;
      request.get(`${config.notificationServerUrl}/count?${Object.keys(req.query).map(key => `${key}=${req.query[key]}`).join('&')}`, {
        headers: {
          'auth-access-token': 'W+MpU2F+Uq5L9pHzLNdntYInx2WDiEDgQmHkWNDr',
        },
      }, (err, response, body) => {
        if (err) {
          return dispatchSuc(res, { count: 0 });
        }
        return dispatchSuc(res, JSON.parse(body));
      });
    })
    .catch((err) => {
      console.error(err);
      dispatchErr(res, err);
    });
};

const markNotificationAsRead = (req, res, next) => {
  checkLoginToken(UserLogins, req.headers.logintoken)
    .then((userId) => {
      const { notificationId } = req.body;
      req.query.userId = userId;
      console.log('NOTIFICATION BODY');
      console.log(notificationId);
      console.log('==================');
      axios.put(`${config.notificationServerUrl}/read?${Object.keys(req.query).map(key => `${key}=${req.query[key]}`).join('&')}`,
        {
          notificationId,
        },
        {
          headers: {
            'auth-access-token': 'W+MpU2F+Uq5L9pHzLNdntYInx2WDiEDgQmHkWNDr',
            'Content-Type': 'application/json',
          },
          body: {
            notificationId,
          },
        })
        .then((response, err) => {
          if (err) {
            FailedNotifications.create({
              notification: {
                type: 'mark as read',
                body: { userId, notificationId: JSON.stringify(notificationId) },
              },
            })
              .catch((err) => {
                console.error("Couldn't create failed notification entry");
                console.error(err);
              });
            return dispatchErr(res, err);
          }
          return dispatchSuc(res, null);
        });
    });
};

// POST /fcm/send
const sendPushNotification = (req, res) => {
  const authToken = req.headers['notification-auth-token'];
  const {
    userId, title, content, data,
  } = req.body;
  if (authToken !== '30244649914b27c1c8ceda2adf1df916a63b6b38106b75a94ff50dfd3a57') {
    console.log('INVALID AUTH');
    return dispatchErr(res, [new Error('Notification Auth token invalid')]);
  }
  if (!userId) {
    console.log('INVALID USER ID');
    return dispatchErr(res, ['No user id provided']);
  }
  if (!title || !content) {
    console.log('NO TITLE OR CONTENT');
    return dispatchErr(res, ['No title or content provided']);
  }
  console.log('Before user logins');
  UserLogins.findOne({
    where: {
      userId,
    },
  })
    .then((user) => {
      console.log('Found user login', JSON.stringify(user));
      if (!user) {
        return dispatchErr(res, ['No user found']);
      }
      console.log('One signal');
      const OSResponse = sendOneSignalNotification([user], title, content, data);
      console.log('OS', OSResponse);
      dispatchSuc(res, null);
    })
    .catch((err) => {
      dispatchErr(res, [err.message]);
    });
};


module.exports = {
  sendToAll,
  getNotifications,
  getNotificationsCount,
  markNotificationAsRead,
  sendNotification,
  sendPushNotification,
};
