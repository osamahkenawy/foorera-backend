'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('RideRiders', {
      rideId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        primaryKey: true,
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
      riderRating: Sequelize.INTEGER(2),
      driverRating: Sequelize.INTEGER(2),
      riderComment: Sequelize.STRING(50),
      driverComment: Sequelize.STRING(50),
      status: Sequelize.STRING(20),
      fare: {
        type: Sequelize.FLOAT(),
        allowNull: true
      },
      fareAfterCommission: {
        type: Sequelize.FLOAT(),
        allowNull: true
      },
      distance: {
        type: Sequelize.FLOAT,
        allowNull: true
      },
      id: {
        type: Sequelize.UUID,
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('RideRiders');
  }
};
