

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Users', [
      {
        userId: 'cc66036f823f-40c5-ad3c-b32d474356ec',
        firstName: 'Admin',
        lastName: '1',
        gender: '1',
        email: 'admin@sharklasers.com',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Users', null, {});
  },
};
