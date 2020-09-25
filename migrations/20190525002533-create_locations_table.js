'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('Locations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      lat: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      lng: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      englishName: Sequelize.STRING(250),
      arabicName: Sequelize.STRING(250),
      notes: Sequelize.STRING(250),
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('Locations');
  }
};
