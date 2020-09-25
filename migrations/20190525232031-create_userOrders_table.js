'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('UserOrders', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      data: Sequelize.STRING,
      redirectUrl: Sequelize.STRING,
      creationDate: Sequelize.INTEGER(13),
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('UserOrders');
  }
};
