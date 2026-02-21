const userService = require("../services/userService");
const businessModel = require("../models/businessModel");
const CryptoJS = require("crypto-js");
const jwt = require("jsonwebtoken");
const { deleteFileFromObjectStorage } = require("../middlewares/multer");
const { sendOtp, sendOtpInMail } = require("../helpers/sendOtpHelper");
const otp = require("../helpers/otpHelper");
const {
  statusCodes,
  apiResponseStatusCode,
  defaultResponseMessage,
} = require("../Message/defaultMessage");
const responseBuilder = require("../utils/responseBuilder");
const { validateMobileNumber } = require("../utils/mobileValidetionHandler");
const { validateEmail } = require("../utils/emailValidetionHandler");
const staffModel = require("../models/staffModel")
const userModel = require("../models/userModel");
const { checkPermissions } = require("../helpers/checkPermission");
const permissionModel = require("../models/permissionModel");
const internalCampiagnModel = require("../models/internalCampiagnModel");
// Mobile login
const isUserInBusiness = async (userId) => {
  try {
    const business = await businessModel.findOne({ userId: userId });
    return business ? true : false;
  } catch (error) {
    return false;
  }
};

exports.mobileLogIn = async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "mobile is required"));
  }

  validateMobileNumber(mobile, res);

  let Otp = mobile && mobile == 8986576764 ? 1234 : otp();
  //let Otp = "1234";

  const cyperOtp = CryptoJS.AES.encrypt(Otp.toString(), "CRYPTOKEY").toString();

  let user = await userService.finOne(
    { mobile: mobile },
    { otp: cyperOtp, otp2: Otp }
  );

  if (user?.disable) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "Ban Your Acount"));
  }

  if (!user) {
    user = await userService.mobileLogIn({
      mobile: mobile,
      otp: cyperOtp,
      otp2: Otp,
    });
  }
  let data = sendOtp(mobile, Otp);
  if (data == false) {
    return res.status(400).send({
      succes: false,
      message: "OTP limit exceeded for this mobile number. Try again later.",
    });
  }

  return res
    .status(statusCodes.Created)
    .json(
      responseBuilder(
        apiResponseStatusCode[201],
        defaultResponseMessage.CREATED,
        Otp
      )
    );
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  const { mobile, otp, fcm } = req.body;
  if (!mobile) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "mobile is required"));
  }
  validateMobileNumber(mobile, res);
  if (!otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "otp is required"));
  }
  let user = await userService.finOne({ mobile: mobile });
  if (!user) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "Register You Mobile Number"
        )
      );
  }

  let bytes = CryptoJS.AES.decrypt(user.otp.toString(), "CRYPTOKEY");

  let originalText = bytes.toString(CryptoJS.enc.Utf8);

  if (originalText != otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "Please provide valid OTP")
      );
  }

  user = await userService.finOne(
    { mobile: mobile },
    { phoneVerified: true, fcm: fcm }
  );

  const token = jwt.sign({ User: user._id }, "SECRETEKEY", { expiresIn: "365d" });
  let Check = await isUserInBusiness(user._id);

  user._doc.token = token;
  user._doc.isUserBusinessExist = Check;
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(apiResponseStatusCode[200], "register successfully", user)
    );
};

exports.updateProfile = async (req, res) => {
  const { name, email } = req.body;
  let image = req.file ? req.file.location : req.user?.image;
  // console.log(req.file)
  if (req.file && req.user?.image != null) {
    deleteFileFromObjectStorage(req.user.image);
  }
  let userFind = await userService.updateUser(req.user?._id, {
    name: name,
    email: email,
    image: image,
  });
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage.UPDATED,
        userFind
      )
    );
};

exports.disableUser = async (req, res) => {
  const user = req.user;
  const updateDisable = await userService.disableUser(user);
  let message = updateDisable.disable
    ? defaultResponseMessage?.DISABLED
    : defaultResponseMessage?.ENABLED;

  return res
    .status(statusCodes.OK)
    .json(responseBuilder(apiResponseStatusCode[200], message));
};

