

module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('PromoCodes', {

    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: Sequelize.STRING(50),
    },
    amount: {
      type: Sequelize.FLOAT(),
    },
    expirationDate: {
      type: Sequelize.DATE,
    },
    groupId: {
      type: Sequelize.STRING(36),
      allowNull: false,
    },
    createdAt: {
      type: Sequelize.DATE,
    },
    updatedAt: {
      type: Sequelize.DATE,
    },

  }),


  down: queryInterface => queryInterface.dropTable('PromoCodes'),

};
