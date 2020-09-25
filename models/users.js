

module.exports = function (sequelize, DataTypes) {
  var Users = sequelize.define('Users', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    firstName: DataTypes.STRING(50),
    lastName: DataTypes.STRING(50),
    gender: DataTypes.INTEGER(1),
    picture: {
      type: DataTypes.STRING,
      defaultValue: '',
    },
    cellphone: DataTypes.STRING(20),
    ridesWith: DataTypes.INTEGER(1),
    email: {
      type: DataTypes.STRING(50),
      unique: true,
    },
    encPassword: DataTypes.STRING(100),
    status: DataTypes.STRING(20),
    passwordResetToken: DataTypes.STRING(20),
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
        Users.hasMany(models.Rides, { foreignKey: 'driver', as: 'ride' });
        Users.hasMany(models.GroupUsers, { foreignKey: 'userId' });
        Users.hasMany(models.RideRiders, { foreignKey: 'userId' });
        Users.hasMany(models.RegularRide, { foreignKey: 'driver', as: 'user' });
        Users.hasMany(models.UserCardTokens, { foreignKey: 'userId', as: 'card' });
        Users.hasMany(models.RideAlerts, { foreignKey: 'userId', as: 'user' });
      },
    },
  });
  return Users;
};
