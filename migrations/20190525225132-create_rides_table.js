'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('Rides', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      regularRideId: Sequelize.UUID,
      driver: {
        type: Sequelize.UUID,
        allowNull: false
      },
      groupId: {
        type: Sequelize.UUID,
        allowNull: true
      },
      carId: {
        type: Sequelize.UUID,
        allowNull: true
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
      seats: Sequelize.INTEGER(2),
      date:  Sequelize.STRING(30),
      dateTime: Sequelize.STRING(14),
      time:  Sequelize.STRING(8),
      status: Sequelize.STRING(20),
      distance: {
        type: Sequelize.FLOAT(),
        allowNull: true
      },
      fare: {
        type: Sequelize.FLOAT(),
        allowNull: true
      },
      fareAfterCommission: {
        type: Sequelize.FLOAT(),
        allowNull: true
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
      promoCode: {
        type: Sequelize.STRING(20),
        allowNull: true
      }
    })
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('Rides');
  }
};
