

module.exports = function (sequelize, DataTypes) {
  var AlertMatches = sequelize.define('AlertMatch', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    ride_id: {
      type: DataTypes.UUID,  
      allowNull: false,
    },
    ride_type: DataTypes.STRING(20),
    ride_alert_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  }, {
    tableName: 'alert_matches',
    classMethods: {
      associate(models) {
        // associations can be defined here
        AlertMatches.belongsTo(models.RideAlerts, { foreignKey: 'ride_alert_id', as: 'alert' });
      },
    },
  });
  return AlertMatches;
};
