

module.exports = function (sequelize, DataTypes) {
  var Locations = sequelize.define('Locations', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    lat: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    lng: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    englishName: DataTypes.STRING(250),
    arabicName: DataTypes.STRING(250),
    notes: DataTypes.STRING(250),
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
        Locations.hasMany(models.RideAlerts, { foreignKey: 'fromId' });
        Locations.hasMany(models.RideAlerts, { foreignKey: 'toId' });
        Locations.hasMany(models.RegularRide, { foreignKey: 'fromId' });
        Locations.hasMany(models.RegularRide, { foreignKey: 'toId' });
      },
    },
  });
  return Locations;
};
