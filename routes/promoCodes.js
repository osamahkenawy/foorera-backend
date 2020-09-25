const { UserLogins, Groups } = require('../models/index');
const {
  dispatchSuc, dispatchErr, checkLoginToken, validatePromoCode,
} = require('../tools/tools');

// /promocodes/check route
const checkPromoCode = (req, res, next) => {
  const loginToken = req.headers.logintoken;
  const promoCode = req.query.promoCode;

  // check promoCode
  if (!promoCode) {
    dispatchErr(res, ['promoCode is required']);
    return;
  }

  checkLoginToken(UserLogins, loginToken)
    .then(() => validatePromoCode(promoCode, '')
      .then(promoCodeExpiration => dispatchSuc(res, { promoCode, promoCodeExpiration }))
      .catch(err => dispatchErr(res, [err.message]))).catch(err => dispatchErr(res, err));
};

module.exports = { checkPromoCode };
