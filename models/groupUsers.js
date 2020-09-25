

module.exports = function (sequelize, DataTypes) {
  var GroupUsers = sequelize.define('GroupUsers', {
    groupId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'pending',
    },
    joinEmail: {
      type: DataTypes.STRING(50),
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
        GroupUsers.belongsTo(models.Groups, { foreignKey: 'groupId' });
        GroupUsers.belongsTo(models.Users, { foreignKey: 'userId' });
      },
    },
  });
  return GroupUsers;
};
