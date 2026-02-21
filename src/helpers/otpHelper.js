const otpGenerator = require("otp-generator");
const {
  statusCodes,
  apiResponseStatusCode,
  defaultResponseMessage,
} = require("../Message/defaultMessage");
const responseBuilder = require("../utils/responseBuilder");

function otp() {
  let otpGe = Number(
    otpGenerator.generate(4, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
    })
  );
  if (!otpGe) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "Failed to generate OTP")
      );
  }
  return otpGe
}

module.exports = otp;
