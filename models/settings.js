

module.exports = function (sequelize, DataTypes) {
  const Settings = sequelize.define('Settings', {
    skey: {
      type: DataTypes.STRING(40),
      primaryKey: true,
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
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
        // associations can be defined here
      },
    },
  });
  return Settings;
};
