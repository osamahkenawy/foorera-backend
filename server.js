require('dotenv').config()
const restify = require('restify');
const restifyValidator = require('restify-validator');

const routes = require('./routes/index');
const adminRoutes = require('./routes/admin');

const server = restify.createServer();

const cronJobs = require('./tools/cron');

server.use(restify.bodyParser());
server.use(restify.queryParser());
server.use(restifyValidator);

server.pre((request, response, next) => {
  console.log(`${request.method}: ${request.path()}`);
  next();
})

server.get('test_fcm', function(req, res) {
  const { sendOneSignalNotification, dispatchSuc, dispatchErr } = require('./tools/tools');
  sendOneSignalNotification([{deviceId: 'fKtPbbYMDHI:APA91bHNXuRwxpGHTEP8JWf8xTdKlJv8w2P1E5GHtwO3-vBP6SHySC4rh8vUX1nqD5M7h8A6QzutGrknDMG8tpxSsI-dfH1RpLW5JLHWjHN8Guf2ca-vVTfymqbuFjs6g6N5ZBRohKT4', deviceName: 'ios'}], 'Hello Foorera', 'Hello Foorera Users', {x: 'y'});
  dispatchSuc(res, []);
});

server.post('/feedback', routes.feedbacks.sendFeedback);

server.get('/config', routes.settings.getAllSettings);

server.get('/login/social', routes.logins.socialLogin);
server.get('/login/normal', routes.logins.normalLogin);
server.post('/login/register', routes.logins.register);
server.put('/login/deviceid', routes.logins.updateDeviceId);

server.get('/email/verify', routes.emails.verify);
server.get('/email/checkcode', routes.emails.checkCode);

server.get('/users/auth', routes.users.authenticateUser);
server.post('/users/fetch', routes.users.fetchProfiles);
server.get('/users/balance/details', routes.users.userBalanceDetails);
server.get('/users/:id', routes.users.profile);
server.put('/users/:id', routes.users.editProfile);
server.post('/users/:id/car', routes.users.addCar);
server.put('/users/:id/car', routes.users.editcar);
server.del('/users/:id/car', routes.users.deleteCar);
server.post('/users/:id/ridealert', routes.users.addRideAlert);
server.del('/users/:id/ridealert', routes.users.removeRideAlert);
server.put('/users/:id/ridealert', routes.users.editRideAlert);
server.get('/users/:id/ridealert', routes.users.getRideAlerts);
server.get('/users/:id/regularrides', routes.users.getRegularRides);
server.get('/users/:id/notifications', routes.users.getNotifications);
server.get('/users/:id/cardtokens', routes.payment.getUserCards);
server.post('/users/:id/cardtokens', routes.payment.addCardToken);
server.del('/users/:id/cardtokens', routes.payment.deleteCardtokens);
server.get('/users/:id/biilingaccounts', routes.payment.getBiilingaccounts);
server.del('/users/:id/biilingaccounts', routes.payment.deleteBiilingaccounts);
server.put('/users/:id/biilingaccounts', routes.payment.updateBiilingaccounts);
server.post('/users/:id/biilingaccounts', routes.payment.addBiilingaccounts);
server.get('/users/:id/ridesinfo', routes.users.getUserRidesInfo);
server.get('/users/:id/rides', routes.users.getRides);
server.get('/users/:id/regularandalerts', routes.users.getRegularAndAlerts);
server.post('/users/:id/connectfacebook', routes.users.connectFacebook);
server.post('/users/request_reset_password', routes.users.requestResetPassword);
server.post('/users/reset_password', routes.users.resetPassword);
server.post('/users/change_password', routes.users.changePassword);

server.get('/carmodels', routes.cars.getCarModels);
server.get('/carmakers', routes.cars.getCarMakes);

server.post('/regularrides', routes.regularRides.addRegularRide);
server.del('/regularrides/:id', routes.regularRides.removeRegularRide);
server.put('/regularrides/:id', routes.regularRides.editRegularRide);
server.get('/regularrides', routes.regularRides.searchRegularRides);

server.post('/rides', routes.rides.createRide);
server.get('/rides/active', routes.rides.activeRides);
server.get('/rides/:id', routes.rides.getRide);
server.put('/rides/:rideId', routes.rides.editRide);
server.post('/rides/:rideId/riders', routes.rides.joinRide);
server.put('/rides/:rideId/rate', routes.rides.rateRide);
server.put('/rides/:rideId/:agent', routes.rides.editRideStatus);
server.get('/rides/:rideId/fare', routes.rides.getRideFare);
server.del('/rides/:rideId', routes.rides.cancelRide);
server.get('/rides', routes.rides.searchRides);

server.get('/groupstypes', routes.groups.getGroupsTypes);
server.get('/groups/:groupId', routes.groups.groupsInfo);
server.get('/groups', routes.groups.getGroupList);
server.get('/groups/:groupId/regularrides', routes.groups.getGroupRegularRides);
server.put('/groups/:groupId/leave', routes.groups.leaveGroup);
server.post('/groups', routes.groups.addGroup);
server.get('/groups/:groupId/rides', routes.groups.groupRides);
server.get('/groups/:groupId/ridesinfo', routes.groups.getGroupRidesInfo);
server.get('/groupsregions', routes.groups.getGroupsRegions);

server.post('/notifications', routes.notifications.sendToAll);
server.post('/notifications/:id', routes.notifications.sendNotification);
server.get('/notifications', routes.notifications.getNotifications);
server.get('/notifications/count', routes.notifications.getNotificationsCount);
server.put('/notifications/read', routes.notifications.markNotificationAsRead);

server.post('/fcm/send', routes.notifications.sendPushNotification);

server.get('/payment/packages', routes.payment.getPaymentPackages);
server.post('/payment/card', routes.payment.cardPayment);
server.post('/payment/wallet', routes.payment.walletPayment);
server.post('/payment/aman', routes.payment.amanPayment);
server.post('/payment/acceptnotification', routes.payment.acceptNotification);
server.get('/payment/acceptresponse', routes.payment.acceptResponse);
server.post('/payment/authorder', routes.payment.getAuthOrder);

server.get('/ridealerts', routes.rideAlerts.getRideAlerts);

server.get('/promocodes/check', routes.promoCodes.checkPromoCode);

// Admin
server.get('/admin/groups', adminRoutes.groups.getAllGroups);
server.post('/admin/groups/toggle', adminRoutes.groups.toggleGroupStatus);

server.listen((process.env.PORT) ? parseInt(process.env.PORT, 10) : 3000, () => {
  console.log(`REST API Server listening at http://localhost:${(process.env.PORT) ? parseInt(process.env.PORT, 10) : 3000}`);
  // let cj = cronJobs.testCron();
  // setTimeout(function(){
  //     cj.stop()
  // }, 5000);
  // cronJobs.rideAlerts();
  cronJobs.oldPendingTransactions();
  cronJobs.rideAboutToStartNotification();
  
  require('./events')
  require('./queues')
});

// for testing
module.exports = server;
