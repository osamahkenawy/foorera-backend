

module.exports = {
  up(queryInterface, Sequelize) {
    return queryInterface.bulkInsert('Rides', [
      {
        id: '6d8533a6-988a-4217-a511-88c108ce1be7',
        driver: '4ba0144d-e19b-4a23-a539-064015ad8c9e',
        from: '6b738036-bcc7-46b2-baea-9cf1ebe6e4b9',
        to: '7e45c8b4-ee77-439d-8c8e-67d98f31e3f1',
        time: '18:04,mar',
      },
    ], {});
  },

  down(queryInterface, Sequelize) {
    return queryInterface.bulkDelete('Rides', null, {});
  },
};
