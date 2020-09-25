

module.exports = function (sequelize, DataTypes) {
  var RegularRide = sequelize.define('RegularRide', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    driver: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fromId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'from',
    },
    carId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    groupId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    toId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'to',
    },
    time: {
      type: DataTypes.STRING(8),
      validate: {
        validatePhone(value) {
          if (!/^([01]\d|2[0-3])(:[0-5]\d){1,2}$/.test(value)) {
            throw new Error('leave time format error!');
          }
        },
      },
    },
    seats: DataTypes.INTEGER(2),
    status: DataTypes.STRING(20),
    creationDate: {
      type: DataTypes.INTEGER(13),
      defaultValue: Date.now(),
    },
    promoCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    ride_alert_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    freezeTableName: true,
    classMethods: {
      associate(models) {
        // associations can be defined here
        RegularRide.belongsTo(models.Locations, { foreignKey: 'fromId', as: 'from' });
        RegularRide.belongsTo(models.Locations, { foreignKey: 'toId', as: 'to' });
        RegularRide.belongsTo(models.Users, { foreignKey: 'driver', as: 'user' });
        RegularRide.belongsTo(models.Groups, { foreignKey: 'groupId' });
        RegularRide.belongsTo(models.RideAlerts, { foreignKey: 'ride_alert_id' });
        RegularRide.belongsTo(models.UserCars, { foreignKey: 'carId' });
        RegularRide.hasMany(models.RegularRideDays, { foreignKey: 'regularRideId' });
      },
    },
  });
  return RegularRide;
};
