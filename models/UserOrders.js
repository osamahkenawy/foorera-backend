

module.exports = function (sequelize, DataTypes) {
  const UserOrders = sequelize.define('UserOrders', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    data: {
      type: DataTypes.STRING,
    },
    redirectUrl: {
      type: DataTypes.STRING,
    },
    creationDate: {
      type: DataTypes.INTEGER(13),
      defaultValue: Date.now(),
    },
  }, {
    classMethods: {
      associate(models) {
        // associations can be defined here
      },
    },
  });
  return UserOrders;
};