exports.getByIdUser = async (req, res) => {
  try {
    // Validate user exists
    if (!req?.user?._id) {
      return res.status(statusCodes.BAD_REQUEST).json(
        responseBuilder(
          apiResponseStatusCode[400],
          "User information missing"
        )
      );
    }

    // Get user with proper population
    const user = await userModel.findById(req.user._id)
      .populate({
        path: 'userId',
        select: 'wallet' // Only populate necessary fields
      })
      .lean(); // Convert to plain JS object for modification

    if (!user) {
      return res.status(statusCodes.NOT_FOUND).json(
        responseBuilder(
          apiResponseStatusCode[404],
          "User not found"
        )
      );
    }

    // Check business status
    const isBusinessUser = await isUserInBusiness(req.user._id);
    user.isUserBusinessExist = isBusinessUser;

    // Determine correct user ID for business lookup
    const userId = req.user.userType === "SUBUSER" 
      ? req.user.userId 
      : req.user._id;

    // Get business and campaigns in parallel
    const [business, campaigns] = await Promise.all([
      businessModel.findOne({ userId }).select('_id').lean(),
      internalCampiagnModel.find({
        businessId: (await businessModel.findOne({ userId }))?._id,
      }).select("spendAmount").lean()
    ]);



    // Prepare response data
    const responseData = {
      ...user,
      totalSpend: campaigns[0]?.spendAmount,
      businessId: business?._id || null
    };
    return res.status(statusCodes.OK).json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage?.FETCHED || "User data fetched successfully",
        responseData // Use the modified user object
      )
    );

  } catch (error) {
    console.error('Error in getByIdUser:', error);
    return res.status(statusCodes.INTERNAL_SERVER_ERROR).json(
      responseBuilder(
        apiResponseStatusCode[500],
        error.message || "Internal server error"
      )
    );
  }
};
// Controller code
exports.getAllUser = async (req, res) => {
  try {
    let { page = 1, search, userType, disable } = req.query;
    const skip = (page - 1) * 20;

    let obj = {};

    // Filter by userType
    if (userType) {
      obj.userType = userType;
    }

    // Filter by disable
    if (disable) {
      obj.disable = disable;
    }

    // Smart search: number => search by mobile, else => name/email
    if (search) {
      const trimmedSearch = search.trim();
      const isNumber = /^[0-9]+$/.test(trimmedSearch);

      if (isNumber) {
        // Convert to Number for exact match
        obj.mobile = Number(trimmedSearch);
      } else {
        const regex = new RegExp(trimmedSearch, "i");
        obj.$or = [{ name: { $regex: regex } }, { email: { $regex: regex } }];
      }
    }

    // Get users and pagination info
    const findUser = await userService.getAllUsers(obj, skip);
    const totalCount = await userModel.countDocuments(obj);
    const pageCount = Math.ceil(totalCount / 20);


    return res
      .status(statusCodes.OK)
      .json(
        responseBuilder(
          apiResponseStatusCode[200],
          defaultResponseMessage?.FETCHED,
          findUser,
          pageCount
        )
      );
  } catch (error) {
    return res
      .status(500)
      .json(
        responseBuilder(
          apiResponseStatusCode[500],
          "Something went wrong",
          error.message
        )
      );
  }
};

exports.permissionListApi = async (req, res) => {
  const token = req.headers["authorization"];
  let requestedPermissions = [
    { "Roles&Permission": ["read"] },
    // { "Leads": [ "write"] },
    // { "Ads": ["read"] }
  ];
  // let checkPermission =   await checkPermissions(requestedPermissions,token)
  // if(!checkPermission){
  //   return res
  //   .status(400)
  //   .send({ success: false, message: "Access denied"});
  // }
  permissions = [
    { "Roles&Permission": ["read", "write"] },
    { Leads: ["read", "write"] },
    { Ads: ["read", "write"] },
  ];

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        "Permissions Fatch Successfully",
        permissions
      )
    );
};

