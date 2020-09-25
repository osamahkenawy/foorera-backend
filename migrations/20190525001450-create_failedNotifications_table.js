'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('FailedNotifications', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      notification: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      createdAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('FailedNotifications');
  }
};
