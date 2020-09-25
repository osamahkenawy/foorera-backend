# Foorera Web API

[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-yellow.svg)](http://standardjs.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![node](https://img.shields.io/badge/node-v7.x-brightgreen.svg)](https://nodejs.org/dist/latest-v7.x/docs/api/)

Foorera Web API is a REST api under development currently developed by [Andrea Amorosi](https://www.andreamorosi.me). A live version currently accepts queries [here](http://test.andreamorosi.me).

### Stack

Foorera Web API uses a number of open source projects to work properly:

* [Node.js] - Evented I/O for the backend
* [Restify] - As backbone for the Web API
* [Sequelize] - For ORM database interaction
* [Node-uuid] - For UUID generation
* [Random-js] - For verification code generation
* [Request-promise] - For Social Network verification
* [Sendmail] - SMTP-less email sending


### Installation

The Web API requires [Node.js] v7.x+ to run.

Clone this repository, set up the database and then install the dependencies and devDependencies and start the server.

```sh
$ cd foorera
$ npm install -d
$ sequelize db:migrate
$ npm start
```
**Please note that in production mode the Web Api will reject any non secure connection, so always use HTTPS.**

For dev environments...

```sh
$ docker-compose up
$ cd foorera
$ npm install
$ sequelize db:migrate
$ sequelize db:seed:all
$ npm run-script development
```

### Endpoints

Each endpoint has its own workflow that is explained both in the commits' comments and in the source code throughout comments. That said as a rule of thumb you should always assume that the User should be logged in (except for Social-login and Settings and that she can't perform destructive actions on data that doesn't own. This means that a valid *loginToken* should always be passed in the request headers and that an User can't, for example, delete or edit a Ride that doesn't belong to her.
All the other parameters are optional except where otherwise specified.

##### Response example
```json
{
  "status": "Boolean",
  "content": "Array/Object",
  "validation": "Array"
}
```

All the responses returned by the Web API will have the structure described above and below.

+ status: Being a boolean value it can either be *true* or *false*. It represents whether the request has been successful or not but **doesn't implies that a result has been found or not**, it just means that the request went trough without any error.
+ content: Contains the results of the query and it will be an Object in case of single result or an array of objects in case of multiple results. It will be an empty array when *"response": false* or when the query was an action.
+ validation: Contains all the errors encountered during the request evaluation. Since the API adopts a [fail-fast] approach it will almost always contain just one error.

All the request examples below are written in plain HTTP but can easily be adapted to any language that supports HTTP requests.

#### Authentication

##### Social-login new User

```sh
GET /login/social?userid={userid}&authToken={authToken}
Host: {Host}
Connection: close
```
Query parameters:

+ userid: Facebook User ID as returned from Facebook Login API. _(required)_
+ authToken: Facebook Auth Token as returned from Facebook Login API. _(required)_

```json
{
  "status": true,
  "content": {
    "loginToken": "412c6349c8cf8a67c45ed52e94c0ee139bdc52be4fa7afee3a3eb10238947937"
  }
},
"validation": []
```

[View code](/routes/logins.js?at=stable&fileviewer=file-view-default#logins.js-8)

##### Social-login returning User

```sh
GET /login/social?userid={userid}&authToken={authToken}&deviceId={deviceId}
Host: {Host}
Connection: close
```
Query parameters:

+ userid: Facebook User ID as returned from Facebook Login API. _(required)_
+ authToken: Facebook Auth Token as returned from Facebook Login API. _(required)_
+ deviceId: User's deviceId. _(required)_

```json
{
  "status": true,
  "content": {
    "loginToken": "412c6349c8cf8a67c45ed52e94c0ee139bdc52be4fa7afee3a3eb10238947937"
  },
  "validation": []
}
```

[View code](/routes/logins.js?at=stable&fileviewer=file-view-default#logins.js-8)

##### Register

```sh
GET /login/register?firstName={firstName}&lastName={lastName}&gender={gender}&picture={picture}&cellphone={cellphone}&ridesWith={ridesWith}&email={email}&encPassword={encPassword}
Host: {Host}
loginToken: {loginToken}
Connection: close
```
Query parameters:

+ firstName
+ lastName
+ gender
+ picture
+ cellphone
+ ridesWith
+ email
+ encPassword

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": {
    "userId": "4ba0144d-e19b-4a23-a539-064015ad8c9e",
    "firstName": "Alice",
    "lastName": "Doe",
    "gender": "1",
    "picture": null,
    "cellphone": "12345678",
    "ridesWith": 1,
    "email": "alice.doe@email.com",
    "status": "verified"
  },
  "validation": []
}
```

[View code](/routes/logins.js?at=stable&fileviewer=file-view-default#logins.js-156)

##### Request Reset Password

```sh
POST /users/request_reset_password
Host: {Host}
Connection: close
{
  "email": "alice.doe@email.com"
}
```

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

##### Reset Password

```sh
POST /users/reset_password
Host: {Host}
Connection: close
{
  "token": "abc123",
  "password": "12345678"
}
```

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

##### Change Password

```sh
POST /users/change_password
Host: {Host}
Connection: close
loginToken: {loginToken}
{
  "email": "alice.doe@email.com",
  "password": "12345678",
  "newPassword": "87654321"
}
```

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

#### Settings

##### All settings

```sh
GET /config
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": [
    {
      "skey": "setting1",
      "value": "true",
      "isPublic": true
    },
    {
      "skey": "setting2",
      "value": "true",
      "isPublic": false
    }
  ],
  "validation": []
}
```

[View code](/routes/settings.js?at=stable&fileviewer=file-view-default#settings.js-5)

##### Public settings

```sh
GET /config
Host: {Host}
Connection: close
```

```json
{
  "status": true,
  "content": [
    {
      "skey": "setting1",
      "value": "true",
      "isPublic": true
    }
  ],
  "validation": []
}
```

[View code](/routes/settings.js?at=stable&fileviewer=file-view-default#settings.js-5)

#### Groups

##### Groups list
```sh
GET /groups?q={query}
Host: {Host}
Connection: close
```

Query parameters:

+ q

```json
{
  "status": true,
  "content": [
    {
      "id": "74ec3ef24588-450e-8094-a9301eb2fc4a",
      "name": "Group 1",
      "status": "pending",
      "icon": null,
      "categoryId": "809b3ff7-e538-4db3-b6ed-172ded6f051e"
    },
    ...
  ],
  "validation": []
}
```

[View code](/routes/groups.js?at=stable&fileviewer=file-view-default#groups.js-106)

##### Specific Group
```sh
GET /groups/{:groupId}
Host: {Host}
Connection: close
```

Parameters:

+ groupId _(required)_

```json
{
  "status": true,
  "content": {
    "id": "74ec3ef24588-450e-8094-a9301eb2fc4a",
    "name": "Group 1",
    "status": "pending",
    "icon": null,
    "category": {
      "id": "809b3ff7-e538-4db3-b6ed-172ded6f051e",
      "name": "Category1",
      "description": "this is a category"
    },
    "domains": [
      "sharklasers.com",
      "microsoft.com"
    ],
    "admins": [
      {
        "userId": "cc66036f823f-40c5-ad3c-b32d474356ec",
        "firstName": "Admin",
        "lastName": "1",
        "gender": true,
        "picture": null,
        "cellphone": null,
        "ridesWith": null,
        "email": "admin@sharklasers.com",
        "encPassword": null,
        "status": "pending email verification"
      }
    ]
  },
  "validation": []
}
```

[View code](/routes/groups.js?at=stable&fileviewer=file-view-default#groups.js-18)

##### Groups Types

```sh
GET /groupstypes
Host: {Host}
Connection: close
```

```json
{
  "status": true,
  "content": [
    {
      "id": "775d58e1-22f8-424f-9d2b-b56a389b82ec",
      "name": "Category3",
      "description": "lorem ipsum dolor sit amet"
    },
    {
      "id": "809b3ff7-e538-4db3-b6ed-172ded6f051e",
      "name": "Category1",
      "description": "this is a category"
    },
    {
      "id": "92199f93-155a-4573-a2cf-94d6279152e7",
      "name": "Category2",
      "description": "this is another category"
    }
  ],
  "validation": []
}
```

[View code](/routes/groups.js?at=stable&fileviewer=file-view-default#groups.js-5)

##### Leave Group
```sh
GET /groups/{:groupId}/leave
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Headers:

