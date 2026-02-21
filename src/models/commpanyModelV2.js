const mongoose = require("mongoose");

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
  },
  address: {
    type: String,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    trim: true,
  },
  serviceFee: {
    type: Number,
  },
  paymentGetWayFee: {
    type: Number,
  },
  gstFee:{
    type: Number,
  },
  website: {
    type: String,
    trim: true,
  },
  favicon: {
    type: String,
    trim: true,
  },
  logo: {
    type: String,
    trim: true,
  },
  returnPolicy: {
    type: String,
    trim: true,
  },
  termsAndConditions: {
    type: String,
    trim: true,
  },
  privacyPolicy: {
    type: String,
    trim: true,
  },
	 isUnderMaintenance: { type: Boolean, default: false },
});

const Company = mongoose.model("Company", companySchema);

module.exports = Company;
