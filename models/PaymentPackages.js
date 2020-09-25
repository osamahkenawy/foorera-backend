

module.exports = function (sequelize, DataTypes) {
  const PaymentPackages = sequelize.define('PaymentPackages', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER(4),
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
      },
    },
  });
  return PaymentPackages;
};
