

module.exports = function (sequelize, DataTypes) {
  const UserTransactions = sequelize.define('UserTransactions', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    sourceType: {
      type: DataTypes.STRING(30),
    },
    sourceId: DataTypes.STRING,
    amount: DataTypes.FLOAT,
    status: {
      type: DataTypes.STRING(15),
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
  return UserTransactions;
};
