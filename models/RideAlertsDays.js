

module.exports = function (sequelize, DataTypes) {
  var RideAlertsDays = sequelize.define('RideAlertsDays', {
    rideAlertId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    day: {
      type: DataTypes.INTEGER(2),
      primaryKey: true,
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
        RideAlertsDays.belongsTo(models.RideAlerts, { foreignKey: 'rideAlertId' });
      },
    },
  });
  return RideAlertsDays;
};
