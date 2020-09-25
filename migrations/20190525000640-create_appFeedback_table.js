'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.createTable('AppFeedback', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      userId: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false
      },
      rating: {
        type: Sequelize.INTEGER(1)
      },
      feedbackText: Sequelize.STRING(250),
      createdAt: Sequelize.DATE,
      updatedAt: Sequelize.DATE,
    });
  },

  down: function (queryInterface) {
    return queryInterface.dropTable('AppFeedback')
  }
};
