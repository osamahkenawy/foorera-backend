module.exports = {
  isAdminUser: (userId) => {
    if (userId === process.env.ADMIN_USER_ID) {
      return true;
    }
    throw new Error('not authorized');
  },
};