+ loginToken _(required)_

Parameters:

+ groupId _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/groups.js?at=stable&fileviewer=file-view-default#groups.js-122)

##### Leave Group
```sh
GET /groups
Host: {Host}
Connection: close
{
    "name": {name},
    "status": {status},
    "icon": {icon}
    "categoryId": {categoryId}
}
```

Body parameters:

+ name _(required)_
+ status
+ icon
+ categoryId _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/groups.js?at=stable&fileviewer=file-view-default#groups.js-151)

#### Verification

##### Verify Email

```sh
GET /email/verify?groupId={groupId}&email={email}&userId={userId}
Host: {Host}
Connection: close
```
Query parameters:

+ email _(required)_
+ userId _(required)_ to identify the user to be verified
+ groupId is optional but will take priority over the email address for the verification of the domain, if omitted the domain will be parsed from the email.

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/emails.js?at=stable&fileviewer=file-view-default#emails.js-7)

##### Check Code

```sh
GET /email/checkcode?code={code}&userId={userId}&groupId={groupId}
Host: {Host}
Connection: close
```
Query parameters:

+ code _(required)_
+ userId _(required)_ to identify the user to be verified
+ groupId _(required)_ to verify the connection between User and Group

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/emails.js?at=stable&fileviewer=file-view-default#emails.js-160)

