

module.exports = function (sequelize, DataTypes) {
  const UserSocialNetworkAccounts = sequelize.define('UserSocialNetworkAccounts', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    accountKey: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    accountUsername: DataTypes.STRING(50),
    accessToken: DataTypes.STRING(200),
    socialUrl: DataTypes.STRING(254),
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: sequelize.fn('NOW'),
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: sequelize.fn('NOW'),
    },
  }, {
    classMethods: {
      associate(models) {
        // associations can be defined here
      },
    },
  });
  return UserSocialNetworkAccounts;
};
