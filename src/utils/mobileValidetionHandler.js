const responseBuilder = require("./responseBuilder");
const {
  apiResponseStatusCode,
  defaultResponseMessage,
  statusCodes,
} = require("./../Message/defaultMessage");

exports.validateMobileNumber = (mobileNumber,res)=> {
  var pattern = /^\d{10}$/;
  //   var phoneno = /^\+?([0-9]{2})\)?[-. ]?([0-9]{4})[-. ]?([0-9]{4})$/;
  if (!pattern.test(mobileNumber)) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "Please Provide Valied Phone Number"
        )
      );
  }
}
