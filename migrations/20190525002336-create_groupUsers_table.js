'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('GroupUsers', {
      groupId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'pending'
      },
      joinEmail: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.dropTable('GroupUsers');
  }
};
