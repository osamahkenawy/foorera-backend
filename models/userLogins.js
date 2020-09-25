

module.exports = function (sequelize, DataTypes) {
  const UserLogins = sequelize.define('UserLogins', {
    deviceId: {
      type: DataTypes.STRING(155),
    },
    userId: {
      type: DataTypes.UUID,
    },
    deviceName: DataTypes.STRING(20),
    loginToken: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
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
  return UserLogins;
};
