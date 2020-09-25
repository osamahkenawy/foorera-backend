'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('Groups', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      name: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'pending'
      },
      icon: {
        type: Sequelize.STRING(100)
      },
      categoryId: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      regionId: {
        type: Sequelize.STRING(36),
        allowNull: false
      },
      hr_email: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      domains: {
        type: Sequelize.STRING(400),
        allowNull: true
      },
      contact_email: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      business_email: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      phone_number: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      private: {
        type: Sequelize.INTEGER(2),
        defaultValue: 0
      },
      kmFare: {
        type: Sequelize.FLOAT(),
        allowNull: true
      },
      cashPayment: {
        type: Sequelize.INTEGER(2),
        defaultValue: 0
      },
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('Groups');
  }
};
