

module.exports = function (sequelize, DataTypes) {
  var Groups = sequelize.define('Groups', {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(50),
      defaultValue: 'pending',
    },
    icon: {
      type: DataTypes.STRING(100),
    },
    categoryId: {
      type: DataTypes.STRING(36),
      allowNull: false,
    },
    regionId: {
      type: DataTypes.STRING(36),
      allowNull: false,
    },
    hr_email: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    domains: {
      type: DataTypes.STRING(400),
      allowNull: true,
    },
    contact_email: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    business_email: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    phone_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    private: {
      type: DataTypes.INTEGER(2),
      defaultValue: 0,
    },
    kmFare: {
      type: DataTypes.FLOAT(),
      allowNull: true,
    },
    cashPayment: {
      type: DataTypes.INTEGER(2),
      defaultValue: 0,
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
        Groups.belongsTo(models.Categories, { foreignKey: 'categoryId', as: 'category' });
        Groups.belongsTo(models.Regions, { foreignKey: 'regionId', as: 'region' });
        Groups.hasMany(models.GroupUsers, { foreignKey: 'groupId' });
        Groups.hasMany(models.GroupDomains, { foreignKey: 'groupId' });
        Groups.hasMany(models.Rides, { foreignKey: 'groupId' });
        Groups.hasMany(models.PromoCodes, { as: 'PromoCodes', foreignKey: 'groupId' });
      },
    },
  });
  return Groups;
};