exports.permissionListApiForBusiness = async (req, res) => {
  const token = req.headers["authorization"];
  // let requestedPermissions = [
  //   { "Roles&Permission": ["read"] },
  //   // { "Leads": [ "write"] },
  //   // { "Ads": ["read"] }
  // ];
  // let checkPermission =   await checkPermissions(requestedPermissions,token)
  // if(!checkPermission){
  //   return res
  //   .status(400)
  //   .send({ success: false, message: "Access denied"});
  // }
  permissions = [
    { business: ["MODERATOR", "FULL_CONTROL"] },
    { leads: ["MODERATOR", "FULL_CONTROL"] },
    { ads: ["READ_INSIGHTS", "MODERATOR"] },
  ];

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        "Business Permissions Fetch Successfully",
        permissions
      )
    );
};

exports.sendOtpForEmail = async (req, res) => {
  const { email } = req.body;
  const token = req.headers["authorization"];
  let requestedPermissions = [
    { "Roles&Permission": ["write"] },
    // { "Leads": [ "write"] },
    // { "Ads": ["read"] }
  ];
  // let checkPermission =   await checkPermissions(requestedPermissions,token)
  // if(!checkPermission){
  //   return res
  //   .status(400)
  //   .send({ success: false, message: "Access denied"});
  // }
  if (!email) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "email is required"));
  }

  validateEmail(email, res);

  let Otp = 1234;
  sendOtpInMail(email, Otp);
  // let Otp = otp();
  const cyperOtp = CryptoJS.AES.encrypt(Otp.toString(), "CRYPTOKEY").toString();

  let user = await userService.finOne({ email: email }, { otp: cyperOtp });
  if (user) {
    return res
      .status(statusCodes.OK)
      .json(
        responseBuilder(
          apiResponseStatusCode[200],
          "Otp Send Successfully",
          Otp
        )
      );
  }

  user = await userService.mobileLogIn({ email: email, otp: cyperOtp });

  sendOtp(email, Otp);

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(apiResponseStatusCode[200], "Otp Send Successfully", Otp)
    );
};

// Verify OTP
exports.verifyEmailOtp = async (req, res) => {
  const { email, otp, businessId } = req.body;
  const token = req.headers["authorization"];
  let requestedPermissions = [
    { "Roles&Permission": ["write"] },
    // { "Leads": [ "write"] },
    // { "Ads": ["read"] }
  ];
  // let checkPermission =   await checkPermissions(requestedPermissions,token)
  // if(!checkPermission){
  //   return res
  //   .status(400)
  //   .send({ success: false, message: "Access denied"});
  // }
  if (!email) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "email is required"));
  }
  validateEmail(email, res);
  if (!otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "otp is required"));
  }
  let user = await userService.checkData({ email: email });
  if (!user) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "Register You Email"));
  }

  let bytes = CryptoJS.AES.decrypt(user.otp.toString(), "CRYPTOKEY");

  let originalText = bytes.toString(CryptoJS.enc.Utf8);

  if ("1234" != otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "Please provide valid OTP")
      );
  }

  user = await userService.finOne(
    { email: email },
    { emailVerified: true, userType: "SUBUSER", businessId: businessId }
  );

  const generate = await jwt.sign({ User: user._id }, "SECRETEKEY", {
    expiresIn: "60d",
  });

  user._doc.token = generate;

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        "Otp Verify Successfully",
        user
      )
    );
};

