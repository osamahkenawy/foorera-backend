'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('UserBillingAccounts', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      accountNumber: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      accountType: {
        type: Sequelize.STRING(15),
        allowNull: false
      },
      transferDetails: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: Sequelize.STRING(15),
      creationDate: Sequelize.INTEGER(13),
    })
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('UserBillingAccounts');
  }
};
