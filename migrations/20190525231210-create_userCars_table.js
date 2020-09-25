'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('UserCars', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false
      },
      maker: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      model: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      colorName: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      colorCode: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      plateNumber: {
        type: Sequelize.STRING(15),
        allowNull: false
      },
      status: Sequelize.STRING(20),
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('UserCars');
  }
};
