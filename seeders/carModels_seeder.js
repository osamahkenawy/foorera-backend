

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('CarModels', [
      {
        id: 'fd68f15f-014a-4972-80b6-9ac1a2f750f9',
        name: '250E',
        year: 2008,
        makeId: 'edb1a102-f0a6-4143-8fc4-4e3f1a8ebbed',
      },
      {
        id: '61379526-8f1c-4a89-92fb-93a399f2b979',
        name: 'SLK AMG',
        year: 2015,
        makeId: 'edb1a102-f0a6-4143-8fc4-4e3f1a8ebbed',
      },
      {
        id: '0661d973-3f23-48e9-bd87-acca6f9faf3c',
        name: 'TT',
        year: 2013,
        makeId: 'c9ded543-7ec8-4903-9b57-5e997b68fefb',
      },
      {
        id: 'c58a3c28-bb92-4d9b-9d92-95ccc7e0938c',
        name: 'Model S',
        year: 2016,
        makeId: 'fc69a462-c88d-42d8-87c9-56df74d560c4',
      },
      {
        id: '58142d14-f091-470f-92d8-5a6e3f2de7aa',
        name: 'X7',
        year: 2009,
        makeId: 'c9ded543-7ec8-4903-9b57-5e997b68fefb',
      },
      {
        id: '76081ad3-0212-4243-ae5f-98d5ada485f3',
        name: 'A4',
        year: 2014,
        makeId: '6d2b9384467743cfb0df75e8f3c5108d',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('CarModels', null, {});
  },
};
