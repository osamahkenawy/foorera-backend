'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('UserSocialNetworkAccounts', {
      userId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      accountKey: {
        type: Sequelize.STRING(30),
        allowNull: false
      },
      accountUsername: Sequelize.STRING(50),
      accessToken: Sequelize.STRING(200),
      socialUrl: Sequelize.STRING(254),
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    })
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('UserSocialNetworkAccounts');
  }
};
