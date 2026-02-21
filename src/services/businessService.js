const businessModel = require("../models/businessModel");

exports.createBusiness = async (data) => {
  return await businessModel.create(data);
};


exports.getAllBusiness = async (query, skip) => {
  return await businessModel
    .find(query).populate("businessCategoryId").populate("servicesId").populate("userId", "name profileImage phoneNumber").populate("stateId").populate("cityId")
    .skip(skip)
    .sort({ createdAt: -1 })
    .limit(20)
    .exec();
};

exports.updateBusiness = async (id, data) => {
  return await businessModel.findByIdAndUpdate(id, data, { new: true }).exec();
};

exports.disableBusiness = async (getBusinessById) => {
  return await businessModel
    .findByIdAndUpdate(
      getBusinessById?._id,
      { disable: !getBusinessById.disable },
      { new: true }
    )
    .exec();
};

exports.getAllBusinessByUserId = async (query) => {
  return await businessModel.find({ userId: query?._id }).populate("businessCategoryId userId servicesId stateId cityId").exec();
};

exports.getAllBusinessListForAdmin = async (query, skip, sort) => {
  return await businessModel
    .find(query)
    .select(
      "businessName businessImage businessCategoryId isFacebookPageLinked pageId cityId"
    )
    .skip(skip)
    .sort(sort)
    .limit(20)
    .exec();
};

exports.getBusinessByIdForAdmin = async(businessId)=>{
  
  return await businessModel.findById(businessId).populate("businessCategoryId").exec();
}


