'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('RegularRide', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      driver: {
        type: Sequelize.UUID,
        allowNull: false
      },
      fromId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'from'
      },
      carId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      groupId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      toId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'to'
      },
      time: Sequelize.STRING(8),
      seats: Sequelize.INTEGER(2),
      status: Sequelize.STRING(20),
      creationDate: Sequelize.INTEGER(13),
      promoCode: {
        type: Sequelize.STRING(20),
        allowNull: true
      }
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('RegularRide');
  }
};
