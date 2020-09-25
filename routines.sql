DELIMITER $$
CREATE DEFINER=`root`@`localhost` FUNCTION `dist`(`lat1` FLOAT, `lng1` FLOAT, `lat2` FLOAT, `lng2` FLOAT) RETURNS float
BEGIN
  DECLARE res Float;
  SET res = 6371 * acos( cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1)) + sin(radians(lat1)) * sin(radians(lat2)) );
  RETURN res;
END$$
DELIMITER ;
