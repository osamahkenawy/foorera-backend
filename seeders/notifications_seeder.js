'use strict'

module.exports = {
  up: function (queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Notifications', [
      {
        id: 'testID1',
        rideId: 'testRideId1'
        loginToken: 'testLoginToken1',
        timestamp: 'testTimestamp1',
        message: 'testMessage1'
      }
    ], {})
  },

  down: function (queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Notifications', null, {})
  }
}