exports.CreateSubUser = async (req, res) => {
  const { name, password, roleId, businessId, memberToken, userId } = req.body;
  const token = req.headers["authorization"];
  let requestedPermissions = [
    { "Roles&Permission": ["write"] },
    // { "Leads": [ "write"] },
    // { "Ads": ["read"] }
  ];
  let checkPermission = await checkPermissions(requestedPermissions, token);
  // if(!checkPermission){
  //   return res
  //   .status(400)
  //   .send({ success: false, message: "Access denied"});
  // }
  const SECRET_KEY = process.env.JWT_SECRET || "SECRETEKEY";
  // const token = req.headers["authorization"];
  let check = jwt.verify(memberToken, SECRET_KEY);
  const cyperOtp = CryptoJS.AES.encrypt(
    password.toString(),
    "CRYPTOKEY"
  ).toString();
  let data = await userService.checkData({ _id: check ? check?.User : userId });
  let image = req.file ? req.file.location : data.image;
  if (req.file && data?.image != null) {
    deleteFileFromObjectStorage(data.image);
  }
  user = await userService.finOne(
    { _id: check.User },
    {
      name: name,
      password: cyperOtp,
      roleId: roleId,
      businessId: businessId,
      image: image,
    }
  );
  user._doc.token = token;

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        "Sub User From Completed",
        user
      )
    );
};

exports.getAllSubUser = async (req, res) => {
  const { page = 1, businessId } = req.query;
  const token = req.headers["authorization"];
  let requestedPermissions = [
    { "Roles&Permission": ["read"] },
    // { "Leads": [ "write"] },
    // { "Ads": ["read"] }
  ];

  // if(!checkPermission){
  //   return res
  //   .status(400)
  //   .send({ success: false, message: "Access denied"});
  // }
  const skip = (page - 1) * 20;
  let obj = {};
  if (businessId) {
    obj.businessId = businessId;
  }
  obj.userType = "SUBUSER";
  const findUser = await userService.getAllUsers(obj, skip);

  const totalCount = await userModel.countDocuments(obj);
  const pageCount = Math.ceil(totalCount / 20);

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage?.FETCHED,
        findUser,
        pageCount
      )
    );
};

exports.getAllSubUserByBusinessId = async (req, res) => {
  const { businessId, page = 1 } = req.query;
  const skip = (page - 1) * 20;
  let businessData = await businessModel.findById(businessId);
  let data = await permissionModel
    .find({ businessId: businessId, userId: { $ne: businessData.userId } })
    .populate("userId", "name image mobile")
    .skip(skip)
    .limit(20);
  const totalCount = await permissionModel.countDocuments({
    businessId: businessId,
    userId: { $ne: businessData.userId },
  });
  const pageCount = Math.ceil(totalCount / 20);
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage?.FETCHED,
        data,
        pageCount
      )
    );
};

exports.LogIn = async (req, res) => {
  const { email, password } = req.body;

  if (!email) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "email is required"));
  }

  validateEmail(email, res);

  let user = await userService.checkData({ email: email });

  if (!user) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "Please Provide Valied Email And Password"
        )
      );
  }

  let bytes = CryptoJS.AES.decrypt(user.password.toString(), "CRYPTOKEY");

  let originalText = bytes.toString(CryptoJS.enc.Utf8);

  if (originalText != password.toString()) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "Please Provide Valied Email And Password"
        )
      );
  }
  const generate = await jwt.sign({ User: user._id }, "SECRETEKEY", {
    expiresIn: "365d",
  });

  user._doc.token = generate;
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(apiResponseStatusCode[200], "LogIn Successfully", user)
    );
};

//  admin Login

