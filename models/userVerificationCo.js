

module.exports = function (sequelize, DataTypes) {
  const UserVerificationCo = sequelize.define('UserVerificationCo', {
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(4),
      primaryKey: true,
      allowNull: false,
    },
    sentTo: {
      type: DataTypes.INTEGER(50),
      allowNull: false,
    },
    sentAt: {
      type: DataTypes.INTEGER(30),
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
  return UserVerificationCo;
};
