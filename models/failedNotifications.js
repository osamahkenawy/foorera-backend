

module.exports = function (sequelize, DataTypes) {
  const FailedNotifications = sequelize.define('FailedNotifications', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    notification: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: sequelize.fn('NOW'),
    },
  });
  return FailedNotifications;
};
