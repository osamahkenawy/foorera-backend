

module.exports = {
  up(queryInterface, Sequelize) {
    // Add seeder function here
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('UserCars', null, {});
  },
};
