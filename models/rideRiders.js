
module.exports = function (sequelize, DataTypes) {
  var RideRiders = sequelize.define('RideRiders', {
    rideId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
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
    riderRating: DataTypes.INTEGER(2),
    driverRating: DataTypes.INTEGER(2),
    riderComment: DataTypes.STRING(50),
    driverComment: DataTypes.STRING(50),
    status: DataTypes.STRING(20),
    fare: {
      type: DataTypes.FLOAT(),
      allowNull: true,
    },
    fareAfterCommission: {
      type: DataTypes.FLOAT(),
      allowNull: true,
    },
    distance: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    id: {
      type: DataTypes.UUID,
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
        RideRiders.belongsTo(models.Locations, { foreignKey: 'fromId', as: 'from' });
        RideRiders.belongsTo(models.Locations, { foreignKey: 'toId', as: 'to' });
        RideRiders.belongsTo(models.Rides, { foreignKey: 'rideId' });
        RideRiders.belongsTo(models.Rides, { foreignKey: 'rideId', as: 'ride' });
        RideRiders.belongsTo(models.Users, { foreignKey: 'userId' });
      },
    },
  });
  return RideRiders;
};
