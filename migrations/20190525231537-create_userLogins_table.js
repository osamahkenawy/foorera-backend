'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('UserLogins', {
      deviceId: {
        type: Sequelize.STRING(155)
      },
      userId: {
        type: Sequelize.UUID
      },
      deviceName: Sequelize.STRING(20),
      loginToken: {
        type: Sequelize.STRING(64),
        primaryKey: true
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('UserLogins');
  }
};