#### Profile

##### User's Profile

```sh
GET /users/{:userId}
Host: {Host}
loginToken: {loginToken}
Connection: close
```
Parameters:

+ userId _(required)_

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": {
    "userId": "4ba0144d-e19b-4a23-a539-064015ad8c9e",
    "firstName": "Bobby",
    "lastName": "Doe",
    "gender": true,
    "picture": null,
    "cellphone": "12345678",
    "ridesWith": 1,
    "email": "alice.doe@email.com",
    "encPassword": null,
    "status": "pending code verification"
  },
  "validation": []
}
```

[View code](/routes/users.js?at=stable&fileviewer=file-view-default#users.js-5)

##### Edit User's Profile

```sh
PUT /users/{:userId}?firstName={firstName}&lastName={lastName}&gender={gender}&picture={picture}&cellphone={cellphone}&ridesWith={ridesWith}&email={email}&encPassword={encPassword}
Host: {Host}
loginToken: {loginToken}
Connection: close
```
Parameters:

+ userId _(required)_

Query parameters:

+ firstName
+ lastName
+ gender
+ picture
+ cellphone
+ ridesWith
+ email
+ encPassword

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": {
    "userId": "4ba0144d-e19b-4a23-a539-064015ad8c9e",
    "firstName": "Alice",
    "lastName": "Doe",
    "gender": true,
    "picture": null,
    "cellphone": "12345678",
    "ridesWith": "1",
    "email": "alice.doe@email.com",
    "status": "pending code verification"
  },
  "validation": []
}
```

