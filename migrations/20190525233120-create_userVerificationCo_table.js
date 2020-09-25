'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('UserVerificationCo', {
      userId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      code: {
        type: Sequelize.STRING(4),
        primaryKey: true,
        allowNull: false
      },
      sentTo: {
        type: Sequelize.INTEGER(50),
        allowNull: false
      },
      sentAt: {
        type: Sequelize.INTEGER(30),
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('UserVerificationCo');
  }
};
