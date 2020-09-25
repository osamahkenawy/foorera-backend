

module.exports = function (sequelize, DataTypes) {
  var PromoCodes = sequelize.define('PromoCodes', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    amount: {
      type: DataTypes.FLOAT(),
    },
    expirationDate: {
      type: DataTypes.DATE,
    },
    groupId: {
      type: DataTypes.STRING(36),
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
    classMethods: {
      associate(models) {
        PromoCodes.belongsTo(models.Groups);
      },
    },
  });
  return PromoCodes;
};