exports.adminLogIn = async (req, res) => {
  const { email, password, fcm } = req.body;

  if (!email) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "email is required"));
  }
  validateEmail(email, res);
  if (!password) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "password is required")
      );
  }

  let user = await userService.checkData({ email: email });
  if (!user) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "Please Provide Valied Admin Email"
        )
      );
  }
  if (user?.userType != "ADMIN") {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "You Are Not Valied Admin")
      );
  }
  let bytes = CryptoJS.AES.decrypt(user.password.toString(), "CRYPTOKEY");
  let originalText = bytes.toString(CryptoJS.enc.Utf8);
  if (originalText != password?.toString()) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "Please Provide Valied Email And Password"
        )
      );
  }
  if (user?.role == 2) {
    // let Otp = otp();
    let Otp = 1234;
    sendOtpInMail(email, Otp);
    const cyperOtp = CryptoJS.AES.encrypt(
      Otp.toString(),
      "CRYPTOKEY"
    ).toString();
    // let adminFcm = user?.adminFcm.push(fcm)
    // await userService.finOne({ email: email }, { otp: cyperOtp, adminFcm: adminFcm });
        
    await userModel.updateOne(
      { email },
      { 
        otp: cyperOtp,
        $addToSet: { adminFcm: fcm } // Use $addToSet to avoid duplicate FCM tokens
      });
    return res
      .status(statusCodes.Created)
      .json(
        responseBuilder(
          apiResponseStatusCode[200],
          "otp send successfully",
          true
        )
      );
  } else {
    const generate = await jwt.sign({ User: user._id, userType: "ADMIN" }, "SECRETEKEY", {
      expiresIn: "30d",
    });
    let permission = await staffModel.findOne({userId:user?._id})
    user._doc.token = generate;
    user._doc.permission = permission?.permissions;
    user._doc.staffId = permission?._id;
    return res
      .status(statusCodes.OK)
      .json(
        responseBuilder(apiResponseStatusCode[200], "LogIn Successfully", user)
      );
  }
};
// Verify Admin OTP
exports.verifyAdminEmailOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "email is required"));
  }
  validateEmail(email, res);
  if (!otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "otp is required"));
  }
  let user = await userService.checkData({ email: email });
  if (!user) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "Register You Email"));
  }

  let bytes = CryptoJS.AES.decrypt(user.otp.toString(), "CRYPTOKEY");

  let originalText = bytes.toString(CryptoJS.enc.Utf8);

  if ("1234" != otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "Please provide valid OTP")
      );
  }

  // user = await userService.finOne(
  //   { email: email },
  //   { emailVerified: true, userType: "SUBUSER", businessId: businessId }
  // );

  const generate = await jwt.sign({ User: user._id }, "SECRETEKEY", {
    expiresIn: "30d",
  });

  user._doc.token = generate;
  user._doc.permission = ["ALL"];
  user._doc.staffId = "";
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(apiResponseStatusCode[200], "LogIn Successfully", user)
    );
};

// Admin Sub Admin Create

exports.CreateAdminSubAdmin = async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!email) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "email is required"));
  }
  validateEmail(email, res);
  if (!password) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "password is required")
      );
  }
  let user = await userService.checkData({ email: email });
  if (user) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "Please Provide Another Email Id"
        )
      );
  }
  const cyperOtp = CryptoJS.AES.encrypt(
    password.toString(),
    "CRYPTOKEY"
  ).toString();
  console.log("email", email);
  user = await userModel.create({
    name: name,
    email: email,
    userType: "ADMIN",
    password: cyperOtp,
    role: role ? role : 0,
  });
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[201],
        "Admin And Sub Admin Create Successfully",
        user
      )
    );
};

exports.sendOtpForMobileV2 = async (req, res) => {
  const { mobile } = req.body;
  if (!mobile) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "mobile is required"));
  }

  validateMobileNumber(mobile, res);

  let Otp = 1234;
  let data = sendOtp(mobile, Otp);
  if (data == false) {
    return res.status(400).send({
      succes: false,
      message: "OTP limit exceeded for this mobile number. Try again later.",
    });
  }
  // let Otp = otp();
  const cyperOtp = CryptoJS.AES.encrypt(Otp.toString(), "CRYPTOKEY").toString();

  let user = await userService.finOne({ mobile: mobile }, { otp: cyperOtp });

  if (user) {
    return res
      .status(statusCodes.OK)
      .json(
        responseBuilder(
          apiResponseStatusCode[200],
          "Otp Send Successfully",
          Otp
        )
      );
  }

  user = await userService.mobileLogIn({ mobile: mobile, otp: cyperOtp });

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(apiResponseStatusCode[200], "Otp Send Successfully", Otp)
    );
};

