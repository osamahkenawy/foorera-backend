

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Categories', [
      {
        id: '775d58e1-22f8-424f-9d2b-b56a389b82ec',
        name: 'Category3',
        description: 'lorem ipsum dolor sit amet',
      },
      {
        id: '92199f93-155a-4573-a2cf-94d6279152e7',
        name: 'Category2',
        description: 'this is another category',
      },
      {
        id: '809b3ff7-e538-4db3-b6ed-172ded6f051e',
        name: 'Category1',
        description: 'this is a category',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Categories', null, {});
  },
};
