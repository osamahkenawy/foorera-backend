'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('Settings', {
      skey: {
        type: Sequelize.STRING(40),
        primaryKey: true,
        allowNull: false
      },
      value: {
        type: Sequelize.STRING(40),
        allowNull: false
      },
      isPublic: {
        type: Sequelize.BOOLEAN,
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    })
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('Settings');
  }
};