// Verify OTP
exports.verifyMobileOtpV2 = async (req, res) => {
  const { mobile, otp } = req.body;

  if (!mobile) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "mobile is required"));
  }

  if (!otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "otp is required"));
  }
  let user = await userService.checkData({ mobile: mobile });
  if (!user) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "Register You Mobile Number"
        )
      );
  }

  let bytes = CryptoJS.AES.decrypt(user.otp.toString(), "CRYPTOKEY");

  let originalText = bytes.toString(CryptoJS.enc.Utf8);

  if (originalText != otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "Please provide valid OTP")
      );
  }

  user = await userService.finOne(
    { mobile: mobile },
    { phoneVerified: true, userType: "SUBUSER" }
  );

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        "Otp Verify Successfully",
        user
      )
    );
};

exports.CreateSubUserV2 = async (req, res) => {
  const { name, mobile, roleId, businessId, userId, email, permisstion } =
    req.body;
  const token = req.headers["authorization"];

  if (!mobile) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "mobile is required"));
  }
  let data = await userService.checkData({ mobile: mobile });
  let image = req.file ? req.file.location : data.image;
  if (req.file && data?.image != null) {
    deleteFileFromObjectStorage(data.image);
  }
  user = await userService.finOne(
    { mobile: mobile },
    {
      name: name,
      email: email,
      userRole: roleId,
      businessId: businessId,
      image: image,
      userId: userId,
      permisstion: permisstion,
    }
  );
  user._doc.token = token;

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        "Sub User From Completed",
        user
      )
    );
};

// Mobile login

exports.mobileLogInV2 = async (req, res) => {
  const { mobile } = req.body;

  if (!mobile) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "mobile is required"));
  }

  validateMobileNumber(mobile, res);

  let Otp = 1234;

  const cyperOtp = CryptoJS.AES.encrypt(Otp.toString(), "CRYPTOKEY").toString();

  let user = await userService.finOne({ mobile: mobile }, { otp: cyperOtp });

  if (user?.disable) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "Ban Your Acount"));
  }

  if (!user) {
    user = await userService.mobileLogIn({ mobile: mobile, otp: cyperOtp });
  }

  let data = sendOtp(mobile, Otp);
  if (data == false) {
    return res.status(400).send({
      succes: false,
      message: "OTP limit exceeded for this mobile number. Try again later.",
    });
  }

  return res
    .status(statusCodes.Created)
    .json(
      responseBuilder(
        apiResponseStatusCode[201],
        defaultResponseMessage.CREATED,
        Otp
      )
    );
};

// Verify OTP
exports.verifyOtpV2 = async (req, res) => {
  const { mobile, otp } = req.body;
  if (!mobile) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "mobile is required"));
  }
  validateMobileNumber(mobile, res);
  if (!otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "otp is required"));
  }
  let user = await userService.finOne({ mobile: mobile });
  if (!user) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "Register You Mobile Number"
        )
      );
  }

  let bytes = CryptoJS.AES.decrypt(user.otp.toString(), "CRYPTOKEY");

  let originalText = bytes.toString(CryptoJS.enc.Utf8);

  if (originalText != otp) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "Please provide valid OTP")
      );
  }

  user = await userService.finOne({ mobile: mobile }, { phoneVerified: true });

  const generate = await jwt.sign({ User: user._id }, "SECRETEKEY", {
    expiresIn: "60d",
  });

  user._doc.token = generate;

  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(apiResponseStatusCode[200], "register successfully", user)
    );
};

