

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('CarMakes', [
      {
        id: 'edb1a102-f0a6-4143-8fc4-4e3f1a8ebbed',
        name: 'Mecedes',
      },
      {
        id: '2694c25d-be7c-437e-9f2d-627c4e41157a',
        name: 'Volvo',
      },
      {
        id: 'c9ded543-7ec8-4903-9b57-5e997b68fefb',
        name: 'Audi',
      },
      {
        id: 'fc69a462-c88d-42d8-87c9-56df74d560c4',
        name: 'Tesla',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('CarMakes', null, {});
  },
};