[View code](/routes/users.js?at=stable&fileviewer=file-view-default#users.js-40)

#### Rides

##### Create Ride Alert

```sh
POST /users/{:userId}/ridealert
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"from": {locationId},
	"to": {locationId}
}
```
Parameters:

+ userId _(required)_

Body parameters:

+ from _(required)_
+ to _(required)_

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/users.js?at=stable&fileviewer=file-view-default#users.js-131)

##### Remove Ride Alert

```sh
DELETE /users/{:userId}/ridealert
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Parameters:

+ userId _(required)_

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/users.js?at=stable&fileviewer=file-view-default#users.js-164)

##### Edit Ride Alert

```sh
PUT /users/{:userId}/ridealert
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"from": {locationId},
	"to": {locationId}
}
```
Parameters:

+ userId _(required)_

Body parameters:

+ from _(required)_
+ to _(required)_

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/users.js?at=stable&fileviewer=file-view-default#users.js-181)

##### Add Regular Ride
```sh
POST /regularrides
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"driver": {userId},
	"from": {locationId},
	"to": {locationId},
  "leave": {leave},
  "return": {return},
  "seatsLeaving": {seatsLeaving},
  "seatsReturning": {seatsReturning}
}
```

Body parameters:

+ driver _(required)_
+ from _(required)_
+ to _(required)_
+ leave
+ return
+ seatsLeaving
+ seatsReturning

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/regularRides.js?at=stable&fileviewer=file-view-default#regularRides.js-5)

##### Edit Regular Ride
```sh
PUT /regularrides/{:regularRideId}
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"driver": {userId},
	"from": {locationId},
	"to": {locationId},
  "leave": {leave},
  "return": {return},
  "seatsLeaving": {seatsLeaving},
  "seatsReturning": {seatsReturning}
}
```

Parameters:

+ regularRideId _(required)_

Body parameters:

+ driver _(required)_
+ from _(required)_
+ to _(required)_
* leave
* return
+ seatsLeaving
+ seatsReturning

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/regularRides.js?at=stable&fileviewer=file-view-default#regularRides.js-37)

##### Remove Regular Ride

```sh
DELETE /regularrides/{:regularRideId}
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Parameters:

+ regularRideId _(required)_

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/regularRides.js?at=stable&fileviewer=file-view-default#regularRides.js-76)

##### Ride Details

```sh
GET /rides/{:rideId}
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Parameters:

+ rideId _(required)_

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": {
    "id": "6d8533a6-988a-4217-a511-88c108ce1be7",
    "driver": "4ba0144d-e19b-4a23-a539-064015ad8c9e",
    "seats": null,
    "time": "18:04,mar",
    "from": {
      "id": "6b738036-bcc7-46b2-baea-9cf1ebe6e4b9",
      "lat": "30.0444",
      "lng": "31.2357",
      "englishName": null,
      "arabicName": "القاهرة",
      "notes": null
    },
    "to": {
      "id": "7e45c8b4-ee77-439d-8c8e-67d98f31e3f1",
      "lat": "25.6872",
      "lng": "32.6396",
      "englishName": "Luxor",
      "arabicName": null,
      "notes": "Lorem ipsum dolor sit amet"
    }
  },
  "validation": []
}
```

