// middlewares/maintenanceCheck.js
const jwt = require("jsonwebtoken");
const userModel = require("../models/userModel");
const companyModel = require("../models/commpanyModelV2");

module.exports = async function maintenanceCheck(req, res, next) {
  try {
    let decoded = null;

    const token = req.headers.authorization?.split(" ")[1];

    // // If token exists, verify it
    if (token) {
      try {
        decoded = jwt.verify(token, "SECRETEKEY");
      } catch (err) {
        return res.status(401).json({ success: false, message: "Invalid or expired token" });
      }
    }

    // If user is ADMIN or SUBADMIN, skip maintenance check
    if (decoded && (decoded.userType === "ADMIN" || decoded.userType === "SUBADMIN")) {
      return next();
    }

    // Fetch company maintenance flag
    const company = await companyModel.findOne().lean();
    if (company?.isUnderMaintenance) {
      return res.status(503).json({
        success: false,
        message: "Application is under maintenance. Please try again later.",
      });
    }

    // Continue request
    next();
  } catch (error) {
    console.error("Maintenance Check Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
