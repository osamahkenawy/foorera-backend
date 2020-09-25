'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('UserTransactions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      sourceType: Sequelize.STRING(30),
      sourceId: Sequelize.STRING,
      amount: Sequelize.FLOAT,
      status: Sequelize.STRING(15),
      creationDate: Sequelize.INTEGER(13),
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('UserTransactions');
  }
};