[View code](/routes/rides.js?at=stable&fileviewer=file-view-default#rides.js-5)

##### Add Ride (Offer)
```sh
POST /rides/
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"from": {locationId},
	"to": {locationId},
  "seats": {seats},
  "time": {time}
}
```

Body parameters:

+ from _(required)_
+ to _(required)_
+ seats
+ time _(required)_

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/rides.js?at=stable&fileviewer=file-view-default#rides.js-298)

##### Cancel Ride
```sh
DELETE /rides/{:rideId}
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Parameters:

+ rideId _(required)_

Headers:
+ loginToken _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/rides.js?at=stable&fileviewer=file-view-default#rides.js-267)

##### Join ride
```sh
POST /rides/{:regularRideId}/riders
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"from": {locationId},
	"to": {locationId}
}
```
Parameters:

+ regularRideId _(required)_

Body parameters:

+ from _(required)_
+ to _(required)_

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/rides.js?at=stable&fileviewer=file-view-default#rides.js-31)

##### Edit ride status (Rider)
```sh
PUT /rides/{:regularRideId}/riders
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"action": {leave|start|end}
}
```
Parameters:

+ regularRideId _(required)_

Body parameters:

+ action _(required)_

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/rides.js?at=stable&fileviewer=file-view-default#rides.js-84)

##### Edit ride status (Driver)
```sh
PUT /rides/{:regularRideId}/riders
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"action": {accept|decline}
}
```
Parameters:

+ regularRideId _(required)_

Body parameters:

+ action _(required)_

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/rides.js?at=stable&fileviewer=file-view-default#rides.js-84)

##### Rate ride
```sh
PUT /rides/{:rideId}/rate
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"rating": {rating}
}
```
Parameters:

+ rideId _(required)_

Body parameters:

+ rating _(required)_

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/rides.js?at=stable&fileviewer=file-view-default#rides.js-167)

##### Edit Ride
```sh
PUT /rides/{:rideRiderId}
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"from": {locationId},
	"to": {locationId}
}
```

Parameters:

+ rideId _(required)_

Body parameters:

+ from _(required)_
+ to _(required)_

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/rides.js?at=stable&fileviewer=file-view-default#rides.js-221)

#### User's Rides

##### Regular Rides

```sh
GET /users/{:userId}/regularrides
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Parameters:

+ userId _(required)_

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": {
    "regularRides": [
      {
        "id": "709d312a-07ec-4258-b0bb-4a73f566166c",
        "driver": "4ba0144d-e19b-4a23-a539-064015ad8c9e",
        "leave": null,
        "return": null,
        "seatsLeaving": 5,
        "seatsReturning": null,
        "from": {
          "id": "6b738036-bcc7-46b2-baea-9cf1ebe6e4b9",
          "lat": "30.0444",
          "lng": "31.2357",
          "englishName": null,
          "arabicName": "القاهرة",
          "notes": null
        },
        "to": {
          "id": "7354e321-df78-4724-ae6d-131eea75542c",
          "lat": "31.2001",
          "lng": "299187",
          "englishName": "Alexandria",
          "arabicName": null,
          "notes": null
        }
      }
    ],
    "rideAlert": {
      "id": "ed9ec0b3-2eab-4b74-8813-103bc7859e6c",
      "userId": "4ba0144d-e19b-4a23-a539-064015ad8c9e",
      "from": {
        "id": "6b738036-bcc7-46b2-baea-9cf1ebe6e4b9",
        "lat": "30.0444",
        "lng": "31.2357",
        "englishName": null,
        "arabicName": "القاهرة",
        "notes": null
      },
      "to": {
        "id": "7354e321-df78-4724-ae6d-131eea75542c",
        "lat": "31.2001",
        "lng": "299187",
        "englishName": "Alexandria",
        "arabicName": null,
        "notes": null
      }
    }
  },
  "validation": []
}
```

[View code](/routes/users.js?at=stable&fileviewer=file-view-default#users.js-220)

##### User's Past Rides

```sh
GET /users/{:userId}/rides?status={status}
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Parameters:

+ userId _(required)_

Headers:

+ loginToken _(required)_

Query parameters:

+ status _(required)_

```json
{
  "status": true,
  "content": [
    {
      "rideId": "6d8533a6-988a-4217-a511-88c108ce1be7",
      "riderRating": null,
      "driverRating": 5,
      "status": "pending",
      "from": {
        "id": "6b738036-bcc7-46b2-baea-9cf1ebe6e4b9",
        "lat": "30.0444",
        "lng": "31.2357",
        "englishName": null,
        "arabicName": "القاهرة",
        "notes": null
      },
      "to": {
        "id": "7e45c8b4-ee77-439d-8c8e-67d98f31e3f1",
        "lat": "25.6872",
        "lng": "32.6396",
        "englishName": "Luxor",
        "arabicName": null,
        "notes": "Lorem ipsum dolor sit amet"
      }
    }
  ],
  "validation": []
}
```

