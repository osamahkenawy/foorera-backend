'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('UserCardTokens', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      token: {
        type: Sequelize.STRING(70),
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      maskedPan: {
        type: Sequelize.STRING(25),
        allowNull: false
      },
      cardSubtype: {
        type: Sequelize.STRING(15),
        allowNull: false
      },
      createdAt:  Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('UserCardTokens');
  }
};
