var {
	sequelize,
	Sequelize,
	Rides,
	RideRiders,
	RegularRide,
	Locations,
	UserLogins,
	ridealertsdays,
	Notifications,
	UserCars,
	Users,
	GroupUsers,
	Groups,
	UserTransactions,
	PaymentPackages
} = require('../models/index')
var {
	dispatchSuc,
	dispatchErr,
	checkLoginToken,
	prepareInput,
	validateTime,
	checkLocations,
	validateDate,
	sendDataByUserId,
	createUuid,
	createNotification,
	formatNotificationDate,
	sendData,
	checkPermissions,
	removeDuplicates,
	tConvert,
	checkUserVerification,
	dispatchErrContent,
	convertToTimestamp,
	convertRegularRideToRide,
	getWeekDayIndex,
	isToday,
	getCurrentTime,
	checkUserRidesAtDateAndTime,
	validatePromoCode
} = require('../tools/tools')

const { eventEmitter } = require('../events')

var {
	calculateBalance, calculateActualBalance
} = require('../tools/paymentAPI')
var Q = require('q')
var moment = require('moment')
const momentTimezone = require('moment-timezone');
var {
	getOrAddLocations,
	RideDistanceFareByRideId,
	getDistancBetweenCoordinates
} = require("../tools/geocoding")
const wrap = require('co-express')
var {
	getRegularRideById
} = require('./regularRides')

var env = process.env.NODE_ENV || 'development'
var config = require('../config/config.json')[env]

let nodemailer = require('nodemailer');

// create reusable transporter object using the default SMTP transport
const transporter = nodemailer.createTransport({
	host: process.env.MAILGUN_HOST,
	port: process.env.MAILGUN_PORT,
	secure: false,
	auth: {
	  user: process.env.MAILGUN_USER,
	  pass: process.env.MAILGUN_PASS,
	},
  });

let {
	getSupportMailTemp
} = require('../support-mail-temp')

const redisClient = require('redis').createClient({
	//  password: process.env.REDIS_PASS || "1Y4BiGvIwI19/VVcuOzaY9EhsEkYtEm+x/I27vu6DiCmcnzZQtwDnsk3CnHBu+KhgMIy5yYhfggoMVa9lzb/i1aMDi1t4U4CkYBmRlZHwN5fYEwMY9jnPQXu3gXY3Eq7wQR/m8toEM5Qv8JDvL0vKjyFvLlhgzulLxqs6BTut0JN73BzD/Lf2aYVTzKDFN1jpN/kB6ZX2U5skbMMbQpImNDAO4P4RXb3MWRW8KLCRKKwFiwTZJo9XfFcAATbp65oy/vscee7mgR+r+zuMPJHjxdvLOP2LQWzFfIUcUCsfPjiuNFhw0rX7aQVMeu6dIrKWASU91RY/ftJ3A==",
	port: process.env.REDIS_PORT || 6379,
	host: process.env.REDIS_HOST || 'localhost',

});
redisClient.AUTH(process.env.REDIS_PASS || "1Y4BiGvIwI19/VVcuOzaY9EhsEkYtEm+x/I27vu6DiCmcnzZQtwDnsk3CnHBu+KhgMIy5yYhfggoMVa9lzb/i1aMDi1t4U4CkYBmRlZHwN5fYEwMY9jnPQXu3gXY3Eq7wQR/m8toEM5Qv8JDvL0vKjyFvLlhgzulLxqs6BTut0JN73BzD/Lf2aYVTzKDFN1jpN/kB6ZX2U5skbMMbQpImNDAO4P4RXb3MWRW8KLCRKKwFiwTZJo9XfFcAATbp65oy/vscee7mgR+r+zuMPJHjxdvLOP2LQWzFfIUcUCsfPjiuNFhw0rX7aQVMeu6dIrKWASU91RY/ftJ3A==")
redisClient.on("error", function (err) {
	console.error(err);
});

const getRideFare = (req, res, next) => {
	const loginToken = req.headers.logintoken
	const { fromLat, fromLng, toLat, toLng } = req.params

	checkLoginToken(UserLogins, loginToken).then(loggedUserId => {
		// Calculate fare using from and to locations
		RideDistanceFareByRideId(null, 0, {
			from: {
				lat: fromLat,
				lng: fromLng,
			},
			to: {
				lat: toLat,
				lng: toLng,
			},
		}).then(fareObject => dispatchSuc(res, fareObject))
		.catch(err => dispatchErr(res, err))
	}).catch(err => dispatchErr(res, err))
}


let getRideById = (rideId) =>
	new Promise((resolve, reject) =>
		Rides.findById(rideId, {
			include: [
				{
					model: Users,
					as: 'user',
					attributes: ['userId', 'firstName', 'lastName', 'picture', 'gender', 'ridesWith', 'cellphone', 'status'],
					include: []
				},
				{
					model: Groups
				},
				{
					model: Locations,
					as: 'from'
				},
				{
					model: Locations,
					as: 'to'
				},
			],
		})
			.then((ride) => {
				if (ride === null) {
					console.log(rideId)
					reject(["rideId is invalid"])
					return
				}

				//console.log(ride.dateTime)
				UserCars.findById(ride.carId, {
					attributes: ['userId', 'id', 'colorCode', 'maker', 'model', 'plateNumber', 'status', 'colorName']
				}).then((car) => {
					Groups.findOne({
						attributes: ['id', 'name', 'status', 'icon', 'categoryId'],
						where: {
							id: ride.Group ? ride.Group.id : 0,
						},
						order: 'name',
						include: [{
							model: GroupUsers,
							attributes: ['status'],
							required: false,
							include: [{
								model: Users,
								attributes: ['status']
							}]
						}]
					})
						.then((groups) => {
							// if (groups === null)
							// 	resolve(memberCount)
							// else {

								var memberCount = 0
								if (groups && groups.GroupUsers) {
									for (j = 0; groups.GroupUsers && j < groups.GroupUsers.length; j++) {
										if (groups.GroupUsers[j].status == 'verified' &&
											groups.GroupUsers[j].User && groups.GroupUsers[j].User.status == 'verified') {
											memberCount++;
										}
									}
								}

								RideRiders.findAll({
									where: {
										rideId: rideId
									},
									attributes: ['userId', 'status', 'riderRating', 'fare', 'fareAfterCommission', 'driverRating', 'riderComment', 'driverComment'],
									include: [{
										model: Users,
										attributes: ['userId', 'firstName', 'lastName', 'picture', 'gender', 'ridesWith', 'cellphone', 'status']
									}]
								})
									.then((rideRiders) => {
										//find rides that the driver is attended
										let riders = []
										for (i = 0; rideRiders && i < rideRiders.length; i++) {
											riders[i] = {};
											riders[i].userId = rideRiders[i].User.userId
											riders[i].firstName = rideRiders[i].User.firstName
											riders[i].lastName = rideRiders[i].User.lastName
											riders[i].picture = rideRiders[i].User.picture
											riders[i].gender = rideRiders[i].User.gender
											riders[i].cellphone = rideRiders[i].User.cellphone
											riders[i].ridesWith = rideRiders[i].User.ridesWith
											riders[i].tripStatus = rideRiders[i].status
											riders[i].tripFare = rideRiders[i].fare ? rideRiders[i].fare : 0
											riders[i].tripFareAfterCommission = rideRiders[i].fareAfterCommission ? rideRiders[i].fareAfterCommission : 0
											riders[i].riderComment = rideRiders[i].riderComment
											riders[i].driverComment = rideRiders[i].driverComment
											riders[i].riderRating = rideRiders[i].riderRating
											riders[i].driverRating = rideRiders[i].driverRating
											riders[i].status = rideRiders[i].User.status
										}
										if (ride.Group) {
											ride.Group.dataValues.memberCount = memberCount
										}
										ride.set('car', car, {
											raw: true
										})
										ride.set('riders', riders, {
											raw: true
										})
										ride.set('driver', ride.user, {
											raw: true
										})
										ride.set('user', null, {
											raw: true
										})
										resolve(ride)
									})
									.catch((err) => reject([err.message]))
							//}
						}).catch((err) => reject([err]))
				}).catch((err) => reject([err]))
			}).catch((err) => reject([err]))
	)


// /rides/{:id} route
let getRide = (req, res, next) => {
	let loginToken = req.headers.logintoken
	let rideId = req.params.id
	
	// TODO: Insert search rides here
	// This Promises chain validates loginToken, then
	// searches and returns the ride informations
	checkLoginToken(UserLogins, loginToken)
		.then((loggedUserId) => {
			getRideById(rideId)
				.then((ride) => dispatchSuc(res, ride))
				.catch((err) => dispatchErr(res, err))
		})
		.catch((err) => dispatchErr(res, err))
}

