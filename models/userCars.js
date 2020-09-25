

module.exports = function (sequelize, DataTypes) {
  const UserCars = sequelize.define('UserCars', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    maker: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    model: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    colorName: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    colorCode: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },
    plateNumber: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    status: DataTypes.STRING(20),
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
      },
    },
  });
  return UserCars;
};
