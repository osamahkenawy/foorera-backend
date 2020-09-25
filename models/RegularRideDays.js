

module.exports = function (sequelize, DataTypes) {
  var RegularRideDays = sequelize.define('RegularRideDays', {
    regularRideId: {
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
        RegularRideDays.belongsTo(models.RegularRide, { foreignKey: 'regularRideId' });
      },
    },
  });
  return RegularRideDays;
};
