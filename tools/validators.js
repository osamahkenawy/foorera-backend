const formatEgyptianMobileNumber = (mobileNumber) => {
  if (mobileNumber.startsWith('2')) {
    mobileNumber = mobileNumber.replace('2', '');
  }
  if (mobileNumber.startsWith('+2')) {
    mobileNumber = mobileNumber.replace('+2', '');
  }
  if (mobileNumber.startsWith('002')) {
    mobileNumber = mobileNumber.replace('002', '');
  }
  mobileNumber = mobileNumber.replace(/\s/g, '');

  return mobileNumber;
};

const validateEgyptianMobileNumber = (mobileNumber) => {
  const regex = /^01[0-2|5]{1}[0-9]{8}$/;
  return regex.test(mobileNumber);
};

module.exports = {
  formatEgyptianMobileNumber, validateEgyptianMobileNumber,
};
