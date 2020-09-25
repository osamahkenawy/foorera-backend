'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('RideAlerts', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      fromId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'from'
      },
      toId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'to'
      },
      status: Sequelize.STRING(20),
      creationDate: Sequelize.INTEGER(13),
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('RideAlerts');
  }
};
