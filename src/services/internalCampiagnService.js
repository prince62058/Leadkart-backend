const internalCampaignModel = require('../models/internalCampiagnModel')

exports.getAllIntenalCampiagnByBusinessId = async (query,skip) => {
    return await internalCampaignModel.find(query).populate('addTypeId','title').select("image title status mainAdId createdAt totalBudget startDate endDate isInstaAdEnabled isFacebookAdEnabled").sort({createdAt:-1}).skip(skip).limit(20).exec();
  }; 
  // .select("image title status")