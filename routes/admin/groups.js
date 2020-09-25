const { Groups, UserLogins } = require('../../models');
const { dispatchSuc, dispatchErr, checkLoginToken } = require('../../tools/tools');
const { isAdminUser } = require('./utils');

module.exports = {
  // route: GET /admin/groups
  getAllGroups: async (req, res) => {
    const loginToken = req.headers.logintoken;
    try {
      const userId = await checkLoginToken(UserLogins, loginToken);
      if (isAdminUser(userId)) {
        const allGroups = await Groups.findAll({
          attributes: ['id', 'name', 'status', 'icon', 'business_email', 'phone_number'],
        });
        dispatchSuc(res, allGroups);
      }
    } catch (err) {
      if (typeof err[0] === 'string') {
        dispatchErr(res, err[0]);
      } else {
        dispatchErr(res, err.message);
      }
    }
  },

  // route: POST /admin/groups/toggle
  toggleGroupStatus: async (req, res) => {
    const loginToken = req.headers.logintoken;
    const { groupId } = req.body;

    try {
      const userId = await checkLoginToken(UserLogins, loginToken);
      if (isAdminUser(userId)) {
        const group = await Groups.findOne({ where: { id: groupId } });
        if (group) {
          group.status = group.status === 'pending' ? 'done' : 'pending';
          await group.save();
          dispatchSuc(res, `group (${group.name}) status updated successfully`);
        } else {
          throw new Error('Group not exist');
        }
      }
    } catch (err) {
      if (typeof err[0] === 'string') {
        dispatchErr(res, err[0]);
      } else {
        dispatchErr(res, err.message);
      }
    }
  },

};
