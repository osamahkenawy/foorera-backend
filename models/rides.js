

module.exports = function (sequelize, DataTypes) {
  var Rides = sequelize.define('Rides', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    regularRideId: {
      type: DataTypes.UUID,
    },
    driver: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    groupId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    carId: {
      type: DataTypes.UUID,
      allowNull: true,
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
    seats: DataTypes.INTEGER(2),
    date: {
      type: DataTypes.STRING(30),
      validate: {
        parseDate(value) {
          const m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
          if (!m) {
            throw new Error('date format error!');
          }
        },
      },
    },
    dateTime: {
      type: DataTypes.STRING(14),
    },
    time: {
      type: DataTypes.STRING(8),
      validate: {
        validatePhone(value) {
          if (!/^([01]\d|2[0-3])(:[0-5]\d){1,2}$/.test(value)) {
            throw new Error('time format error!');
          }
        },
      },
    },
    status: {
      type: DataTypes.STRING(20),
      // defaultValue: 'pending'
    },
    distance: {
      type: DataTypes.FLOAT(),
      allowNull: true,
    },
    fare: {
      type: DataTypes.FLOAT(),
      allowNull: true,
    },
    fareAfterCommission: {
      type: DataTypes.FLOAT(),
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: sequelize.fn('NOW'),
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: sequelize.fn('NOW'),
    },
    promoCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  }, {
    setterMethods: {
      id(value) {
        const { RideDistanceFareByRideId } = require('../tools/geocoding');
        this.setDataValue('id', value);
        RideDistanceFareByRideId(value, 15000);
      },
    },

    freezeTableName: true,
    classMethods: {
      associate(models) {
        // associations can be defined here
        Rides.belongsTo(models.Locations, { foreignKey: 'fromId', as: 'from' });
        Rides.belongsTo(models.Locations, { foreignKey: 'toId', as: 'to' });
        Rides.hasMany(models.RideRiders, { foreignKey: 'rideId' });
        // Rides.belongsTo(models.RideRiders, { foreignKey: 'id', as: 'ride' })
        Rides.belongsTo(models.Users, { foreignKey: 'driver', as: 'user' });
        Rides.belongsTo(models.Groups, { foreignKey: 'groupId' });
      },
    },
  });
  return Rides;
};
