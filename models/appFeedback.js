

module.exports = function (sequelize, DataTypes) {
  const AppFeedback = sequelize.define('AppFeedback', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    rating: {
      type: DataTypes.INTEGER(1),
    },
    feedbackText: DataTypes.STRING(250),
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
  return AppFeedback;
};
