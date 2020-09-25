

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('GroupDomains', [
      {
        groupId: '74ec3ef24588-450e-8094-a9301eb2fc4a',
        domain: 'sharklasers.com',
      },
      {
        groupId: '74ec3ef24588-450e-8094-a9301eb2fc4a',
        domain: 'microsoft.com',
      },
      {
        groupId: 'eed2f1ec-d8c2-4631-96b8-ea67c0f050f5',
        domain: 'facebook.com',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('GroupDomains', null, {});
  },
};
