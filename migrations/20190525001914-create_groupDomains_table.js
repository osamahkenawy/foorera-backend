'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('GroupDomains', {
      domain: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      groupId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('GroupDomains');
  }
};
