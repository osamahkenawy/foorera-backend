

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Locations', [
      {
        id: '7354e321-df78-4724-ae6d-131eea75542c',
        lat: '31.2001',
        lng: '299187',
        englishName: 'Alexandria',
      },
      {
        id: '6b738036-bcc7-46b2-baea-9cf1ebe6e4b9',
        lat: '30.0444',
        lng: '31.2357',
        arabicName: 'القاهرة',
      },
      {
        id: '7e45c8b4-ee77-439d-8c8e-67d98f31e3f1',
        lat: '25.6872',
        lng: '32.6396',
        englishName: 'Luxor',
        notes: 'Lorem ipsum dolor sit amet',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Locations', null, {});
  },
};
