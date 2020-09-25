'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('GroupAdmins', {
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
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,

    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('GroupAdmins');
  }
};