exports.getByIdUserForAdmin = async (req, res) => {
  try {
    const userId = req?.user?._id;
    const search = req?.query?.search?.trim();

    if (!userId) {
      return res.status(400).json(responseBuilder(
        apiResponseStatusCode[400],
        "User ID not found in request"
      ));
    }

    const isBusinessExist = await isUserInBusiness(userId);

    // Clone user object safely
    let userDoc = { ...req.user._doc };

    // Get staff permissions if user is staff
    const staffData = await staffModel.findOne({ userId: userId });
    
    userDoc.permission = staffData?.permissions || [];
    userDoc.staffId = staffData?._id || null;

    // ------------------ Business Filter ------------------
    let businessFilter = { userId };

    if (search) {
      const regex = new RegExp(search, "i");
      const isNumber = /^[0-9]+$/.test(search);

      businessFilter.$or = [
        { businessName: { $regex: regex } },
        { businessEmail: { $regex: regex } }
      ];

      if (isNumber) {
        businessFilter.$or.push({ businessContact: Number(search) });
      }
    }

    // ------------------ Fetch Business Data ------------------
    userDoc.isUserBusinessExist = isBusinessExist;

    const [businesses, totalBusiness, liveBusiness, unlinkBusiness] = await Promise.all([
      businessModel.find(businessFilter).populate("businessCategoryId cityId stateId userId"),
      businessModel.countDocuments(businessFilter),
      businessModel.countDocuments({ ...businessFilter, isBmAccessProvidedToAdminBm: true }),
      businessModel.countDocuments({ ...businessFilter, isBmAccessProvidedToAdminBm: false }),
    ]);

    userDoc.business = businesses;
    userDoc.totalBusiness = totalBusiness;
    userDoc.liveBusiness = liveBusiness;
    userDoc.unlinkBusiness = unlinkBusiness;

    // ------------------ Final Response ------------------
    return res.status(statusCodes.OK).json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage?.FETCHED,
        userDoc
      )
    );

  } catch (error) {
    console.error("Error in getByIdUserForAdmin:", error);
    return res.status(500).json(responseBuilder(
      apiResponseStatusCode[500],
      defaultResponseMessage?.ERROR,
      error.message
    ));
  }
};



const XLSX = require("xlsx");
const stream = require("stream");
const { s3Client } = require("../middlewares/multer");
// const userModel = require("../models/userModel");
// const businessModel = require("../models/businessModel");

exports.getAllUsersWithBusiness = async (req, res) => {
  try {
    const users = await userModel.find({ userType: "USER" }).select("name mobile email");

    const usersWithBusiness = await Promise.all(
      users.map(async (user) => {
        const businesses = await businessModel
          .find({ userId: user?._id })
          .select("businessName businessEmail businessContact cityId stateId")
          .populate([
            { path: "cityId", select: "cityName" },
            { path: "stateId", select: "stateName" }
          ]);

        return {
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          businesses: businesses.map((b) => ({
            businessName: b.businessName,
            businessEmail: b.businessEmail,
            businessContact: b.businessContact,
            city: b.cityId?.cityName || '',
            state: b.stateId?.stateName || ''
          }))
        };
      })
    );

    if (!usersWithBusiness.length) {
      return res.status(404).json({ success: false, message: "No users found" });
    }

    const flatData = [];
    usersWithBusiness.forEach(user => {
      user.businesses.forEach(business => {
        flatData.push({
          userName: user.name,
          userMobile: user.mobile,
          userEmail: user.email,
          ...business
        });
      });
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(flatData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "UsersWithBusiness");

    // Write buffer for Excel
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const csvData = XLSX.utils.sheet_to_csv(worksheet);

    const timestamp = Date.now();
    const excelKey = `exports/users_with_business_${timestamp}.xlsx`;
    const csvKey = `exports/users_with_business_${timestamp}.csv`;

    const bucket = process.env.LINODE_BUCKET_NAME || 'leadkart';

    // Upload Excel to Linode S3
    const excelUpload = s3Client.upload({
      Bucket: bucket,
      Key: excelKey,
      Body: excelBuffer,
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ACL: "public-read"
    }).promise();

    // Upload CSV to Linode S3
    const csvStream = new stream.PassThrough();
    csvStream.end(Buffer.from(csvData));

    const csvUpload = s3Client.upload({
      Bucket: bucket,
      Key: csvKey,
      Body: csvStream,
      ContentType: "text/csv",
      ACL: "public-read"
    }).promise();

    const [excelResult, csvResult] = await Promise.all([excelUpload, csvUpload]);

    return res.status(200).json({
      success: true,
      message: "Files uploaded to S3 successfully",
      excelDownloadUrl: excelResult.Location,
      csvDownloadUrl: csvResult.Location
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
      error: error.message
    });
  }
};


