'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('RegularRideDays', {
      regularRideId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      day: {
        type: Sequelize.INTEGER(2),
        primaryKey: true,
        allowNull: false
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('RegularRideDays');
  }
};
