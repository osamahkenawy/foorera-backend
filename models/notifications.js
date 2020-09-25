

module.exports = function (sequelize, DataTypes) {
  var Notifications = sequelize.define('Notifications', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    type: {
      type: DataTypes.STRING(30),
    },
    message: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    data: {
      type: DataTypes.STRING,
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
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
    freezeTableName: true,

    classMethods: {
      associate(models) {
        // associations can be defined here
        Notifications.belongsTo(models.Notifications);
      },
    },
  });
  return Notifications;
};
