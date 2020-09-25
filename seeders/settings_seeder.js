

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Settings', [
      {
        skey: 'setting1',
        value: 'true',
        isPublic: '1',
      },
      {
        skey: 'setting2',
        value: 'true',
        isPublic: '1',
      },
      {
        skey: 'setting3',
        value: 'false',
        isPublic: '1',
      },
      {
        skey: 'setting4',
        value: 'false',
        isPublic: '0',
      },
      {
        skey: 'setting5',
        value: 'true',
        isPublic: '0',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Settings', null, {});
  },
};
