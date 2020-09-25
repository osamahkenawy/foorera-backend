

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Groups', [
      {
        id: '74ec3ef24588-450e-8094-a9301eb2fc4a',
        name: 'Group 1',
        categoryId: '809b3ff7-e538-4db3-b6ed-172ded6f051e',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Groups', null, {});
  },
};
