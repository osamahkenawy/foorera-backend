

module.exports = function (sequelize, DataTypes) {
  var GroupDomains = sequelize.define('GroupDomains', {
    domain: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    groupId: {
      type: DataTypes.UUID,
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
    classMethods: {
      associate(models) {
        GroupDomains.belongsTo(models.Groups, { foreignKey: 'groupId' });
      },
    },
  });
  return GroupDomains;
};
