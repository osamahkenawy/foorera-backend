-- phpMyAdmin SQL Dump
-- version 4.7.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Nov 18, 2017 at 04:42 PM
-- Server version: 5.5.42
-- PHP Version: 7.0.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `foorera_api`
--

-- --------------------------------------------------------

--
-- Table structure for table `AppFeedback`
--

CREATE TABLE `AppFeedback` (
  `id` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `rating` int(1) DEFAULT '-1',
  `feedbackText` varchar(250) COLLATE utf16_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Categories`
--

CREATE TABLE `Categories` (
  `id` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `name` varchar(40) COLLATE utf16_unicode_ci NOT NULL,
  `description` varchar(250) COLLATE utf16_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `GroupAdmins`
--

CREATE TABLE `GroupAdmins` (
  `groupId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `GroupDomains`
--

CREATE TABLE `GroupDomains` (
  `domain` varchar(40) COLLATE utf16_unicode_ci NOT NULL,
  `groupId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Groups`
--

CREATE TABLE `Groups` (
  `id` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `name` varchar(50) COLLATE utf16_unicode_ci NOT NULL,
  `status` varchar(50) COLLATE utf16_unicode_ci DEFAULT 'pending',
  `icon` varchar(100) COLLATE utf16_unicode_ci DEFAULT NULL,
  `categoryId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `hr_email` varchar(50) COLLATE utf16_unicode_ci DEFAULT NULL,
  `contact_email` varchar(50) COLLATE utf16_unicode_ci DEFAULT NULL,
  `phone_number` varchar(50) COLLATE utf16_unicode_ci DEFAULT NULL,
  `private` tinyint(2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `GroupUsers`
--

CREATE TABLE `GroupUsers` (
  `groupId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `status` varchar(50) COLLATE utf16_unicode_ci DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Locations`
--

CREATE TABLE `Locations` (
  `id` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `lat` double NOT NULL,
  `lng` double NOT NULL,
  `englishName` varchar(250) COLLATE utf16_unicode_ci DEFAULT NULL,
  `arabicName` varchar(250) COLLATE utf16_unicode_ci DEFAULT NULL,
  `notes` varchar(250) COLLATE utf16_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Notifications`
--

CREATE TABLE `Notifications` (
  `id` varchar(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `message` text CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `type` varchar(30) COLLATE utf16_unicode_ci DEFAULT NULL,
  `data` text COLLATE utf16_unicode_ci,
  `userId` varchar(36) COLLATE utf16_unicode_ci DEFAULT NULL,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `PaymentPackages`
--

CREATE TABLE `PaymentPackages` (
  `id` char(36) NOT NULL,
  `amount` int(4) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `RegularRide`
--

CREATE TABLE `RegularRide` (
  `id` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `driver` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `from` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `to` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `time` varchar(10) COLLATE utf16_unicode_ci DEFAULT NULL,
  `seats` int(2) DEFAULT NULL,
  `status` char(20) COLLATE utf16_unicode_ci DEFAULT NULL,
  `groupId` char(36) CHARACTER SET utf16 COLLATE utf16_bin DEFAULT NULL,
  `carId` char(36) CHARACTER SET utf16 COLLATE utf16_bin DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `RegularRideDays`
--

CREATE TABLE `RegularRideDays` (
  `regularRideId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `day` tinyint(2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- --------------------------------------------------------

--
-- Table structure for table `RideAlerts`
--

CREATE TABLE `RideAlerts` (
  `id` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `from` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `to` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `days` char(20) COLLATE utf16_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `RideRiders`
--

CREATE TABLE `RideRiders` (
  `id` varchar(36) COLLATE utf16_unicode_ci NOT NULL,
  `rideId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `from` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `to` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `riderRating` int(2) DEFAULT NULL,
  `driverRating` int(2) DEFAULT NULL,
  `status` varchar(20) COLLATE utf16_unicode_ci DEFAULT 'pending',
  `riderComment` char(50) COLLATE utf16_unicode_ci DEFAULT 'plan',
  `driverComment` char(50) COLLATE utf16_unicode_ci DEFAULT NULL,
  `distance` float DEFAULT NULL,
  `fare` float DEFAULT NULL,
  `fareAfterCommission` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Rides`
--

CREATE TABLE `Rides` (
  `id` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `regularRideId` char(36) CHARACTER SET utf16 COLLATE utf16_bin DEFAULT NULL,
  `driver` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `groupId` char(36) CHARACTER SET utf16 COLLATE utf16_bin DEFAULT NULL,
  `from` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `to` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `seats` int(2) DEFAULT NULL,
  `status` char(20) COLLATE utf16_unicode_ci DEFAULT NULL,
  `date` varchar(10) COLLATE utf16_unicode_ci NOT NULL,
  `time` time NOT NULL,
  `carId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `dateTime` bigint(14) DEFAULT NULL,
  `distance` float DEFAULT NULL,
  `fare` float DEFAULT NULL,
  `fareAfterCommission` float DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `SequelizeMeta`
--

CREATE TABLE `SequelizeMeta` (
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Settings`
--

CREATE TABLE `Settings` (
  `skey` varchar(40) COLLATE utf16_unicode_ci NOT NULL,
  `value` varchar(60) COLLATE utf16_unicode_ci NOT NULL,
  `isPublic` tinyint(1) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `UserBillingAccounts`
--

CREATE TABLE `UserBillingAccounts` (
  `id` char(36) COLLATE utf16_unicode_ci NOT NULL,
  `userId` char(36) COLLATE utf16_unicode_ci NOT NULL,
  `accountNumber` varchar(50) COLLATE utf16_unicode_ci NOT NULL,
  `accountType` char(15) COLLATE utf16_unicode_ci NOT NULL,
  `transferDetails` text COLLATE utf16_unicode_ci,
  `creationDate` bigint(13) NOT NULL,
  `status` varchar(15) COLLATE utf16_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `UserCardTokens`
--

CREATE TABLE `UserCardTokens` (
  `id` char(36) NOT NULL,
  `userId` char(36) NOT NULL,
  `token` varchar(70) NOT NULL,
  `maskedPan` varchar(25) NOT NULL,
  `cardSubtype` varchar(15) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `UserCars`
--

CREATE TABLE `UserCars` (
  `id` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `maker` char(50) NOT NULL,
  `model` char(50) NOT NULL,
  `colorName` varchar(20) NOT NULL,
  `colorCode` varchar(10) NOT NULL,
  `plateNumber` varchar(15) NOT NULL,
  `status` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16;

-- --------------------------------------------------------

--
-- Table structure for table `UserLogins`
--

CREATE TABLE `UserLogins` (
  `deviceId` char(200) CHARACTER SET utf16 COLLATE utf16_bin DEFAULT NULL,
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin DEFAULT NULL,
  `deviceName` varchar(20) COLLATE utf16_unicode_ci DEFAULT NULL,
  `loginToken` varchar(64) COLLATE utf16_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `UserOrders`
--

CREATE TABLE `UserOrders` (
  `id` char(36) NOT NULL,
  `userId` char(36) NOT NULL,
  `data` text NOT NULL,
  `redirectUrl` text,
  `creationDate` bigint(13) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `Users`
--

CREATE TABLE `Users` (
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `firstName` varchar(50) COLLATE utf16_unicode_ci DEFAULT NULL,
  `lastName` varchar(50) COLLATE utf16_unicode_ci DEFAULT NULL,
  `gender` tinyint(1) DEFAULT NULL,
  `picture` text COLLATE utf16_unicode_ci,
  `cellphone` varchar(20) COLLATE utf16_unicode_ci DEFAULT NULL,
  `ridesWith` int(1) NOT NULL DEFAULT '2',
  `email` varchar(50) COLLATE utf16_unicode_ci DEFAULT NULL,
  `encPassword` varchar(100) COLLATE utf16_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf16_unicode_ci DEFAULT 'pending email verification'
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `UserSocialNetworkAccounts`
--

CREATE TABLE `UserSocialNetworkAccounts` (
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `accountKey` varchar(30) COLLATE utf16_unicode_ci NOT NULL,
  `accountUsername` varchar(50) COLLATE utf16_unicode_ci DEFAULT NULL,
  `accessToken` varchar(200) COLLATE utf16_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `UserTransactions`
--

CREATE TABLE `UserTransactions` (
  `id` char(36) NOT NULL,
  `userId` char(36) NOT NULL,
  `sourceType` varchar(30) NOT NULL,
  `sourceId` text NOT NULL,
  `amount` float NOT NULL,
  `status` varchar(15) NOT NULL,
  `creationDate` bigint(13) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `UserVerificationCo`
--

CREATE TABLE `UserVerificationCo` (
  `userId` char(36) CHARACTER SET utf16 COLLATE utf16_bin NOT NULL,
  `code` varchar(4) COLLATE utf16_unicode_ci NOT NULL,
  `sentTo` varchar(50) COLLATE utf16_unicode_ci NOT NULL,
  `sentAt` varchar(30) COLLATE utf16_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf16 COLLATE=utf16_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `AppFeedback`
--
ALTER TABLE `AppFeedback`
  ADD PRIMARY KEY (`id`,`userId`);

--
-- Indexes for table `Categories`
--
ALTER TABLE `Categories`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `GroupAdmins`
--
ALTER TABLE `GroupAdmins`
  ADD PRIMARY KEY (`groupId`,`userId`);

--
-- Indexes for table `Groups`
--
ALTER TABLE `Groups`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `GroupUsers`
--
ALTER TABLE `GroupUsers`
  ADD PRIMARY KEY (`groupId`,`userId`);

--
-- Indexes for table `Locations`
--
ALTER TABLE `Locations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `Notifications`
--
ALTER TABLE `Notifications`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `PaymentPackages`
--
ALTER TABLE `PaymentPackages`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `RegularRide`
--
ALTER TABLE `RegularRide`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `RideAlerts`
--
ALTER TABLE `RideAlerts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `RideRiders`
--
ALTER TABLE `RideRiders`
  ADD PRIMARY KEY (`rideId`,`userId`);

--
-- Indexes for table `Rides`
--
ALTER TABLE `Rides`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `SequelizeMeta`
--
ALTER TABLE `SequelizeMeta`
  ADD PRIMARY KEY (`name`),
  ADD UNIQUE KEY `name` (`name`),
  ADD UNIQUE KEY `SequelizeMeta_name_unique` (`name`);

--
-- Indexes for table `Settings`
--
ALTER TABLE `Settings`
  ADD PRIMARY KEY (`skey`);

--
-- Indexes for table `UserBillingAccounts`
--
ALTER TABLE `UserBillingAccounts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `UserCardTokens`
--
ALTER TABLE `UserCardTokens`
  ADD PRIMARY KEY (`id`,`token`);

--
-- Indexes for table `UserCars`
--
ALTER TABLE `UserCars`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `UserLogins`
--
ALTER TABLE `UserLogins`
  ADD PRIMARY KEY (`loginToken`);

--
-- Indexes for table `UserOrders`
--
ALTER TABLE `UserOrders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `Users`
--
ALTER TABLE `Users`
  ADD PRIMARY KEY (`userId`);

--
-- Indexes for table `UserSocialNetworkAccounts`
--
ALTER TABLE `UserSocialNetworkAccounts`
  ADD PRIMARY KEY (`userId`);

--
-- Indexes for table `UserTransactions`
--
ALTER TABLE `UserTransactions`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `UserVerificationCo`
--
ALTER TABLE `UserVerificationCo`
  ADD PRIMARY KEY (`userId`,`code`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
