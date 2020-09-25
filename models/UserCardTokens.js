

module.exports = function (sequelize, DataTypes) {
  var UserCardTokens = sequelize.define('UserCardTokens', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(70),
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    maskedPan: {
      type: DataTypes.STRING(25),
      allowNull: false,
    },
    cardSubtype: {
      type: DataTypes.STRING(15),
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
        UserCardTokens.belongsTo(models.Users, { foreignKey: 'userId', as: 'user' });
      },
    },
  });
  return UserCardTokens;
};
