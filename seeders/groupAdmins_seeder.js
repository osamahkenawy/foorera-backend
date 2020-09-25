

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('GroupAdmins', [
      {
        groupId: '74ec3ef24588-450e-8094-a9301eb2fc4a',
        userId: 'cc66036f823f-40c5-ad3c-b32d474356ec',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('GroupAdmins', null, {});
  },
};
