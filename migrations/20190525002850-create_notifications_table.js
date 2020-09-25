'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('Notifications', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      type: {
        type: Sequelize.STRING(30)
      },
      message: {
        type: Sequelize.STRING,
        allowNull: false
      },
      data: {
        type: Sequelize.STRING
      },
      timestamp: {
        type: Sequelize.DATE,
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('Notifications');
  }
};