// /rides/{:rideId}/riders route
let joinRide = (req, res, next) => {
	let loginToken = req.headers.logintoken
	let rawNewRider = {}
	rawNewRider.rideId = req.params.rideId
	let rideType = req.query.rideType === undefined ?
		'normalRide' :
		req.query.rideType
	if (rideType == 'regularRide' && req.query.date === undefined) {
		dispatchErr(res, ['No date passed'])
		return
	}
	if (rideType == 'regularRide' && req.query.date !== undefined) {
		validateDate(req.query.date) === true ? req.query.date : dispatchErr(res, ["Date format is not valid "])
	}

	let date = req.query.date

	let checkRideFare = (ride) =>
		new Promise(
			(resolve, reject) => {
				if (ride.fare == null) {
					RideDistanceFareByRideId(ride.id, 0)
						.then((fareDistance) => {
							// set new properties
							ride.distance = fareDistance.distance
							ride.fare = fareDistance.fare
							ride.fareAfterCommission = fareDistance.fareAfterCommission

							// and resolve with the ride
							resolve(ride)
						}).catch((err) => reject([err]))
				} else {
					resolve(ride)
				}
			})

	let checkFareDistance = (ride, riderId) =>
		new Promise(
			(resolve, reject) => {
				// check ride fare
				checkRideFare(ride)
					.then((ride) => {
						// check if the ride group has cash payment or not
						if (ride.Group && ride.Group.cashPayment) {
							// has cash payment,
							// no need to check the user balance with the ride fare,
							// resolve 
							resolve(ride)
						} else {
							// group has no cash payment,
							// calculate the user actual balance to check it with the ride fare
							calculateActualBalance(riderId).then((balance) => {
								// check fare with balance
								if (balance < ride.fare) {
									PaymentPackages.findOne({
										where: {
											amount: {
												$gte: ride.fare - balance
											}
										},
										order: [
											['amount', 'ASC']
										]
									})
										.then((package) => {
											if (!package) {
												dispatchErrContent(res, {
													"enough_balance": false,
													"rideFare": ride.fare,
													"balance": balance
												}, ["Sorry, not enough balance in your account"])
											} else {
												dispatchErrContent(res, {
													"enough_balance": false,
													"rideFare": ride.fare,
													"balance": balance
												}, [`Sorry, not enough balance. Minimum required package is ${package.amount}`])
											}
										})
										.catch((err) => dispatchErrContent(res, {
											"enough_balance": false,
											"rideFare": ride.fare,
											"balance": balance
										}, ["Sorry, not enough balance in your account"].concat(err)))
								} else {
									// Check for user photo
									
									resolve(ride)
								}
							}).catch((err) => reject([err]))
						}
					})
					.catch((err) => reject(err))
			}
		)

	let checkUserPhoto = userId => new Promise((resolve, reject) => {
		Users.findById(userId).then(userData => {
			if ( !! userData.picture) {
				resolve();
			} else {
				dispatchErrContent(res, {
					enough_balance: true,
					no_photo: true,
				}, ["Please add your photo for trust."])
			}
		})
	})

	let checkNormalRideExistence = (newRide, userId) =>
		new Promise(
			(resolve, reject) => {
				Rides.findById(newRide.id, {
					include: [{
						model: Users,
						as: 'user'
					},
					{
						model: Groups
					}
					]
				})
					.then((ride) => {
						if (ride === null) {
							dispatchErr(res, ['Invalid rideId'])
						} else {
							if (ride.time != req.body.time) {
								dispatchErrContent(res, { time: ride.time, no_photo: false }, ["Warning, ride's time has changed"])
								return
							}
							Users.findById(userId)
								.then((currentUser) => {
									if (!currentUser) {
										dispatchErr(res, ["User not found. Please contact administration regarding this issue"])
										return
									}
									// if current user does not ride with any gender check he/she is riding with chosen gender
									if (currentUser.ridesWith !== 2) {
										if (currentUser.ridesWith !== ride.user.gender && ride.user.gender != -1) {
											dispatchErr(res, [`You ride only with ${(!currentUser.ridesWith) ? "males" : "females"}`])
										}
									}

									// if driver does not ride with any gender check he/she accepts users of current users's gender
									if (ride.user.ridesWith !== 2) {
										if (ride.user.ridesWith !== currentUser.gender && currentUser.gender != -1) {
											dispatchErr(res, [`${ride.user.firstName} rides only with ${(!ride.user.ridesWith) ? "males" : "females"}`])
										}
									}

									let rideTime = new Date(ride.dataValues.date + " " + ride.dataValues.time).getTime()
									// check the ride time 
									if (rideTime < new Date().getTime()) {
										dispatchErr(res, ["Sorry, the ride is not available"])
										return
									}
									//check The ride is cancelled
									if (ride.status == "cancelled" || ride.status == "finished") {
										dispatchErrContent(res, { status: ride.status, no_photo: false }, [`The ride is ${ride.status}`])
										// dispatchErr(res, ["The ride is " + ride.status])
										return
									}
									//check available seat
									RideRiders.count({
										where: {
											rideId: newRide.id,
											status: 'accepted'
										}
									})
										.then((count) => {
											if (ride.seats > count) {
												checkFareDistance(ride, userId).then((ride) => {
													checkUserPhoto(userId).then(() => {
														newRide.fromId = ride.fromId
														newRide.toId = ride.toId
														newRide.driver = ride.driver
														newRide.groupId = ride.groupId
														newRide.status = 'pending'
														newRide.id = ride.id
														newRide.regularRideId = ride.regularRideId
														newRide.fare = ride.fare
														newRide.rideId = ride.id
														newRide.userId = userId
														newRide.distance = ride.distance
														newRide.fareAfterCommission = ride.fareAfterCommission
														resolve(newRide)
													}).catch(err => dispatchErr(res, [err]))
												}).catch((err) => dispatchErr(res, [err]))
											} else {
												dispatchErr(res, ["Sorry, no more seats in this ride"])
												// reject(["Sorry, no more seats in this ride"])
												return
											}
										})
										.catch((err) => dispatchErr(res, [err.message]))
								})
								.catch((err) => dispatchErr(res, err));
						}
					})
					.catch((err) => dispatchErr(res, [err.message]))
			}
		)

	let checkRegularRideExistence = (newRide) =>
		new Promise(
			(resolve, reject) => {
				let theUserId = newRide.userId
				RegularRide.findById(newRide.rideId, {
					include: [{
						model: Users,
						as: 'user'
					}]
				})
					.then((regularRide) => {
						if (regularRide === null) {
							reject(['Invalid rideId'])
						} else if (regularRide.status == 'deleted') {
							dispatchErr(res, ["Sorry, the ride is not available"])
							return
						} else {
							//check if already exists in Rides table according to regularRideId and date

							Rides.findOne({
								where: {
									regularRideId: regularRide.id,
									date: date,
									fromId: regularRide.fromId,
									toId: regularRide.toId
								}
							}) //TODO
								.then((ride) => {
									if (ride !== null) {
										checkNormalRideExistence(ride, newRide.userId)
											.then((newRide) => resolve(newRide))
											.catch((err) => reject([err.message]))
									} else { // if not exist leave regularride in rides, then create according to the regularRideId and date
										//there must be a way to check the date
										let newRide = {}
										newRide.userId = theUserId
										newRide.id = createUuid()
										newRide.regularRideId = regularRide.id
										newRide.fromId = regularRide.fromId
										newRide.toId = regularRide.toId
										newRide.driver = regularRide.driver
										// newRide.status = 'pending'
										newRide.seats = regularRide.seats
										newRide.date = date
										newRide.time = regularRide.time
										newRide.carId = regularRide.carId
										newRide.groupId = regularRide.groupId
										newRide.dateTime = new Date(date + " " + regularRide.time).getTime()
										newRide.promoCode = regularRide.promoCode
										Rides.create(newRide)
											.then((newRide) => {
												return checkNormalRideExistence(newRide, theUserId)
													.then((newRide) => resolve(newRide))
													.catch((err) => reject([err.message]))
											})
											.catch((err) => reject([err.message]))
									}
								})
								.catch((err) => reject([err.message]))


						}
					})
					.catch((err) => dispatchErr(res, [err.message]))
			}
		)

	// This Promises chain validates loginToken, then
	// prepares the input, validates the locations and
	// their diversity, then eventually allows the logged
	// user to join the ride
	checkLoginToken(UserLogins, loginToken)
		.then((self) => {
			// Edit (NO VERIFY)
			// checkUserVerification(self).then(() => {
				rawNewRider.userId = self
				prepareInput(rawNewRider)
					.then((newRide) => {
						if (rideType == 'normalRide') {
							checkNormalRideExistence({ id: newRide.rideId }, self)
								.then((newRide) => {
									// set the record id
									newRide.id = createUuid()
									// then create the new record
									RideRiders.create(newRide)
										.then(() => {
											newMessage = 'Request Join'
											Users.findById(self).then((userData) => {
												let data = {
													type: 'join_request',
													title: 'Ride Request',
													message: userData.firstName + " " + userData.lastName + " would like to join your ride",
													userId: newRide.driver,
													rideId: newRide.rideId,
													riderId: self,
													// data is deprecated, used only for the old notifications db table
													data: '{ "rideId":"' + newRide.rideId + '", "riderId":"' + self + '","type":"' + "join_request" + '","message":"' + userData.firstName + " " + userData.lastName + " would like to join your ride" + '" }'
												}
												UserTransactions.create({
													id: createUuid(),
													userId: newRide.userId,
													sourceType: 'rideFees',
													sourceId: newRide.id,
													amount: newRide.fare * -1,
													status: 'pending',
													creationDate: Date.now()
												})
													.then(async () => {
														sendData(UserLogins, loginToken, data, true)
														let rideFrom = await Locations.findById(newRide.fromId)
														let rideTo = await Locations.findById(newRide.toId)
														let theRide = await Rides.findById(newRide.rideId)
														let receiver = await Users.findById(theRide.driver)
														createNotification(userData.picture, `${userData.firstName} ${userData.lastName} would like to <strong>join</strong> you from ${rideFrom.englishName} to ${rideTo.englishName} on ${formatNotificationDate(theRide.dateTime)}`, 1, userData.userId, newRide.driver, newRide.rideId, { rider: self })
														let mailBody = getSupportMailTemp(`${userData.firstName} ${userData.lastName} would like to <strong>join</strong> you from ${rideFrom.englishName} to ${rideTo.englishName} on ${formatNotificationDate(theRide.dateTime)}
														<br /><a href="https://foorera.com/store-router.php">Click here to use Foorera</a>`)
														let mailOptions = {
															from: '"Foorera Support" <support@foorera.com>', // sender address
															to: receiver.email, // list of receivers
															subject: 'Foorera Ride Request', // Subject line
															html: mailBody
														};
														transporter.sendMail(mailOptions, (error, info) => {
															if (error) {
																console.error("Mail was not sent for rider", self, "in ride", newRide.id)
															}
														})
														dispatchSuc(res, null)
													})
													.catch((err) => {
														return dispatchErr(res, [err.message])
													})
											})
												.catch((err) => dispatchErr(res, [err.message]))

										})
										.catch((err) => dispatchErr(res, ['You have already joined the ride']))
								})
								.catch((err) => dispatchErr(res, err))
						} else {
							checkRegularRideExistence(newRide)
								.then((newRide) => {
									let newRideRider = {}
									newRideRider.rideId = newRide.id
									newRideRider.userId = self
									newRideRider.fromId = newRide.fromId
									newRideRider.toId = newRide.toId
									newRideRider.status = "pending"
									newRideRider.driver = newRide.driver
									newRideRider.id = createUuid()
									newRideRider.distance = newRide.distance
									newRideRider.fare = newRide.fare
									newRideRider.fareAfterCommission = newRide.fareAfterCommission

									RideRiders.create(newRideRider)
										.then(() => {
											newMessage = 'Request Join'
											Users.findById(self).then((userData) => {
												let data = {
													type: "join_request",
													title: 'Ride Request',
													message: userData.firstName + " " + userData.lastName + " would like to join your ride",
													userId: newRide.driver,
													rideId: newRide.rideId,
													riderId: self,
													// data is deprecated, used only for the old notifications db table
													data: '{ "rideId":"' + newRide.rideId + '", "riderId":"' + self + '","type":"' + "join_request" + '","message":"' + userData.firstName + " " + userData.lastName + " would like to join your ride" + '" }'
												}
												UserTransactions.create({
													id: createUuid(),
													userId: newRideRider.userId,
													sourceType: 'rideFees',
													sourceId: newRideRider.id,
													amount: newRide.fare * -1,
													status: 'pending',
													creationDate: Date.now()
												})
													.then(async () => {
														sendData(UserLogins, loginToken, data, true)
														let rideFrom = await Locations.findById(newRide.fromId)
														let rideTo = await Locations.findById(newRide.toId)
														let theRide = await Rides.findById(newRide.rideId)
														let receiver = await Users.findById(theRide.driver)
														createNotification(userData.picture, `${userData.firstName} ${userData.lastName} would like to <strong>join</strong> you from ${rideFrom.englishName} to ${rideTo.englishName} on ${formatNotificationDate(theRide.dateTime)}`, 1, userData.userId, newRide.driver, newRide.rideId, { rider: self })
														let mailBody = getSupportMailTemp(`${userData.firstName} ${userData.lastName} would like to <strong>join</strong> you from ${rideFrom.englishName} to ${rideTo.englishName} on ${formatNotificationDate(theRide.dateTime)}
														<br /><a href="https://foorera.com/store-router.php">Click here to use Foorera</a>
														`)
														let mailOptions = {
															from: '"Foorera Support" <support@foorera.com>', // sender address
															to: receiver.email, // list of receivers
															subject: 'Foorera Ride Request', // Subject line
															html: mailBody
														};
														transporter.sendMail(mailOptions, (error, info) => {
															if (error) {
																console.error("Mail was not sent for rider", self, "in ride", newRide.id)
															}
														})
														dispatchSuc(res, null)
													})
													.catch((err) => dispatchErr(res, [err.message]))
											})
												.catch((err) => dispatchErr(res, [err.message]))


										})
										.catch((err) => dispatchErr(res, ['You already joined the ride']))
								}).catch((err) => dispatchErr(res, err))
						}
					})
					.catch((err) => dispatchErr(res, err))
			// }).catch((err) => dispatchErrContent(res, { "verified": false }, err))
		})
		.catch((err) => dispatchErr(res, err))
}

