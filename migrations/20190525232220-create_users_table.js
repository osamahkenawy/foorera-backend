'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('Users', {
      userId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      firstName: Sequelize.STRING(50),
      lastName: Sequelize.STRING(50),
      gender: Sequelize.INTEGER(1),
      picture: Sequelize.STRING,
      cellphone: Sequelize.STRING(20),
      ridesWith: Sequelize.INTEGER(1),
      email: {
        type: Sequelize.STRING(50),
        unique: true
      },
      encPassword: Sequelize.STRING(100),
      passwordResetToken: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      status: Sequelize.STRING(20),
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    })
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('Users');
  }
};
