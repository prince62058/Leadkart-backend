const Company = require("../models/commpanyModelV2");
const {deleteFileFromObjectStorage} = require("../middlewares/multer");

// Get company details
exports.getCompany = async (req, res) => {
  try {
    const company = await Company.findOne();
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    res.status(200).json({ success: true, data: company });
  } catch (error) {
    res.status(500).json({success: false, message: error.message });
  }
};

// Update company details
exports.updateCompany = async (req, res) => {
  const updates = {
    name: req.body.name,
    address: req.body.address,
    phone: req.body.phone,
    email: req.body.email,
    website: req.body.website,
    returnPolicy: req.body.returnPolicy,
    termsAndConditions: req.body.termsAndConditions,
    privacyPolicy: req.body.privacyPolicy,
    paymentGetWayFee: req.body.paymentGetWayFee,
    serviceFee: req.body.serviceFee,
    gstFee: req.body.gstFee,
  };
  if (req.files) {
    if (req.files.logo) {
      updates.logo = req.files.logo[0].location;
    }
    if (req.files.favicon) {
      updates.favicon = req.files.favicon[0].location;
    }
  }

  try {
    const company = await Company.findOne();
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Delete old files from object storage if new files are uploaded
    if (req.files) {
      if (req.files.logo && company.logo) {
        await deleteFileFromObjectStorage(company?.logo);
      }
      if (req.files.favicon && company.favicon) {
        await deleteFileFromObjectStorage(company?.favicon);
      }
    }

    await Company.findOneAndUpdate({}, updates, { new: true });
    res.status(200).json({
      success: true,
      message: "Company details updated successfully",
    });
  } catch (error) {
    res.status(500).json({ success: false,message: error.message });
  }
};


exports.toggleMaintenance = async (req, res) => {
  try {
    const company = await Company.findOne();
    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    company.isUnderMaintenance = !company?.isUnderMaintenance;
    await company.save();

    res.json({
      success: true,
      message: `Maintenance mode ${company?.isUnderMaintenance ? "enabled" : "disabled"} successfully`,
      isUnderMaintenance: company?.isUnderMaintenance
    });
  } catch (err) {
    console.error("Toggle Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};