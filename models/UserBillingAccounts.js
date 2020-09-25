

const { validateEgyptianMobileNumber } = require('../tools/validators');

module.exports = function (sequelize, DataTypes) {
  const UserBillingAccounts = sequelize.define('UserBillingAccounts', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    accountNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        validatePhone(value) {
          if (!validateEgyptianMobileNumber(value)) {
            throw new Error('phone format error!');
          }
        },
      },
    },
    accountType: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    transferDetails: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    status: {
      type: DataTypes.STRING(15),
      defaultValue: 'active',
    },
    creationDate: {
      type: DataTypes.INTEGER(13),
      defaultValue: Date.now(),
    },
  }, {
    classMethods: {
      associate(models) {
        // associations can be defined here
      },
    },
  });
  return UserBillingAccounts;
};