// /rides/{:rideId}/riders (PUT) && /rides/{:rideId}/driver (PUT) routes
let editRideStatus = (req, res, next) => {
	let loginToken = req.headers.logintoken
	let action = req.body.action === undefined ?
		dispatchErr(res, 'No action passed') :
		req.body.action
	let rideId = req.params.rideId
	var userId = req.body.userId === undefined ?
		undefined :
		req.body.userId
	let agent = req.params.agent

	if (agent == 'driver' && userId === undefined) {
		dispatchErr(res, 'No userId')
		return
	}
	//check all the rider leave if true update the ride status to finished
	let updateFinishedRideIfRequired = () =>
		new Promise(
			(resolve, reject) => {
				RideRiders.count({
					where: {
						rideId: rideId,
						$or: [{
							status: 'accepted'
						}, {
							status: 'started'
						}]
					}
				})
					.then((riders) => {
						if (riders == 0) {
							Rides.update({
								status: "finished"
							}, {
									where: {
										id: rideId
									}
								})
								.then(() => resolve())
								.catch((err) => reject([err]))
						}

						resolve()
					})
					.catch((err) => reject([err]))

			}
		)

	let checkAvailableSeats = (self) =>
		new Promise(
			(resolve, reject) => {
				Rides.findById(rideId, {
					include: [{
						model: Users,
						as: 'user'
					}]
				})
					.then((ride) => {
						if (ride === null) {
							//reject(['Invalid rideId'])
							dispatchErr(res, ['Invalid rideId'])
							return
						} else {
							// check the ride time 
							//let rideTime = new Date(ride.date + " " + ride.time).getTime()
							if ((new Date(ride.date + " " + ride.time).getTime()) < new Date().getTime) {
								dispatchErr(err, ["The ride is time out"])
								return
							}
							//check The ride is cancelled
							if (ride.status == "cancelled") {
								dispatchErrContent(res, { status: ride.status, no_photo: false }, ["The ride is cancelled"])
								// dispatchErr(res, ["The  ride is cancelled"])
								return

							}
							if (ride.status == "deleted") {
								dispatchErrContent(res, { status: ride.status, no_photo: false }, ["The ride is deleted"])
								// dispatchErr(res, ["The ride is deleted"])
								return
							}
							if (action == "leave" && ride.status == "pending") {
								dispatchErr(res, ["Rider can’t leave a ride after starting it"])
								return
							}

							if (action == "accept") {
								//check available seat
								RideRiders.count({
									where: {
										rideId: rideId,
										$or: [{
											status: 'accepted'
										}, {
											status: 'started'
										}]
									}
								})
									.then((count) => {
										if (ride.seats > count) {
											checkRideRiderExistenceAndUpdate(self, action, ride)
												.then((fare) => dispatchSuc(res, {
													"rideFare": fare
												}))
												.then(() => {
													RideRiders.find({
														where: {
															rideId: rideId,
															userId: self
														}
													})
														.then((rideRider) => {
															let before30 = momentTimezone(ride.dateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm');
															let key0 = before30 + "-" + rideRider.id;
															let key0Driver = before30 + "-" + ride.driver;
															let data = {
																rideId: ride.id,
																riderId: rideRider.userId,
																rideDate: ride.date,
																rideTime: ride.time
															}
															redisClient.set(key0, JSON.stringify({ userId: self, messageType: 0, data: data }))
															redisClient.set(key0Driver, JSON.stringify({ userId: ride.driver, messageType: 0, data: data }))

															let key1 = momentTimezone(ride.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
															let key1Driver = momentTimezone(ride.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + ride.driver;
															redisClient.set(key1, JSON.stringify({ userId: self, messageType: 1, data: data }))
															redisClient.set(key1Driver, JSON.stringify({ userId: ride.driver, messageType: 1, data: data }))

															let key2 = momentTimezone(ride.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
															let key2Driver = momentTimezone(ride.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm') + "-" + ride.driver;
															redisClient.set(key2, JSON.stringify({ userId: self, messageType: 2, data: data }))
															redisClient.set(key2Driver, JSON.stringify({ userId: ride.driver, messageType: 2, data: data }))

															let key3 = momentTimezone(ride.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
															let key3Driver = momentTimezone(ride.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + ride.driver;
															redisClient.set(key3, JSON.stringify({ userId: self, messageType: 3, data: data }))
															redisClient.set(key3Driver, JSON.stringify({ userId: ride.driver, messageType: 3, data: data }))
														})
														.catch((err) => {
															console.error(err);
														})
												})
												.catch((err) => dispatchErr(res, err))
										} else {
											dispatchErr(res, ["Sorry, no more seats in this ride"])
											// reject(["Sorry, no more seats in this ride"])
											return
										}
									})
									.catch((err) => dispatchErr(res, [err]))
							} else {
								checkRideRiderExistenceAndUpdate(self, action, ride)
									.then((fare) => {
										resolve({
											"rideFare": fare
										})
									})
									.catch((err) => reject(err))
							}


						}
					})
					.catch((err) => reject(err))
			}
		)

	let rideRiderTransaction = (drivarId, riderId, rideRiderRecordId, fare, fareAfterCommission, rideId) =>
		new Promise(
			(resolve, reject) => {
				//dbTransaction
				sequelize.transaction(function (t) {

					// chain all your queries here. make sure you return them.
					//rider transaction
					return UserTransactions.update({
						status: 'successful'
					}, {
							where: {
								sourceId: rideRiderRecordId
							},
							transaction: t
						}).then(function (userTransactions) {
							// console.log('user transaction', userTransactions)

							//driver transaction
							return UserTransactions.create({
								id: createUuid(),
								userId: drivarId,
								sourceType: 'rideRevenue',
								sourceId: rideRiderRecordId,
								amount: fareAfterCommission,
								status: 'successful',
								creationDate: Date.now()
							}, {
									transaction: t
								});
						});

				}).then(function (result) {
					// resolve(result)
				}).catch(function (err) {
					console.log(err)
				});
			}
		)


	// Check that the rideRider exists and depending whether the loggedUser
	// is the driver or the rider allows them to modify the status
	let checkRideRiderExistenceAndUpdate = (loggedUserId, action, rideInfo) =>
		new Promise(
			(resolve, reject) => {
				let condition = userId === undefined ? {
					rideId: rideId
				} : {
						rideId: rideId,
						userId: userId
					}
				RideRiders.findOne({
					where: condition,
					attributes: ['id', 'rideId', 'userId', 'status'],
					include: [{
						model: Rides,
					}],
				})
					.then((rideRider) => {
						if (rideRider === null) {
							reject(['Sorry, you can’t leave the ride'])
							return
						}
						let newStatus = {}
						if (agent === 'riders') {
							if (rideRider.userId !== loggedUserId) {

								reject(['Permission denied'])
								return
							}
							switch (action) {
								case 'leave':
									if (rideRider.status != 'accepted' && rideRider.status != 'pending') {
										reject(['Sorry, you can’t leave the ride'])
										return
									}
									newStatus.status = 'left'

									Users.findById(rideRider.userId).then(async (userData) => {
										let data = {
											type: "rider_left",
											title: 'Rider Left',
											message: "Sorry, " + userData.firstName + " " + userData.lastName + " has left the ride",
											userId: rideRider.Ride.driver,
											rideId: rideId,
											riderId: rideRider.userId,
											rideDate: rideInfo.date,
											rideTime: rideInfo.time,
											// data is deprecated, used only for the old notifications db table
											data: '{ "rideId":"' + rideId + '","riderId":"' + rideRider.userId + '","rideDate":"' + rideInfo.date +
												'","rideTime":"' + rideInfo.time + '","type":"' + "rider_left" + '","message":"' + "Sorry, " + userData.firstName + " " + userData.lastName + " has left the ride" + '" }'
										}

										// remove ride rider redis notification entry
										let riderKey0 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
										let riderKey1 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
										let riderKey2 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
										let riderKey3 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
										redisClient.del(riderKey0, (err, result) => console.log({ err, result }))
										redisClient.del(riderKey1, (err, result) => console.log({ err, result }))
										redisClient.del(riderKey2, (err, result) => console.log({ err, result }))
										redisClient.del(riderKey3, (err, result) => console.log({ err, result }))

										// remove the driver redis entry if required
										RideRiders.count({
											where: {
												rideId: rideInfo.id,
												$or: [{
													status: 'pending'
												}, {
													status: 'accepted'
												}]
											}
										}).then((count) => {
											if (count == 0) {
												// remove all redis notifications for riders and driver
												let before30 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm');
												let before10 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm');
												let rideTime = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm');
												let after15 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm');
												redisClient.del(before30 + "-" + rideInfo.driver, (err, res) => console.log({ err, res }));
												redisClient.del(before10 + "-" + rideInfo.driver, (err, res) => console.log({ err, res }));
												redisClient.del(rideTime + "-" + rideInfo.driver, (err, res) => console.log({ err, res }));
												redisClient.del(after15 + "-" + rideInfo.driver, (err, res) => console.log({ err, res }));
											}
										})

										// send notification
										sendData(UserLogins, loginToken, data, true)
										let rideFrom = await Locations.findById(rideInfo.fromId)
										let rideTo = await Locations.findById(rideInfo.toId)
										createNotification(userData.picture, `${userData.firstName} ${userData.lastName} has <strong>left</strong> your ride from ${rideFrom.englishName} to ${rideTo.englishName} on ${formatNotificationDate(rideInfo.date)}`, 11, userData.userId, rideRider.Ride.driver, rideId, null)
										let transactionToCancel = await UserTransactions.findOne({
											where: {
												sourceId: rideRider.id,
												userId: rideRider.userId
											}
										})
										if (!transactionToCancel) {
											throw Error("Transaction not found");
										}
										await transactionToCancel.update({
											status: "cancelled"
										})
									})
										.catch((err) => dispatchErr(res, [err]))
									break
								case 'start':

									newStatus.status = 'started'
									newMessage = 'Ride ' + newStatus.status

									Users.findById(rideRider.userId).then((userData) => {
										let data = {
											type: "ride_started",
											title: 'Ride Started',
											message: userData.firstName + " " + userData.lastName + " has started the ride, have a nice time",
											userId: rideRider.Ride.driver,
											rideId: rideId,
											riderId: rideRider.userId,
											rideDate: rideInfo.date,
											rideTime: rideInfo.time,
											// data is deprecated, used only for the old notifications db table
											data: '{ "rideId":"' + rideId + '","riderId":"' + rideRider.userId +
												'","rideDate":"' + rideInfo.date + '","rideTime":"' + rideInfo.time +
												'","type":"' + "ride_started" + '","message":"' + userData.firstName + " " + userData.lastName + " has started the ride, have a nice time" + '" }'
										}
										sendData(UserLogins, loginToken, data, true)
										createNotification(userData.picture, `${userData.firstName} ${userData.lastName} has <strong>started</strong> the ride`,
											7, userData.userId, rideRider.Ride.driver, rideId, null)
										//dispatchSuc(res, [])
									})
										.catch((err) => dispatchErr(res, [err]))
									break
								case 'end':
									if (rideRider.status != "started") {
										dispatchErr(res, ["You can't finish this ride"])
										return
									}
									newStatus.status = 'finished'
									newMessage = 'Ride ' + newStatus.status

									Users.findById(rideRider.userId).then((userData) => {
										let data = {
											type: "ride_ended",
											title: 'Ride Finished',
											message: userData.firstName + " " + userData.lastName + " has ended the ride",
											userId: rideRider.Ride.driver,
											rideId: rideId,
											riderId: rideRider.userId,
											rideDate: rideInfo.date,
											rideTime: rideInfo.time,
											// data is deprecated, used only for the old notifications db table
											data: '{ "rideId":"' + rideId + '","riderId":"' + rideRider.userId + '","rideDate":"' + rideInfo.date + '","rideTime":"' + rideInfo.time +
												'","type":"' + "ride_ended" + '","message":"' + userData.firstName + " " + userData.lastName + " has ended the ride" + '" }'
										}

										// send notification
										sendData(UserLogins, loginToken, data, true)
										createNotification(userData.picture, `${userData.firstName} ${userData.lastName} has <strong>ended</strong> the ride`,
											8, userData.userId, rideRider.Ride.driver, rideId, null)

										UserTransactions.findOne({
											where: {
												userId: userId,
												sourceId: rideRider.id
											}
										})
											.then((transaction) => {
												if (!transaction) {
													return console.error("No transaction found for user " + userId + " and ride rider " + rideRider.id);
												}
												transaction.status = "successful"
												return transaction.save()
													.then(() => {
														console.log("Transaction updated successfully")
													})
													.catch((err) => {
														console.error(err);
													})
											})
											.catch((err) => {
												console.error(err);
											})

										// get the ride fare and distance
										Rides.findById(rideId, {
											include: [{
												model: Groups
											}]
										})
											.then((rideObj) => {
												// update the rider record
												newStatus.distance = rideObj.distance
												newStatus.fare = rideObj.fare
												newStatus.fareAfterCommission = rideObj.fareAfterCommission
												rideRider.update(newStatus)

												// update ride status if required
												updateFinishedRideIfRequired()

												// prepare the transactions fare according to if the groups has cash payment
												if (rideObj.Group && rideObj.Group.cashPayment) {
													transactionFare = 0
													transactionFareAfterCommission = 0
												} else {
													transactionFare = rideObj.fare
													transactionFareAfterCommission = rideObj.fareAfterCommission
												}
												// add rider and drivar transactions
												rideRiderTransaction(rideRider.Ride.driver, rideRider.userId, rideRider.id, transactionFare, transactionFareAfterCommission, rideId)

											}).catch((err) => reject([err]))

									}).catch((err) => dispatchErr(res, [err]))
									break
								default:
									reject(['Invalid action'])
							}
						} else if (agent === 'driver') {
							if (rideRider.Ride.driver !== loggedUserId) {
								reject(['Permission denied'])
								return
							}
							switch (action) {
								case 'accept':
									newStatus.status = 'accepted'
									newMessage = 'Ride ' + newStatus.status

									console.log("///////////////////////\\\\\\\\\\\\\\\\\\\\\\\\\\\ ");

									Users.findById(rideRider.Ride.driver).then((userData) => {
										var data = {
											type: "join_request_accepted",
											title: 'Ride Request Accepted',
											message: userData.firstName + " " + userData.lastName + " has accepted your join request",
											userId: rideRider.userId,
											rideId: rideId,
											riderId: rideRider.userId,
											rideDate: rideInfo.date,
											rideTime: rideInfo.time,
											// data is deprecated, used only for the old notifications db table
											data: '{ "rideId":"' + rideId + '","riderId":"' + rideRider.userId + '","rideDate":"' + rideInfo.date + '","rideTime":"' + rideInfo.time +
												'","type":"' + "join_request_accepted" + '","message":"' + userData.firstName + " " + userData.lastName + " has accepted your join request" + '" }'
										}
										console.log("===========----------------------------============")
										sendData(UserLogins, loginToken, data, true)
										// let theRider = await Users.findById(rideRider.userId)
										Users.findById(userData.userId)
											.then(async (theDriver) => {
												let rideFrom = await Locations.findById(rideRider.Ride.fromId)
												let rideTo = await Locations.findById(rideRider.Ride.toId)
												createNotification(theDriver.picture, `${theDriver.firstName} ${theDriver.lastName} has <strong>accepted</strong> your request to join from ${rideFrom.englishName} to ${rideTo.englishName} on ${formatNotificationDate(rideRider.Ride.dateTime)}`,
													5, theDriver.userId, rideRider.userId, rideId, null);
												console.log("////////////---------------------------////////////")
												let before30 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm');
												let key0 = before30 + "-" + rideRider.id;
												let key0Driver = before30 + "-" + rideInfo.driver;
												let data = {
													rideId: rideInfo.id,
													riderId: rideRider.userId,
													rideDate: rideInfo.date,
													rideTime: rideInfo.time
												}
												
												redisClient.set(key0, JSON.stringify({ userId: rideRider.userId, messageType: 0, data: data }))
												redisClient.set(key0Driver, JSON.stringify({ userId: rideInfo.driver, messageType: 0, data: data }))
												let key1 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
												let key1Driver = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + rideInfo.driver;
												redisClient.set(key1, JSON.stringify({ userId: rideRider.userId, messageType: 1, data: data }))
												redisClient.set(key1Driver, JSON.stringify({ userId: rideInfo.driver, messageType: 1, data: data }))

												let key2 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
												let key2Driver = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm') + "-" + rideInfo.driver;
												redisClient.set(key2, JSON.stringify({ userId: rideRider.userId, messageType: 2, data: data }))
												redisClient.set(key2Driver, JSON.stringify({ userId: rideInfo.driver, messageType: 2, data: data }))

												let key3 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + rideRider.id;
												let key3Driver = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm') + "-" + rideInfo.driver;
												redisClient.set(key3, JSON.stringify({ userId: rideRider.userId, messageType: 3, data: data }))
												redisClient.set(key3Driver, JSON.stringify({ userId: rideInfo.driver, messageType: 3, data: data }))
												console.log("+++++++++++++++---------------------------+++++++++++++++")
											})
										//dispatchSuc(res, [])
									})
										.catch((err) => dispatchErr(res, [err]))
									break
								case 'decline':
									newStatus.status = 'declined'
									newMessage = 'Ride ' + newStatus.status

									Users.findById(rideRider.Ride.driver).then((userData) => {
										var data = {
											type: "join_request_declined",
											title: 'Ride Request Declined',
											message: "Sorry, " + userData.firstName + " " + userData.lastName + " has declined your join request",
											userId: rideRider.userId,
											rideId: rideId,
											riderId: rideRider.userId,
											rideDate: rideInfo.date,
											rideTime: rideInfo.time,
											// data is deprecated, used only for the old notifications db table
											data: '{ "rideId":"' + rideId + '","riderId":"' + rideRider.userId + '","rideDate":"' + rideInfo.date + '","rideTime":"' + rideInfo.time +
												'","type":"' + "join_request_declined" + '","message":"' + "Sorry, " + userData.firstName + " " + userData.lastName + " has declined your join request" + '" }'
										}
										sendData(UserLogins, loginToken, data, true)

										// remove the driver redis entry if required
										RideRiders.count({
											where: {
												rideId: rideInfo.id,
												$or: [{
													status: 'pending'
												}, {
													status: 'accepted'
												}]
											}
										}).then((count) => {
											if (count == 0) {
												// remove all redis notifications for riders and driver
												let before30 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm');
												let before10 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm');
												let rideTime = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm');
												let after15 = momentTimezone(rideInfo.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm');
												redisClient.del(before30 + "-" + rideInfo.driver, (err, res) => console.log({ err, res }));
												redisClient.del(before10 + "-" + rideInfo.driver, (err, res) => console.log({ err, res }));
												redisClient.del(rideTime + "-" + rideInfo.driver, (err, res) => console.log({ err, res }));
												redisClient.del(after15 + "-" + rideInfo.driver, (err, res) => console.log({ err, res }));
											}
										})

										Users.findById(userData.userId)
											.then((theDriver) => {
												createNotification(userData.picture, `${theDriver.firstName} ${theDriver.lastName} has <strong>declined</strong> your request to join ${theDriver.gender == 1 ? "her" : "his"} ride`,
													6, theDriver.userId, rideRider.userId, rideId, null);
												UserTransactions.findOne({
													where: {
														sourceId: rideRider.id,
														userId: rideRider.userId
													}
												})
													.then((transactionToCancel) => {
														if (!transactionToCancel) {
															throw Error("No transaction found")
														}
														return transactionToCancel.update({
															status: "cancelled"
														})
													})
											})
											.catch((err) => {
												dispatchErr(res, [err])
											})
										//dispatchSuc(res, [])
									})
										.catch((err) => dispatchErr(res, [err]))
									break
								default:
									reject(['Invalid action'])
							}
						} else {
							reject(['Permission denied'])
							return
						}
						if (req.body.time) {
							newStatus.time = req.body.time
							newStatus.dateTime = new Date(rideInfo.date + " " + req.body.time).getTime()
						}

						rideRider.update(newStatus)
							.then(() => dispatchSuc(res, null))
							.catch((err) => reject([err]))


					})
					.catch((err) => dispatchErr(res, [err]))
			}
		)

	// This Promises chain validates loginToken, retrieves
	// the rideRider record and then depending on the action
	// passed proceeds to update its status as always only
	// if the logged user is the same that appears on the record
	checkLoginToken(UserLogins, loginToken)
		.then((self) => {
			if (agent === 'riders') {
				userId = self
			}
			// Edit (NO VERIFY)
			//checkUserVerification(self).then(() => {
				checkAvailableSeats(self)
					.then(() => dispatchSuc(res, self))
					.catch((err) => dispatchErr(res, err))
			// }).catch((err) => { dispatchErrContent(res, { "verified": false }, err) })
		}

		)
		.catch((err) => dispatchErr(res, err))


}

// /rides/:rideId/rate (PUT) route
let rateRide = (req, res, next) => {
	let loginToken = req.headers.logintoken
	let rating = req.body.rating === undefined ?
		dispatchErr(res, 'No rating passed') :
		req.body.rating
	let rideId = req.params.rideId
	let userId = req.body.userId
	let comment = req.body.comment
	// Find a RideRider and then, depending on whether the logged
	//  user is the driver or a rider allows him to vote accordingly
	// (if the ride belongs to him)
	let findAndRate = (self) =>
		new Promise(
			(resolve, reject) => {
				RideRiders.findOne({
					where: {
						rideId: rideId,
						userId: userId === undefined ? self : userId
					},
					attributes: ['rideId', 'userId'],
					include: [{
						model: Rides,
						as: 'ride'
					}]
				})
					.then((rideRider) => {
						let newRating = {}
						if (rideRider === null) {
							reject(['Invalid rideId'])
							return
						}
						if (rideRider.userId === self) {
							newRating.driverRating = rating
							if (comment !== undefined)
								newRating.riderComment = comment
						} else if (rideRider.ride.driver === self) {
							newRating.riderRating = rating
							if (comment !== undefined)
								newRating.driverComment = comment
						} else {
							reject(['Permission denied'])
							return
						}
						rideRider.update(newRating)
							.then(() => resolve())
							.catch((err) => reject([err.message]))
					})
					.catch((err) => reject([err.message]))
			}
		)

	// This Promises chain validates loginToken, retrieves
	// the rideRider record and then decides whether is
	// the driver or the rider the one who's voting based on
	// the loginToken. Then records the rating
	checkLoginToken(UserLogins, loginToken)
		.then((self) =>
			findAndRate(self)
				.then(() => dispatchSuc(res, []))
				.catch((err) => dispatchErr(res, err))
		)
		.catch((err) => dispatchErr(res, err))
}

// /ride/{:rideId} route
let editRide = (req, res, next) => {
	let loginToken = req.headers.logintoken
	let rideId = req.params.rideId
	let rideType = req.query.rideType

	let rawNewRider = {}

	rawNewRider.time = req.body.time === undefined ?
		dispatchErr(res, 'No time sent') :
		req.body.time
	var time = req.body.time
	var timeFormate = tConvert(time.substr(0, 5));
	// This Promises chain validates loginToken, retrieves
	// the rideRider record and then if the logged user is
	// the owner lets her update the record
	checkLoginToken(UserLogins, loginToken)
		.then((self) => {

			if (rideType == "regularRide") {
				let date = req.query.date === undefined ?
					dispatchErr(res, 'No date passed') :
					validateDate(req.query.date) === true ?
						req.query.date : dispatchErr(res, ["Date format is not valid "])
				//let leaveOrReturn = req.query.leaveOrReturn === undefined
				//    ? dispatchErr(res, 'No leaveOrReturn passed')
				//    : req.query.leaveOrReturn
				//do the new logic 
				RegularRide.findOne({
					where: {
						id: rideId
					}
				}).then((regularRide) => {
					if (regularRide == null) {
						dispatchErr(res, ["Sorry, the ride is not available"])
						return
					} else {
						// leave
						if (regularRide.status == 'deleted' || regularRide.status == 'cancelled' || regularRide.status == 'finished') {
							dispatchErr(res, ["This ride is " + regularRide.status])
							return
						}
						if (regularRide.driver !== self) {
							dispatchErr(res, ['Permission denied'])
							return
						}

						Rides.findOne({
							where: {
								regularRideId: rideId,
								date: date,
								fromId: regularRide.fromId,
								toId: regularRide.toId,

							}
						})
							.then((ride) => {
								// check user rides on date and time
								checkUserRidesAtDateAndTime(self, date, time, false)
									.then(() => {
										const theOldRideDateTime = ride.dateTime
										if (ride !== null) {
											//update the exist Ride 
											if (ride.status == 'deleted' || ride.status == 'cancelled' || ride.status == 'finished') {
												dispatchErr(res, ["This ride is  " + ride.status])
												return
											}
											if (ride.driver !== self) {
												dispatchErr(res, ['Permission denied'])
												return
											}
											let rawEditRide = {
												time: req.body.time,
												dateTime: new Date(date + " " + req.body.time).getTime()
											}
											let where = {
												where: {
													id: ride.id
												}
											}
											Rides.update(rawEditRide, where)
												.then(() => {

													RideRiders.findAll({
														where: {
															rideId: ride.id,
															$or: [{
																status: 'accepted'
															}, {
																status: 'pending'
															}]
														}
													}).then((users) => {
														if (users === null) {
															dispatchErr(res, [" Invalid User "])
															return
														}

														// DONE: update redis records

														let oldBefore30 = momentTimezone(theOldRideDateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm');
														let oldBefore10 = momentTimezone(theOldRideDateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm');
														let oldRideTime = momentTimezone(theOldRideDateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm');
														let oldAfter15 = momentTimezone(theOldRideDateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm');

														let newBefore30 = momentTimezone(rawEditRide.dateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm');
														let newBefore10 = momentTimezone(rawEditRide.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm');
														let newRideTime = momentTimezone(rawEditRide.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm');
														let newAfter15 = momentTimezone(rawEditRide.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm');

														redisClient.rename(oldBefore30 + "-" + ride.driver, newBefore30 + "-" + ride.driver, (err, res) => console.log({ err, res }))
														redisClient.rename(oldBefore10 + "-" + ride.driver, newBefore10 + "-" + ride.driver, (err, res) => console.log({ err, res }))
														redisClient.rename(oldRideTime + "-" + ride.driver, newRideTime + "-" + ride.driver, (err, res) => console.log({ err, res }))
														redisClient.rename(oldAfter15 + "-" + ride.driver, newAfter15 + "-" + ride.driver, (err, res) => console.log({ err, res }))

														users.forEach((rider) => {
															redisClient.rename(oldBefore30 + "-" + rider.id, newBefore30 + "-" + rider.id, (err, res) => console.log({ err, res }));
															redisClient.rename(oldBefore10 + "-" + rider.id, newBefore10 + "-" + rider.id, (err, res) => console.log({ err, res }));
															redisClient.rename(oldRideTime + "-" + rider.id, newRideTime + "-" + rider.id, (err, res) => console.log({ err, res }));
															redisClient.rename(oldAfter15 + "-" + rider.id, newAfter15 + "-" + rider.id, (err, res) => console.log({ err, res }));
														})

														Users.findById(self).then(async (userData) => {
															for (var i = 0; i < users.length; i++) {
																let data = {
																	type: "ride_updated",
																	title: 'Ride Updated',
																	message: userData.firstName + " " + userData.lastName + " has updated the ride time to be on " + timeFormate,
																	userId: users[i].userId,
																	rideId: ride.id,
																	riderId: users[i].userId,
																	rideDate: ride.date,
																	rideTime: ride.time,
																	// data is deprecated, used only for the old notifications db table
																	data: '{ "rideId":"' + ride.id + '","riderId":"' + users[i].userId + '","rideDate":"' + ride.date + '","rideTime":"' + ride.time +
																		'","type":"' + "ride_updated" + '","message":"' + userData.firstName + " " + userData.lastName + " has updated the ride time to be on " + timeFormate + '" }'
																}
																sendData(UserLogins, loginToken, data, true)
																let rideFrom = await Locations.findById(ride.fromId)
																let rideTo = await Locations.findById(ride.toId)
																createNotification(userData.picture, `${userData.firstName} ${userData.lastName} has <strong>updated</strong> the ride from ${rideFrom.englishName} to ${rideTo.englishName} on ${formatNotificationDate(ride.dateTime)}`, 9, userData.userId, users[i].userId, ride.id, null)
															}

															dispatchSuc(res, [])
														})
															.catch((err) => dispatchErr(res, [err]))
													}).catch((err) => dispatchErr(res, [err]))

												})
												.catch((err) => dispatchErr(res, [err]))
										} else { // if not exist leave regularride in rides, then create according to the regularRideId and date
											//there must be a way to check the date
											let newRide = {}
											newRide.id = createUuid()
											newRide.regularRideId = regularRide.id
											newRide.fromId = regularRide.fromId
											newRide.toId = regularRide.toId
											newRide.driver = regularRide.driver
											// newRide.status = 'pending'
											newRide.seats = regularRide.seats
											newRide.date = date
											newRide.time = req.body.time
											newRide.carId = regularRide.carId
											newRide.groupId = regularRide.groupId
											newRide.dateTime = new Date(date + " " + req.body.time).getTime()
											newRide.promoCode = regularRide.promoCode
											Rides.create(newRide)
												.then((newRide) => {

													dispatchSuc(res, [])
													return
												})
												.catch((err) => reject([err.message]))
										}
									})
									.catch((err) => dispatchErr(res, err))
							})
							.catch((err) => reject([err.message]))

					}
				}).catch((err) => dispatchErr(res, [err.message]))
			} else {
				prepareInput(rawNewRider)
					.then((editRide) => {
						Rides.findOne({
							where: {
								id: rideId
							}
						})
							.then((ride) => {
								const theOldRideDateTime = ride.dateTime
								if (ride === null)
									dispatchErr(res, 'Invalid rideId')
								else {
									if (ride.status == 'deleted' || ride.status == 'cancelled' || ride.status == 'finished') {
										dispatchErr(res, ["This ride is " + ride.status])
										return
									}
									if (ride.driver !== self) {
										dispatchErr(res, ['Permission denied'])
										return
									}

									// check user ride at date and time
									checkUserRidesAtDateAndTime(self, ride.date, rawNewRider.time, false)
										.then(() => {
											rawNewRider.dateTime = new Date(ride.date + " " + rawNewRider.time).getTime()
											ride.update(rawNewRider)
												.then((ride) => {

													RideRiders.findAll({
														where: {
															rideId: rideId,
															$or: [{
																status: 'accepted'
															}, {
																status: 'pending'
															}]
														},
														attributes: ['rideId', 'userId', 'id'],
													})
														.then((rideRiders) => {
															if (rideRiders === null) {
																dispatchSuc(res, [])
																return
															}

															// DONE: update redis records

															let oldBefore30 = momentTimezone(theOldRideDateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm');
															let oldBefore10 = momentTimezone(theOldRideDateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm');
															let oldRideTime = momentTimezone(theOldRideDateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm');
															let oldAfter15 = momentTimezone(theOldRideDateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm');

															let newBefore30 = momentTimezone(rawNewRider.dateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm');
															let newBefore10 = momentTimezone(rawNewRider.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm');
															let newRideTime = momentTimezone(rawNewRider.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm');
															let newAfter15 = momentTimezone(rawNewRider.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm');

															redisClient.rename(oldBefore30 + "-" + ride.driver, newBefore30 + "-" + ride.driver, (err, res) => console.log({ err, res }))
															redisClient.rename(oldBefore10 + "-" + ride.driver, newBefore10 + "-" + ride.driver, (err, res) => console.log({ err, res }))
															redisClient.rename(oldRideTime + "-" + ride.driver, newRideTime + "-" + ride.driver, (err, res) => console.log({ err, res }))
															redisClient.rename(oldAfter15 + "-" + ride.driver, oldAfter15 + "-" + ride.driver, (err, res) => console.log({ err, res }))

															rideRiders.forEach((rider) => {
																redisClient.rename(oldBefore30 + "-" + rider.id, newBefore30 + "-" + rider.id, (err, res) => console.log({ err, res }));
																redisClient.rename(oldBefore10 + "-" + rider.id, newBefore10 + "-" + rider.id, (err, res) => console.log({ err, res }));
																redisClient.rename(oldRideTime + "-" + rider.id, oldRideTime + "-" + rider.id, (err, res) => console.log({ err, res }));
																redisClient.rename(oldAfter15 + "-" + rider.id, oldAfter15 + "-" + rider.id, (err, res) => console.log({ err, res }));
															})

															Users.findById(self).then((userData) => {

																for (i = 0; i < rideRiders.length; i++) {
																	let newMessage = 'Ride changed'
																	rideRiders[i].update(rawNewRider)
																	let data = {
																		type: "ride_updated",
																		title: 'Ride Updated',
																		message: userData.firstName + " " + userData.lastName + " has updated the ride time to be on " + timeFormate,
																		userId: rideRiders[i].userId,
																		rideId: rideRiders[i].rideId,
																		riderId: rideRiders[i].userId,
																		rideDate: ride.date,
																		rideTime: ride.time,
																		// data is deprecatd, used only for old notifications db table
																		data: '{ "rideId":"' + rideRiders[i].rideId + '","riderId":"' + rideRiders[i].userId + '","rideDate":"' + ride.date + '","rideTime":"' + ride.time +
																			'","type":"' + "ride_updated" + '","message":"' + userData.firstName + " " + userData.lastName + " has updated the ride time to be on " + timeFormate + '" }'
																	}
																	sendData(UserLogins, loginToken, data, true)
																}

																dispatchSuc(res, [])

															})
																.catch((err) => dispatchErr(res, err))
														})
														.catch((err) => dispatchErr(res, err))
												})
												.catch((err) => dispatchErr(res, err))
										})
										.catch((err) => dispatchErr(res, err))
								}
							})
							.catch((err) => dispatchErr(res, err))

					})
					.catch((err) => dispatchErr(res, err))
			}
		})
		.catch((err) => dispatchErr(res, err))
}


// /ride/{:rideId} route
let cancelRide = (req, res, next) => {
	let loginToken = req.headers.logintoken
	let rideId = req.params.rideId
	let rideType = req.query.rideType
	let newRide = {
		status: 'cancelled'
	}

	let cancelRidePendingTransactions = (rideId) =>
		new Promise(
			(resolve, reject) => {
				RideRiders.findAll({
					where: {
						rideId,
						$or: [
							{
								status: 'pending'
							},
							{
								status: 'accepted'
							},
							{
								status: 'started'
							}
						]
					}
				})
					.then((rideRiders) => {
						// check ride riders
						if (!rideRiders || rideRiders.length == 0) {
							// it's undefined or empty arr
							resolve()
						} else {
							// prepare the ids
							let sourceIds = []
							rideRiders.forEach(rideRider => {
								sourceIds.push({ sourceId: rideRider.id })
							})

							// update user transactions
							UserTransactions.update(
								{ status: 'cancelled' },
								{ where: { status: 'pending', $or: sourceIds } }
							)
								.then(() => resolve())
								.catch((err) => reject([err.message]))
						}
					})
					.catch((err) => reject([err.message]))
			}
		)

	// This Promises chain validates loginToken and then
	// proceeds to validate the ride, its property and
	// then deletes it
	checkLoginToken(UserLogins, loginToken)
		.then((self) => {


			if (rideType == "regularRide") {
				let date = req.query.date === undefined ?
					dispatchErr(res, 'No date passed') :
					validateDate(req.query.date) === true ?
						req.query.date : dispatchErr(res, ["Date format is not valid "])
				//let leaveOrReturn = req.query.leaveOrReturn === undefined
				//    ? dispatchErr(res, 'No leaveOrReturn passed')
				//    : req.query.leaveOrReturn
				//do the new logic 
				RegularRide.findOne({
					where: {
						id: rideId,
					},
				}).then((regularRide) => {
					if (regularRide == null) {
						dispatchErr(res, ["Sorry, the ride is not available"])

					} else {
						if (regularRide.status == 'deleted' || regularRide.status == 'cancelled' || regularRide.status == 'finished') {
							dispatchErr(res, ["This Ride is " + regularRide.status])
							return
						}
						if (regularRide.driver !== self) {
							dispatchErr(res, ['Permission denied'])
							return
						}

						Rides.findOne({
							where: {
								regularRideId: rideId,
								date: date,
								fromId: regularRide.fromId,
								toId: regularRide.toId,
							}
						})
							.then((ride) => {
								if (ride !== null) {
									if (ride.status == 'deleted' || ride.status == 'cancelled' || ride.status == 'finished') {
										dispatchErr(res, ["this ride is " + ride.status])
										return
									}
									if (ride.driver !== self) {
										dispatchErr(res, ['Permission denied'])
										return
									}
									//update the exist Ride 
									// this Function not completed 
									let newRide = {
										status: 'cancelled'
									}
									let where = {
										where: {
											id: ride.id
										}
									}
									Rides.update(newRide, where)
										.then(() => {
											RideRiders.findAll({
												where: {
													rideId: ride.id,
													$or: [{
														status: 'accepted'
													}, {
														status: 'pending'
													}]
												}
											}).then((users) => {
												if (users === null) {
													dispatchErr(res, [" Invalid User "])
													return
												}

												Users.findById(self).then(async (userData) => {
													for (var i = 0; i < users.length; i++) {
														let data = {
															type: "ride_cancelled",
															title: 'Ride Cancelled',
															message: "Sorry, " + userData.firstName + " " + userData.lastName + " has cancelled the ride",
															userId: users[i].userId,
															rideId: ride.id,
															riderId: users[i].userId,
															rideDate: ride.date,
															rideTime: ride.time,
															// data is deprecatd, used only for old notifications db table
															data: '{ "rideId":"' + ride.id + '","riderId":"' + users[i].userId + '","rideDate":"' + ride.date + '","rideTime":"' + ride.time +
																'","type":"' + "ride_cancelled" + '","message":"' + "Sorry, " + userData.firstName + " " + userData.lastName + " has cancelled the ride" + '" }'
														}
														sendData(UserLogins, loginToken, data, true)
														let rideFrom = await Locations.findById(newRide.fromId)
														let rideTo = await Locations.findById(newRide.toId)
														createNotification(userData.picture, `${userData.firstName} ${userData.lastName} has <strong>cancelled</strong> the ride from ${rideFrom.englishName} to ${rideTo.englishName} on ${formatNotificationDate(newRide.dateTime)}`, 10, userData.userId, users[i].userId, ride.id, null);
														await cancelRidePendingTransactions(ride.id)
													}

													dispatchSuc(res, [])
												})
													.catch((err) => dispatchErr(res, [err.message]))
											}).catch((err) => dispatchErr(res, [err.message]))

											dispatchSuc(res, [])
										})
										.catch((err) => dispatchErr(res, [err.message]))
								} else { // if not exist leave regularride in rides, then create according to the regularRideId and date
									//there must be a way to check the date
									let newRide = {}
									newRide.id = createUuid()
									newRide.regularRideId = regularRide.id
									newRide.fromId = regularRide.fromId
									newRide.toId = regularRide.toId
									newRide.driver = regularRide.driver
									newRide.status = 'cancelled'
									newRide.seats = regularRide.seats
									newRide.date = date
									newRide.time = regularRide.time
									newRide.carId = regularRide.carId
									newRide.groupId = regularRide.groupId
									newRide.dateTime = new Date(date + " " + regularRide.time).getTime()
									newRide.promoCode = regularRide.promoCode
									Rides.create(newRide)
										.then((newRide) => {

											dispatchSuc(res, [])
											return
										})
										.catch((err) => reject([err.message]))
								}
							})
							.catch((err) => reject([err.message]))

					}
				}).catch((err) => dispatchErr(res, [err.message]))
			} else {
				Rides.findById(rideId)
					.then((ride) => {
						if (ride === null) {
							dispatchErr(res, ['Invalid rideId'])
							return
						}
						if (ride.driver !== self) {
							dispatchErr(res, ['Permission denied'])
							return
						}
						if (ride.status == 'deleted' || ride.status == 'cancelled' || ride.status == 'finished') {
							dispatchErr(res, ["this ride is " + ride.status])
							return
						}
						ride.update(newRide)
							.then(() => {
								RideRiders.findAll({
									where: {
										rideId: ride.id,
										$or: [{
											status: 'accepted'
										}, {
											status: 'pending'
										}]
									}
								}).then((users) => {
									if (users === null) {
										dispatchErr(res, [" Invalid User "])
										return
									}

									Users.findById(self).then(async (userData) => {
										for (var i = 0; i < users.length; i++) {
											let data = {
												type: "ride_cancelled",
												title: 'Ride Cancelled',
												message: "Sorry, " + userData.firstName + " " + userData.lastName + " has cancelled the ride",
												userId: users[i].userId,
												rideId: ride.id,
												rideDate: ride.date,
												rideTime: ride.time,
												// data is deprecatd, used only for old notifications db table
												data: '{ "rideId":"' + ride.id + '","rideDate":"' + ride.date + '","rideTime":"' + ride.time +
													'","type":"' + "ride_cancelled" + '","message":"' + "Sorry, " + userData.firstName + " " + userData.lastName + " has cancelled the ride" + '" }'
											}

											// remove all redis notifications for riders and driver
											let before30 = momentTimezone(ride.dateTime).tz('Africa/Cairo').subtract(30, 'minutes').format('DD-MM-YYYY-HH-mm');
											let before10 = momentTimezone(ride.dateTime).tz('Africa/Cairo').subtract(10, 'minutes').format('DD-MM-YYYY-HH-mm');
											let rideTime = momentTimezone(ride.dateTime).tz('Africa/Cairo').format('DD-MM-YYYY-HH-mm');
											let after15 = momentTimezone(ride.dateTime).tz('Africa/Cairo').add(15, 'minutes').format('DD-MM-YYYY-HH-mm');
											let rideRiders = await RideRiders.findAll({
												where: { rideId: rideId }
											})
											rideRiders.forEach((rider) => {
												redisClient.del(before30 + "-" + rider.id, (err, res) => console.log({ err, res }));
												redisClient.del(before10 + "-" + rider.id, (err, res) => console.log({ err, res }));
												redisClient.del(rideTime + "-" + rider.id, (err, res) => console.log({ err, res }));
												redisClient.del(after15 + "-" + rider.id, (err, res) => console.log({ err, res }));
											})
											redisClient.del(before30 + "-" + ride.driver, (err, res) => console.log({ err, res }));
											redisClient.del(before10 + "-" + ride.driver, (err, res) => console.log({ err, res }));
											redisClient.del(rideTime + "-" + ride.driver, (err, res) => console.log({ err, res }));
											redisClient.del(after15 + "-" + ride.driver, (err, res) => console.log({ err, res }));

											sendData(UserLogins, loginToken, data, true)
											let rideFrom = await Locations.findById(ride.fromId)
											let rideTo = await Locations.findById(ride.toId)
											createNotification(userData.picture, `${userData.firstName} ${userData.lastName} has <strong>cancelled</strong> the ride from ${rideFrom.englishName} to ${rideTo.englishName} on ${formatNotificationDate(ride.dateTime)}`, 10, userData.userId, users[i].userId, ride.id, null);
											await cancelRidePendingTransactions(ride.id)
										}
										dispatchSuc(res, [])
									})
										.catch((err) => dispatchErr(res, [err.message]))
								}).catch((err) => dispatchErr(res, [err.message]))
							})
							.catch((err) => dispatchErr(res, err))

					}).catch((err) => dispatchErr(res, [err.message]))

			}

		})
		.catch((err) => dispatchErr(res, err))
}

// /ride/ route
let createRide = (req, res, next) => {
	let loginToken = req.headers.logintoken
	let rawNewRide = req.body
	rawNewRide.from = req.body.from === undefined ?
		dispatchErr(res, ['No from passed']) :
		req.body.from
	if (!rawNewRide.from.englishName) {
		dispatchErr(res, ['No name passed for from point'])
	}
	rawNewRide.to = req.body.to === undefined ?
		dispatchErr(res, ['No to passed']) :
		req.body.to
	if (!rawNewRide.to.englishName) {
		dispatchErr(res, ['No name passed for to point'])
	}
	rawNewRide.seats = req.body.seats === undefined ?
		dispatchErr(res, ['No seats passed']) :
		req.body.seats
	rawNewRide.date = req.body.date === undefined ?
		dispatchErr(res, ['No date passed']) :
		validateDate(req.body.date) === true ? req.body.date : dispatchErr(res, ["Date format is not valid "])
	let { from, to } = req.body;
	let distanceBetweenCoordinates = getDistancBetweenCoordinates(parseFloat(from.lng), parseFloat(from.lat), parseFloat(to.lng), parseFloat(to.lat));
	if (distanceBetweenCoordinates < 1000) {
		return dispatchErr(res, ['Sorry, distance between pickup and dropoff location is less than 1 km'])
	}

	rawNewRide.carId = req.body.carId
	returnTime = req.body.returnTime;
	groupId = req.body.groupId

	//check car owner 
	let checkCarOwner = (userId) => {
		new Promise(
			(resolve, reject) => {

				let where
				req.body.carId === undefined ?
					where = {
						userId: userId,
						status: 'active'
					} :
					where = {
						userId: userId,
						status: 'active',
						id: req.body.carId
					}
				UserCars.findOne({
					attributes: ['userId', 'status', 'id'],
					where: where
				})
					.then((carOwner) => {
						if (carOwner === null && (req.body.carId === undefined)) {
							dispatchErr(res, ["Please add your car in your profile section"])
							return
							// reject(["you are not the owner of this car"])
						} else if (carOwner === null) {
							dispatchErr(res, ["Please add your car in your profile section"])
							return
						} else if (carOwner.status == "active") {
							rawNewRide.carId = req.body.carId === undefined ?
								carOwner.id :
								req.body.carId
							let self = userId
							// Call createUserRide directly without checking for user group
							let myGroupId = groupId || null
							createUserRide(self, myGroupId)
							//check if user have already joined at least one group
							// GroupUsers.findOne({
							// 	where: {
							// 		userId: self,
							// 		status: 'verified'
							// 	}
							// })
							// 	.then((userGroup) => {
							// 		if (userGroup == null)
							// 			dispatchErrContent(res, {
							// 				"verified": false
							// 			}, ['You must join a group first'])
							// 		else {
							// 			if (groupId !== null && groupId !== undefined) {
							// 				GroupUsers.findOne({
							// 					where: {
							// 						userId: self,
							// 						groupId: groupId,
							// 						// Edit (NO VERIFY)
							// 						/*status: 'verified'*/
							// 					}
							// 				})
							// 					.then((group) => {
							// 						if (group == null)
							// 							dispatchErr(res, ['You are not a member of this group'])
							// 						else {
							// 							//add ride to the rides table
							// 							createUserRide(self, groupId)
							// 						}
							// 					})
							// 					.catch((err) => dispatchErr(res, err.message))
							// 			} else { // in case of groupId is not sent, but already joined a group
							// 				groupId = userGroup.groupId
							// 				createUserRide(self, groupId)
							// 			}
							// 		}
							// 	})
							// 	.catch((err) => dispatchErr(res, err.message))


						} else {
							console.log("Please add your car in your profile section")
							dispatchErr(res, ["Please add your car in your profile section"])
							return
						}



					}).catch((err) => reject([err]))
			}
		)
	}

	let createUserRide = (userId, groupId) =>
		new Promise((resolve, reject) => {
			rawNewRide.id = createUuid()
			rawNewRide.groupId = groupId
			rawNewRide.driver = userId
			rawNewRide.dateTime = new Date(rawNewRide.date + " " + rawNewRide.time).getTime()
			prepareInput(rawNewRide)
				.then((newRide) => {
					getOrAddLocations(newRide.from, newRide.to)
						.then((results) => {
							if (results[0] == undefined || results[1] == undefined) {
								dispatchErr('Can not find location of from or to')
								return
							}
							newRide.fromId = results[0].id
							newRide.toId = results[1].id

							checkLocations(Locations, newRide)
								.then((newRide) => {

									checkPromoCode(groupId)
										.then(() => {
											Rides.create(newRide)
												.then(() => {
													newRide.locationFrom = results[0]
                                        			newRide.locationTo = results[1]
													eventEmitter.emit('RideCreated', newRide)
													if (returnTime) {
														returnRide = {}
														returnRide.time = returnTime;
														returnRide.fromId = results[1].id
														returnRide.toId = results[0].id
														returnRide.id = createUuid()
														returnRide.driver = newRide.driver
														returnRide.groupId = newRide.groupId
														returnRide.seats = newRide.seats
														returnRide.date = newRide.date
														returnRide.carId = newRide.carId
														returnRide.dateTime = new Date(newRide.date + " " + returnTime).getTime()
														returnRide.promoCode = newRide.promoCode
														Rides.create(returnRide)
															.then(() => {
																newRide.locationFrom = results[1]
                                        						newRide.locationTo = results[0]
																eventEmitter.emit('RideCreated', newRide)
																dispatchSuc(res, null)
															})
															.catch((err) => dispatchErr(res, err.message))
													} else {
														dispatchSuc(res, null)
													}
												})
												.catch((err) => {
													dispatchErr(res, err.message)
												})
										})
										.catch((err) => dispatchErr(res, err))
								}).
								catch((err) => dispatchErr(res, err))
						})
						.catch((err) => dispatchErr(res, err.message))
				})
				.catch((err) => dispatchErr(res, err.message))
		})

	let checkPromoCode = (groupId) =>
		new Promise((resolve, reject) => {
			if (rawNewRide.promoCode) {
				validatePromoCode(rawNewRide.promoCode, groupId)
					.then(() => resolve())
					.catch((err) => reject(err))
			} else {
				resolve()
			}
		})

	// This Promises chain validates loginToken, then
	// prepares the input, validates the locations and
	// their diversity, then eventually adds the ride
	checkLoginToken(UserLogins, loginToken)
		.then((self) => {
			// Edit (NO VERIFY)
			// checkUserVerification(self).then(() =>
					checkUserRidesAtDateAndTime(self, rawNewRide.date, rawNewRide.time, false)
						.then(() => {
							if (returnTime !== undefined) {
								checkUserRidesAtDateAndTime(self, rawNewRide.date, returnTime, true)
									.then(() => {
										checkCarOwner(self)
									})
									.catch((err) => dispatchErr(res, err))
							} else {
								checkCarOwner(self)
							}
						})
						.catch((err) => dispatchErr(res, err))
				//).catch((err) => dispatchErrContent(res, { "verified": false }, err))

		})
		.catch((err) => dispatchErr(res, err))

}

// /rides/?{q=} route
let searchRides = (req, res, next) => {
	let loginToken = req.headers.logintoken
	// prepare params
	let from = {
		// lat: req.query.fromLat != undefined ? req.query.fromLat : undefined,
		lat: (req.query.fromLat || undefined),
		// lng: req.query.fromLng != undefined ? req.query.fromLng : undefined
		lng: (req.query.fromLng || undefined)
	}

	let to = {
		lat: req.query.toLat || undefined,
		lng: req.query.toLng || undefined,
	}
	
	let limit = req.query.limit == undefined ? 10 : req.query.limit
	limit = parseInt(limit)
	let offset = req.query.offset == undefined ? 0 : req.query.offset
	offset = parseInt(offset)
	let date = req.query.date;

	// check from point
	if ((from.lat && !from.lng) || (from.lng && !from.lat)) {
		// ensure lat & lng are not undefined
		dispatchErr(res, ['From point is required'])
		return
	}

	// check to point
	if ((to.lat && !to.lng) || (to.lng && !to.lat)) {
		// ensure lat & lng are not undefined
		dispatchErr(res, ['To point is required'])
		return
	}

	// check date param
	if (!Boolean(date)) {
		dispatchErr(res, ["date param is required"])
		return
	}

	let getUserGroups = (userId) => {
		return new Promise(
			(resolve, reject) => {
				GroupUsers.findAll({
					where: {
						userId: userId,
						// // Edit (NO VERIFY)
						/*status: 'verified'*/
					},
					attributes: ['groupId'],
					include: [{
						model: Groups,
						attributes: ['private']
					}]
				})
					.then((groups) => {
						if (groups == null) {
							resolve([])
						} else {
							resolve(groups)
						}
					})
					.catch((err) => reject([err.message]))
			}
		)
	}

	let getRides = (userId, groups) => {
		return new Promise((resolve, reject) => {
			let getTheRides = () => {
				return new Promise((resolve, reject) => {
					// prepare const & vars
					const maxSearchDistance = 2.5
					let timestamp = new Date().getTime()

					// prepare groups values
					if (groups && groups.length > 0) {
						var allUserGroupsArePrivate = true
						for (var i = 0; i < groups.length; i++) {
							if (!groups[i].Group.private) {
								allUserGroupsArePrivate = false
								break
							}
						}
					} else {
						var allUserGroupsArePrivate = false
					}

					// prepare the query
					// rides query
					var query = `SELECT Rides.id, Rides.from, Rides.to, Rides.time, -1 AS day, Rides.groupId, Groups.private, false AS isRegularRide FROM Rides
                    INNER JOIN Locations AS locationsFrom ON Rides.from = locationsFrom.id
                    INNER JOIN Locations AS locationsTo ON Rides.to = locationsTo.id
                    LEFT JOIN Groups ON Rides.groupId = Groups.id
                    WHERE (Rides.status IS NULL OR (Rides.status != 'cancelled' AND Rides.status != 'deleted' AND Rides.status != 'finished'))
                    AND Rides.dateTime >= ${timestamp}`
					if (from && from.lat && from.lng) {
						query += ` AND dist(locationsFrom.lat, locationsFrom.lng, ${from.lat}, ${from.lng} ) <= ${maxSearchDistance}`
					}
					if (to && to.lat && to.lng) {
						query += ` AND dist(locationsTo.lat, locationsTo.lng, ${to.lat}, ${to.lng} ) <= ${maxSearchDistance}`
					}
					query += ` AND Rides.date = '${date}'`
					if (allUserGroupsArePrivate) {
						// // Edit (NO VERIFY)
						query += ` AND (private = 1 AND EXISTS (SELECT userId FROM GroupUsers WHERE userId = '${userId}' AND groupId = Rides.groupId))` //  AND status = 'verified' (after groupId)
					} else {
						// // Edit (NO VERIFY)
						query += ` AND (private IS NULL || private = 0 OR (private = 1 AND EXISTS (SELECT userId FROM GroupUsers WHERE userId = '${userId}' AND groupId = Rides.groupId)))`  //  AND status = 'verified' (after groupId)
					}
					
					query += ` UNION ALL`

					// regular rides query
					query += ` SELECT RegularRide.id, RegularRide.from, RegularRide.to, RegularRide.time, RegularRideDays.day, RegularRide.groupId, Groups.private, true AS isRegularRide FROM RegularRide
                    INNER JOIN Locations AS locationsFrom ON RegularRide.from = locationsFrom.id
                    INNER JOIN Locations AS locationsTo ON RegularRide.to = locationsTo.id
                    INNER JOIN RegularRideDays ON RegularRide.id = RegularRideDays.regularRideId
                    LEFT JOIN Groups ON RegularRide.groupId = Groups.id
                    WHERE (RegularRide.status IS NULL OR (RegularRide.status != 'cancelled' AND RegularRide.status != 'deleted' AND RegularRide.status != 'finished'))`
					if (from && from.lat && from.lng) {
						query += ` AND dist(locationsFrom.lat, locationsFrom.lng, ${from.lat}, ${from.lng}) <= ${maxSearchDistance}`
					}
					if (to && to.lat && to.lng) {
						query += ` AND dist(locationsTo.lat, locationsTo.lng, ${to.lat}, ${to.lng}) <= ${maxSearchDistance}`
					}
					query += ` AND day = ${getWeekDayIndex(date)}`
					if (isToday(date)) {
						query += ` AND time > '${getCurrentTime()}'`
					}
					if (allUserGroupsArePrivate) {
						// // Edit (NO VERIFY)
						query += ` AND (private = 1 AND EXISTS (SELECT userId FROM GroupUsers WHERE userId = '${userId}' AND groupId = RegularRide.groupId))`  //  AND status = 'verified' (after groupId)
					} else {
						// // Edit (NO VERIFY)
						query += ` AND (private IS NULL || private = 0 OR (private = 1 AND EXISTS (SELECT userId FROM GroupUsers WHERE userId = '${userId}' AND groupId = RegularRide.groupId)))`  //  AND status = 'verified' (after groupId)
					}
					query += ` AND NOT EXISTS(SELECT id FROM Rides WHERE regularRideId = RegularRide.id AND date = '${date}')
                        ORDER BY time ASC LIMIT ${limit} OFFSET ${offset} `

					// execute the query
					sequelize.query(query, {
						type: Sequelize.QueryTypes.SELECT
					}).then((rides) => {
						// prepare result object
						let resultObj = {
							originalCount: 0,
							rides: []
						}

						// check if null, create empty one
						if (rides == null) {
							resolve(resultObj)
							return
						}

						// prepare final rides list
						let promises = rides.map(ride => getRide(ride))
						
						Q.all(promises)
							.then((result) => {
								// console.log('Result: ', result)
								resolve(result)
							})
							.catch((err) => reject([err.message]))
					}).catch((err) => reject(err.message))
				})
			}

			let getRide = (ride) => {
				return new Promise((resolve, reject) => {
					// check isRegularRide flag
					if (!ride.isRegularRide) {
						// normal ride,
						// get the ride and resolve
						getRideById(ride.id)
							.then((ride) => resolve(ride))
							.catch((err) => reject([err.message]))
					} else {
						// regualr ride,
						// get the final ride object of this regular ride and resolve
						getRegularRideById(ride.id)
							.then((regularRide) => {
								console.log('The Ride: ', regularRide)
								let convertedObj = convertRegularRideToRide(regularRide, date)
								console.log('The Ride Converted: ', convertedObj)
								resolve(convertedObj)
							})
							.catch((err) => reject([err.message]))
					}
				})
			}

			getTheRides()
				.then((rides) =>
					resolve(rides)
				)
				.catch((err) => reject([err.message]))
		})
	}

	checkLoginToken(UserLogins, loginToken)
		.then((self) =>
			getUserGroups(self)
				.then((groups) =>
					getRides(self, groups)
						.then((rides) =>
							dispatchSuc(res, rides)
						)
						.catch((err) => dispatchErr(res, err))
				)
				.catch((err) => dispatchErr(res, err))
		)
		.catch((err) => dispatchErr(res, err))
}

let activeRides = (req, res) => {
	let loginToken = req.headers.logintoken || req.headers.loginToken;
	let userId;
	let startedRides, accepted10MinsOrLess, finishedNoDriverRating, ridesNoRiderRating;
	checkLoginToken(UserLogins, loginToken)
		.then((userId) => {
			let now = moment().valueOf();
			let later = moment().add(10, 'minutes').valueOf();
			return Promise.all(
				[
					sequelize.query(`
				SELECT rides.id FROM foorera_api.Rides AS rides
				INNER JOIN foorera_api.RideRiders AS rrs ON rides.id = rrs.rideId
				INNER JOIN foorera_api.Users as users ON users.userId = rrs.userId
				WHERE users.userId = "${userId}" AND rrs.status = "accepted" AND rides.dateTime > ${now} AND rides.dateTime < ${later} AND rides.status IS NULL OR (rides.status <> 'finished' AND rides.status <> 'cancelled' AND rides.status <> 'deleted')`
						, { type: sequelize.QueryTypes.SELECT })
					,
					sequelize.query(`
				SELECT rides.id FROM foorera_api.Rides AS rides
				INNER JOIN foorera_api.RideRiders AS rrs ON rides.id = rrs.rideId
				INNER JOIN foorera_api.Users as users ON users.userId = rrs.userId
				WHERE users.userId = "${userId}" AND rrs.status = "started" AND rides.status IS NULL OR (rides.status <> 'finished' AND rides.status <> 'cancelled' AND rides.status <> 'deleted')`
						, { type: sequelize.QueryTypes.SELECT })
					,
					sequelize.query(`
				SELECT rides.id FROM foorera_api.Rides AS rides
				INNER JOIN foorera_api.RideRiders AS rrs ON rides.id = rrs.rideId
				INNER JOIN foorera_api.Users as users ON users.userId = rrs.userId
				WHERE users.userId = "${userId}" AND rrs.driverRating IS null AND rrs.status = "finished"`
						, { type: sequelize.QueryTypes.SELECT })
					,
					sequelize.query(`
				SELECT rides.id FROM foorera_api.Rides AS rides
				INNER JOIN foorera_api.RideRiders AS rrs ON rides.id = rrs.rideId
				WHERE rides.driver = "${userId}" AND rrs.riderRating IS null AND rrs.status = "finished"
				GROUP BY rides.id`
						, { type: sequelize.QueryTypes.SELECT })
				]
			)
		})
		.then((values) => {
			// get rides arrays
			riderToStartRides = values[0];
			riderStartedRides = values[1];
			riderFinishedNotRatedRides = values[2];
			driverFinishedNotRatedRides = values[3];

			// prepare final rides promises
			let promises = []
			for (var i = 0; i < riderToStartRides.length; i++) {
				promises.push(getRideById(riderToStartRides[i].id))
			}
			for (var i = 0; i < riderStartedRides.length; i++) {
				promises.push(getRideById(riderStartedRides[i].id))
			}
			for (var i = 0; i < riderFinishedNotRatedRides.length; i++) {
				promises.push(getRideById(riderFinishedNotRatedRides[i].id))
			}
			for (var i = 0; i < driverFinishedNotRatedRides.length; i++) {
				promises.push(getRideById(driverFinishedNotRatedRides[i].id))
			}

			return Promise.all(promises)
				.then((rides) => {

					dispatchSuc(res, rides)
				})
				.catch((err) => dispatchErr(res, [err.message]))
		})
		.catch((err) => {
			dispatchErr(res, err);
		})
}

module.exports = {
	getRideFare,
	getRide,
	joinRide,
	editRideStatus,
	rateRide,
	editRide,
	cancelRide,
	createRide,
	searchRides,
	getRideById,
	activeRides
}