[View code](/routes/users.js?at=stable&fileviewer=file-view-default#users.js-287)

#### Cars

##### Add User's Car

```sh
POST /users/{:userId}/car
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"modelId": {modelId},
	"colorCode": {colorCode},
  "plateNumber": {plateNumber}
}
```

Parameters:

+ userId _(required)_

Body parameters:

+ modelId _(required)_
+ colorcode _(required)_
+ plateNumber

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/users.js?at=stable&fileviewer=file-view-default#users.js-85)

##### Car Models

```sh
GET /carmodels
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": [
    {
      "id": "0661d973-3f23-48e9-bd87-acca6f9faf3c",
      "name": "TT",
      "year": 2013,
      "makeId": "c9ded543-7ec8-4903-9b57-5e997b68fefb"
    },
    {
      "id": "58142d14-f091-470f-92d8-5a6e3f2de7aa",
      "name": "X7",
      "year": 2009,
      "makeId": "c9ded543-7ec8-4903-9b57-5e997b68fefb"
    },
    {
      "id": "61379526-8f1c-4a89-92fb-93a399f2b979",
      "name": "SLK AMG",
      "year": 2015,
      "makeId": "edb1a102-f0a6-4143-8fc4-4e3f1a8ebbed"
    }
  ],
  "validation": []
}
```

[View code](/routes/cars.js?at=stable&fileviewer=file-view-default#cars.js-5)

##### Car Makers

```sh
GET /carmakers
Host: {Host}
loginToken: {loginToken}
Connection: close
```

Headers:

+ loginToken _(required)_

```json
{
  "status": true,
  "content": [
    {
      "id": "2694c25d-be7c-437e-9f2d-627c4e41157a",
      "name": "Volvo"
    },
    {
      "id": "c9ded543-7ec8-4903-9b57-5e997b68fefb",
      "name": "Audi"
    },
    {
      "id": "edb1a102-f0a6-4143-8fc4-4e3f1a8ebbed",
      "name": "Mecedes"
    }
  ],
  "validation": []
}
```

[View code](/routes/cars.js?at=stable&fileviewer=file-view-default#cars.js-24)

#### Feedbacks

##### Add User's App Feedback

```sh
POST /Feedbacks
Host: {Host}
loginToken: {loginToken}
Content-Type: application/json
Connection: close
{
	"userId": {userId},
	"rating": {rating},
	"feedbackText": {feedbackText}
}
```

Body Parameters:

+ userId _(required)_
+ rating _(required)_
+ feedbackText

Headers:

+ loginToken _(required)_
+ Content-Type: application/json _(required)_

```json
{
  "status": true,
  "content": [],
  "validation": []
}
```

[View code](/routes/feedbacks.js?at=stable&fileviewer=file-view-default#feedbacks.js-5)

### Todos

 - Write Tests

### License

[Apache 2.0]

### Versions

+ 1.5.0 26/10/16
+ 1.0.2 20/10/16
+ 1.0.0 17/10/16

[//]: # (These are reference links used in the body of this note and get stripped out when the markdown processor does its job. There is no need to format nicely because it shouldn't be seen. Thanks SO - http://stackoverflow.com/questions/4823468/store-comments-in-markdown-syntax)

   [Node.js]: <https://nodejs.org/>
   [Restify]: <http://restify.com>
   [Sequelize]: <http://sequelizejs.com>
   [Node-uuid]: <https://github.com/broofa/node-uuid>
   [Random-js]: <https://github.com/ckknight/random-js>
   [Request-promise]: <https://github.com/request/request-promise>
   [Sendmail]: <https://github.com/guileen/node-sendmail>

   [fail-fast]: <https://en.wikipedia.org/wiki/Fail-fast>
   [Apache 2.0]: <https://tldrlegal.com/license/apache-license-2.0-(apache-2.0)#summary>
