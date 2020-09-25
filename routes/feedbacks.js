const { AppFeedback, UserLogins, Users } = require('../models/index');
const {
  dispatchSuc, dispatchErr, checkPermissions, checkLoginToken, prepareInput, createUuid,
} = require('../tools/tools');

const env = process.env.NODE_ENV || 'development';
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

// /feedback route
const sendFeedback = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const rawNewFeedback = req.body;

  // Add Feedback
  const addFeedback = newFeedback => new Promise(
    (resolve, reject) => {
      newFeedback.id = createUuid();
      AppFeedback
        .create(newFeedback)
        .then(() => {
          resolve();
        }).catch(err => reject([err.message]));
    },
  );

  // Send Feeback Email
  const sendFooreraEmail = (feedback) => {
    // get user full name
    Users.findById(feedback.userId)
      .then((user) => {
        // prepare the mail body
        const mailBody = `Feedback id: ${feedback.id}
        <br />User id: ${user.userId}
        <br />User full name: ${`${user.firstName} ${user.lastName}`}
        <br />User email address: ${user.email}
        <br />Feedback: ${feedback.feedbackText}`;

        // prepare the mail options
        const mailOptions = {
          from: '"Foorera Feedback" <support@foorera.com>',
          to: 'feedback@foorera.com',
          subject: 'New feedback',
          html: mailBody,
        };

        // then send the email
        transporter.sendMail(mailOptions);
      });
  };

  // The Promises chain firstly validates the loginToken then
  // if the userId is passed in the `body` corresponds to the
  // one associated with the loginToken the Feedback is created
  checkLoginToken(UserLogins, loginToken)
    .then(loggedUserId => checkPermissions(loggedUserId, rawNewFeedback.userId)
      .then(() => prepareInput(rawNewFeedback)
        .then(newFeedback => addFeedback(newFeedback)
          .then(() => {
            dispatchSuc(res, []);
            sendFooreraEmail(newFeedback);
          })
          .catch(err => dispatchErr(res, err)))
        .catch(err => dispatchErr(res, err)))
      .catch(err => dispatchErr(res, err)))
    .catch(err => dispatchErr(res, err));
};

module.exports = { sendFeedback };
