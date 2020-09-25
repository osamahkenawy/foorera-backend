const { UserLogins, Settings } = require('../models/index');
const { dispatchSuc, dispatchErr, checkLoginToken } = require('../tools/tools');

// /config route
const getAllSettings = (req, res, next) => {
  const loginToken = req.headers.logintoken;

  // If Promise is resolved the passed loginToken is valid
  // and it sends back all settings. If it is rejected
  // loginToken is not valid or missing, only public
  // settings are sent back.
  checkLoginToken(UserLogins, loginToken)
    .then(() => Settings.findAll({})
      .then(settings => dispatchSuc(res, settings))
      .catch(err => dispatchErr(res, [err.message])))
    .catch(() => Settings.findAll({
      where: { isPublic: 1 },
    })
      .then(settings => dispatchSuc(res, settings))
      .catch(err => dispatchErr(res, [err.message])));
};

module.exports = { getAllSettings };
