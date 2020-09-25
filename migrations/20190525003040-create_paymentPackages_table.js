'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('PaymentPackages', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      amount: {
        type: Sequelize.INTEGER(4),
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    })
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('PaymentPackages');
  }
};
