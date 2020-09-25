

module.exports = function (sequelize, DataTypes) {
  var RideAlerts = sequelize.define('RideAlerts', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fromId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'from',
    },
    toId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'to',
    },
    status: DataTypes.STRING(20),
    creationDate: {
      type: DataTypes.INTEGER(13),
      defaultValue: Date.now(),
    },
  }, {
    classMethods: {
      associate(models) {
        // associations can be defined here
        RideAlerts.belongsTo(models.Users, { foreignKey: 'userId', as: 'user' });
        RideAlerts.belongsTo(models.Locations, { foreignKey: 'fromId', as: 'from' });
        RideAlerts.belongsTo(models.Locations, { foreignKey: 'toId', as: 'to' });
        RideAlerts.hasMany(models.RideAlertsDays, { foreignKey: 'rideAlertId' });
      },
    },
  });
  return RideAlerts;
};
