const mongoose = require("mongoose");

const business = new mongoose.Schema({
  businessName: { type: String, default: null, trim: true },
  businessImage: { type: String, default: null, trim: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "userModel",
    default: null,
    trim: true,
  },
	  businessEmail: { type: String, default: 'default@gmail.com', trim: true },

  businessCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "businessCategory",
    default: null,
    trim: true,
  },
  servicesId: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "businessCategory",
      default: null,
      trim: true,
    },
  ],
  businessContact: { type: Number, default: null, trim: true },
  whatsappNumber: { type: Number, default: null, trim: true },
  stateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "statemodel",
    default: null,
    trim: true,
  },
  cityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "citymodel",
    default: null,
    trim: true,
  },
  countryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "countrymodel",
    default: null,
    trim: true,
  },
  websiteLink: { type: String, default: null, trim: true },
  instagramLink: { type: String, default: null, trim: true },
  twitterLink: { type: String, default: null, trim: true },
  youtubeLink: { type: String, default: null, trim: true },
  facebookLink: { type: String, default: null, trim: true },
  address: { type: String, default: null, trim: true },
  tagline: { type: String, default: null, trim: true },
  disable: {
    type: Boolean,
    default: false,
  },
  metaAccessToken: { type: String, default: null },
  pageAccessToken: { type: String, default: null },
  isPageSubscribe: { type: Boolean, default: false },
  isFacebookPageLinked: {
    type: Boolean,
    default: false,
  },
  pageId: { type: String, default: null },
  isInstagramAccountAssociates :Boolean,
  metaManagerId:String,
  isBmAccessProvidedToAdminBm:{
    type:Boolean,
    default:false,
  },
  pageName:{
    type:String,
    default:null,
  },
  assignedStaff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'staff',
    default: null
  },
  isAssigned: {
    type: Boolean,
    default: false
  }
},
{timestamps:true});

module.exports = mongoose.model("business", business);
