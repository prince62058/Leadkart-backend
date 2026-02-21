const userModel = require("../models/userModel");
const internalCampiagnModel = require("../models/internalCampiagnModel");
const businessModel = require("../models/businessModel");
const leadModel = require("../models/leadModel");
const AdErrorLog = require("../models/AdErrorLog");

const transtionModel = require("../models/transtionModel");
const crypto = require("crypto");
const axios = require("axios");

// Replace these variables with your actual access token and app secret
// const accessToke =
//   "EAAWTFXvGZBMoBO0GRnCi9pTqoopZCdDUQkmDxJYdL5HWblFwqdmGKXYLI4wcWDl5bbksl7AI8the5xms95TlzqliBr0obDskFhsZCChfq6kuiB4XzvT4ZCkgo7HqFm0HebdiiOutYVwItB1SToLe6zLgVZA2VB7SSeqjUhLRQvUx30Ak8XZCrcEwlkntpk4IFiO4h6hMhX";
// const appSecre = "0dd5ddd645af8441f5bc2aeca97d8997";

// Create the appsecret_proof
exports.permanentToken = (req, res) => {
  try {
    const { accessToken, appSecret } = req.query;
    const appsecretProof = crypto
      .createHmac("sha256", appSecret)
      .update(accessToken)
      .digest("hex");

    // console.log("appsecret_proof:", appsecretProof);
    return res.status(200).send({
      success: true,
      message: "generate token successfully",
      data: appsecretProof,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

exports.DashBoardApiAdmin = async (req, res) => {
  try {
    let userCount = await userModel.countDocuments();
    let adsCount = await internalCampiagnModel.countDocuments();

    // Statuses as per your list
    const statuses = [
      "ACTIVE",
      "PAUSED",
      "DELETED",
      "ARCHIVED",
      "IN_REVIEW",
      "IN_PROGRESS",
      "COMPLETED",
      "SCHEDULED",
    ];

    // Count ads for each status
    let statusWiseAds = {};
    for (const status of statuses) {
      statusWiseAds[status] = await internalCampiagnModel.countDocuments({ status });
    }
    statusWiseAds["TOTAL"] = adsCount;

    // Ads Type wise status count
    // Get all ad types
    const adTypes = await internalCampiagnModel.aggregate([
      { $group: { _id: "$addTypeId" } }
    ]);
    // Get ad type titles
    const adTypeIds = adTypes.map(t => t._id).filter(Boolean);
    const adTypeTitles = {};
    if (adTypeIds.length) {
      const addTypeDocs = await require("../models/advertisementModel").find({ _id: { $in: adTypeIds } }).select("title");
      addTypeDocs.forEach(doc => {
        adTypeTitles[doc._id.toString()] = doc.title;
      });
    }
    // For each ad type, count by status
    let adsTypeStatusWise = {};
    for (const adTypeId of adTypeIds) {
      let typeObj = {};
      for (const status of statuses) {
        typeObj[status] = await internalCampiagnModel.countDocuments({ addTypeId: adTypeId, status });
      }
      typeObj["TOTAL"] = await internalCampiagnModel.countDocuments({ addTypeId: adTypeId });
      adsTypeStatusWise[adTypeTitles[adTypeId.toString()] || adTypeId] = typeObj;
    }

    let successfullTransactionCount = await transtionModel.countDocuments({ type: "CREDIT" });
    let purchasedPackageCount = await internalCampiagnModel.countDocuments({ planId: { $ne: null } });

    // Calculate total payment received (sum of all CREDIT transactions)
    let totalPaymentReceivedAgg = await transtionModel.aggregate([
      { $match: { type: "CREDIT" } },
      { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } },
    ]);
    let totalPaymentReceived = totalPaymentReceivedAgg[0]?.total || 0;

    // Calculate operational revenue (same as totalPaymentReceived here)
    let operationalRevenue = totalPaymentReceived;

    let businessCount = await businessModel.countDocuments({ disable: false }) || 0;
    let leadGennerateCount = await leadModel.countDocuments();

    // Today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    let todayTransactionCount = await transtionModel.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Calculate today's revenue using aggregation for accuracy
    let todayRevenueAgg = await transtionModel.aggregate([
      { $match: { type: "CREDIT", createdAt: { $gte: today, $lt: tomorrow } } },
      { $group: { _id: null, total: { $sum: { $toDouble: "$amount" } } } }
    ]);
    let todayRevenue = todayRevenueAgg[0]?.total || 0;

    // Today's business count
    let todayBusinessCount = await businessModel.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Today's user count
    let todayUserCount = await userModel.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // This month's revenue
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let monthRevenueAgg = await transtionModel.find({
      type: "CREDIT",
      createdAt: { $gte: monthStart, $lt: monthEnd }
    }).select("amount");
    let monthRevenueTotal = monthRevenueAgg.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);
    let monthRevenue = monthRevenueTotal;

    // Last month's revenue
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);

    let lastMonthRevenueAgg = await transtionModel.find({
      type: "CREDIT",
      createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd }
    }).select("amount");
    let lastMonthRevenueTotal = lastMonthRevenueAgg.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);
    let lastMonthRevenue = lastMonthRevenueTotal;

    // Today Ads Run Count (status: ACTIVE, startDate today)
    let todayAdsRunCount = await internalCampiagnModel.countDocuments({
      status: "ACTIVE",
      startDate: { $gte: today, $lt: tomorrow }
    });

    // Today Ads Complete Count (status: COMPLETED, endDate today)
    let todayAdsCompleteCount = await internalCampiagnModel.countDocuments({
      status: "COMPLETED",
      endDate: { $gte: today, $lt: tomorrow }
    });

    return res.status(200).send({
      success: true,
      message: "dashboard data fetched",
      userCount: userCount,
      statusWiseAds: statusWiseAds,
      adsTypeStatusWise: adsTypeStatusWise,
      successfullTransactionCount: successfullTransactionCount,
      purchasedPackageCount: purchasedPackageCount,
      totalPaymentReceived: totalPaymentReceived,
      operationalRevenue: operationalRevenue,
      businessCount: businessCount,
      leadGennerateCount: leadGennerateCount,
      todayTransactionCount: todayTransactionCount,
      todayRevenue: todayRevenue,
      todayBusinessCount: todayBusinessCount,
      todayUserCount: todayUserCount,
      totalRevenue: totalPaymentReceived,
      thisMonthRevenue: monthRevenue,
      lastMonthRevenue: lastMonthRevenue,
      todayAdsRunCount: todayAdsRunCount,
      todayAdsCompleteCount: todayAdsCompleteCount,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

exports.dashBoardGraphsAndCharts = async (req, res) => {
  try {
    let { year } = req.query;
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    // Ensure year is a number
    year = Number(year) || new Date().getFullYear();

    // Set full year range in UTC to avoid timezone issues
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    // Get all ad types
    const adTypes = await require("../models/advertisementModel").find().select("_id title");

    // Fetch all ads for the year (including addTypeId)
    const ads = await internalCampiagnModel.find({
      createdAt: { $gte: yearStart, $lt: yearEnd }
    }).select("createdAt status addTypeId");

    // Filter active ads
    const activeAds = ads.filter(ad => ad.status === "ACTIVE");

    // Fetch other models
    const [users, businesses, leads, transactions, credits] = await Promise.all([
      userModel.find({ createdAt: { $gte: yearStart, $lt: yearEnd } }).select("createdAt"),
      businessModel.find({ createdAt: { $gte: yearStart, $lt: yearEnd } }).select("createdAt"),
      leadModel.find({ createdAt: { $gte: yearStart, $lt: yearEnd } }).select("createdAt"),
      transtionModel.find({ createdAt: { $gte: yearStart, $lt: yearEnd } }).select("createdAt type amount"),
      transtionModel.find({ type: "CREDIT", createdAt: { $gte: yearStart, $lt: yearEnd } }).select("createdAt amount")
    ]);

    // Ads Type Wise Monthly Count
    const adsTypeWiseArr = {};
    adTypes.forEach(type => {
      const arr = Array(12).fill(0);
      ads.forEach(ad => {
        if (ad.addTypeId?.toString() === type._id.toString()) {
          const date = new Date(ad.createdAt);
          if (date.getUTCFullYear() === year) {
            arr[date.getUTCMonth()]++;
          }
        }
      });
      adsTypeWiseArr[type.title] = arr;
    });

    // Helper: Count by UTC month
    const countByMonth = (arr, field = "createdAt") => {
      const result = Array(12).fill(0);
      arr.forEach(item => {
        const date = new Date(item[field]);
        if (date.getUTCFullYear() === year) {
          result[date.getUTCMonth()]++;
        }
      });
      return result;
    };

    // Helper: Sum by UTC month
    const sumByMonth = (arr, field = "createdAt", sumField = "amount") => {
      const result = Array(12).fill(0);
      arr.forEach(item => {
        const date = new Date(item[field]);
        if (date.getUTCFullYear() === year) {
          result[date.getUTCMonth()] += Number(item[sumField] || 0);
        }
      });
      return result;
    };

    // Create arrays for each metric
    const adsCountArr = countByMonth(ads);
  //  const activeAdsCountArr = countByMonth(activeAds);
    const userCountArr = countByMonth(users);
    const businessCountArr = countByMonth(businesses);
    const leadCountArr = countByMonth(leads);
    const transactionCountArr = countByMonth(transactions);
    const revenueArr = sumByMonth(credits);

    // Totals
  //   const adsCount = ads.length;
  //  // const activeAdsCount = activeAds.length;
  //   const userCount = users.length;
  //   const businessCount = businesses.length;
  //   const leadCount = leads.length;
  //   const transactionCount = transactions.length;
  //   const revenueCount = credits.reduce((sum, doc) => sum + Number(doc.amount || 0), 0);

    // Response
    return res.status(200).send({
      success: true,
      message: "All graph data fetched",
      months,
      adsCountArr,
    //  activeAdsCountArr,
      userCountArr,
      businessCountArr,
      leadCountArr,
      revenueArr,
      transactionCountArr,
      adsTypeWiseArr, // ✅ Include ad-type-wise data here
      // totals: {
      //   adsCount,
      //  // activeAdsCount,
      //   userCount,
      //   businessCount,
      //   leadCount,
      //   revenueCount,
      //   transactionCount
      // }
    });

  } catch (error) {
    return res.status(500).send({
      success: false,
      message: error.message
    });
  }
};



exports.userListForAdmin = async (req, res) => {
  try {
    const { userType, search, sort, page = 1, limit = 20, disable } = req.query;
    let query = {};

    // Filter by userType if provided
    if (userType) {
      query.userType = userType;
    }
    if (disable) {
      query.disable = disable;
    }

    // Add search criteria
    if (search) {
      const isNumeric = !isNaN(search);
      query.$or = isNumeric
        ? [{ mobile: Number(search) }]
        : [{ email: new RegExp(search, "i") }];
    }

    // Pagination
    const skip = (page - 1) * limit;

    // Fetch the user list with pagination
    let userList = await userModel
      .find(query)
      .sort({ createdAt: -1 })
      .select("name mobile email disable")
      .skip(skip)
      .limit(Number(limit));

    // Only proceed with ad count calculation if sorting by ads is required
    if (sort === "byAds") {
      const userIds = userList.map((user) => user._id);

      // Fetch business data and ad counts for the users in one go
      const businessData = await businessModel
        .find({ userId: { $in: userIds } })
        .select("_id userId");

      // Count ads for each business
      const adCounts = await internalCampiagnModel.aggregate([
        {
          $match: {
            businessId: { $in: businessData.map((business) => business._id) },
          },
        },
        { $group: { _id: "$businessId", count: { $sum: 1 } } },
      ]);

      // Map businessId to ad count
      const adCountMap = adCounts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      // Map userId to total ad count
      const userAdCountMap = businessData.reduce((acc, business) => {
        const adCount = adCountMap[business._id] || 0;
        acc[business.userId] = (acc[business.userId] || 0) + adCount;
        return acc;
      }, {});

      // Attach totalAdCount to each user and sort by this count
      userList = userList
        .map((user) => ({
          ...user._doc,
          totalAdCount: userAdCountMap[user._id] || 0,
        }))
        .sort((a, b) => b.totalAdCount - a.totalAdCount);
    }

    const count = await userModel.countDocuments(query);
    const pageCount = Math.ceil(count / limit);

    return res.status(200).send({
      success: true,
      message: "User list fetched",
      data: userList,
      page: pageCount,
    });
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

exports.adListForAdmin = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search, addTypeId } = req.query;
    let query = {};

    if (status) query.status = status;
    if (addTypeId) query.addTypeId = addTypeId;
    if (search) query.title = new RegExp(search, "i");

    const skip = (page - 1) * limit;

    let data = await internalCampiagnModel
      .find(query)
      .select("status addTypeId businessId title pageName image thambnail createdAt instaBudget facebookBudget totalBudget")
      .populate("addTypeId", "title")
      .populate("businessId", "businessName userId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Add totalBudget with 18% GST to each item, rounded up
    // data = data.map(item => {
    //   const insta = Number(item.instaBudget || 0);
    //   const fb = Number(item.facebookBudget || 0);
    //   const baseTotal = insta + fb;
    //   const totalBudget = Math.ceil(baseTotal * 1.18); // Rounded up

    //   return {
    //     ...item.toObject(),
    //     totalBudget,
    //   };
    // });

    const count = await internalCampiagnModel.countDocuments(query);
    const pageCount = Math.ceil(count / 20);

    return res.status(200).send({
      success: true,
      message: "Ad list fetched",
      data: data,
      page: pageCount,
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};




exports.adbyIdForAdmin = async (req, res) => {
  try {
    const { addId } = req.query;
    const data = await internalCampiagnModel
      .findById(addId)
      .populate("addTypeId", "title")
      .populate("businessId", "businessName");

    if (!data) {
      return res.status(404).send({
        success: false,
        message: "Ad not found",
      });
    }

    // Initialize metrics
    let totalReach = 0;
    let totalSpendBudget = 0;
    let totalImpression = 0;
    let totalBudget = 0;
    let totalClicks = 0;
    let totalFirstReplies = 0;

    // Get leads count
    let totalLeads = await leadModel.countDocuments({
      internalCampiagnId: data._id,
    });

    // Fetch insights if mainAdId exists
    if (data.mainAdId && process.env.systemUserAccessToken) {
      const url = `https://graph.facebook.com/v22.0/${data.mainAdId}/insights?date_preset=maximum&access_token=${process.env.systemUserAccessToken}&fields=reach,impressions,clicks,spend,actions`;
      try {
        const { data: response } = await axios.get(url);
        const insight = response?.data?.[0];
        if (insight) {
          totalReach = parseInt(insight.reach || 0, 10);
          totalSpendBudget = Math.ceil(parseFloat(insight.spend || 0) * 1.18); // 18% GST
          totalImpression = parseInt(insight.impressions || 0, 10);
          totalClicks = parseInt(insight.clicks || 0, 10);

          const actions = insight.actions || [];
          const firstReplyAction = actions.find(
            (action) =>
              action.action_type === "onsite_conversion.messaging_first_reply" ||
              action.action_type === "click_to_call_call_confirm"
          );
          totalFirstReplies = parseInt(firstReplyAction?.value || 0, 10);
        }
      } catch (insightErr) {
        // Ignore insight errors, just don't attach insights
      }
    }

    // Parse AddAmountInsights if provided (expects JSON string)
    let addAmount = data?.AddAmountInsights;


    // Attach insights to response, adding AddAmountInsights values if present
    data._doc.insights = {
      totalReach: totalReach + (addAmount?.totalReach || 0),
      totalSpendBudget: totalSpendBudget + (addAmount?.totalSpendBudget || 0),
      totalImpression: totalImpression + (addAmount?.totalImpression || 0),
      totalBudget: (addAmount?.totalBudget || 0),
      totalClicks: totalClicks + (addAmount?.totalClicks || 0),
      totalLeads: totalLeads + (addAmount?.totalLeads || 0),
      totalFirstReplies: totalFirstReplies + (addAmount?.totalFirstReplies || 0),
    };

    return res.status(200).send({
      success: true,
      message: "Ad Details Fetched",
      data,
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};
exports.getAdsWithErrors = async (req, res) => {
  try {
    const { page = 1, limit = 20, errorType, search } = req.query;
    let query = {};

    // Build query for AdErrorLog
    if (errorType) query.errorType = errorType;
    if (search) {
      query.$or = [
        { errorMessage: new RegExp(search, "i") },
        { metaCampaignId: new RegExp(search, "i") },
        { metaAdSetId: new RegExp(search, "i") },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Find error logs and get distinct internalCampaignIds
    const errorLogs = await AdErrorLog.find(query)
      .select(
        "internalCampaignId errorType errorMessage errorDetails metaCampaignId metaAdSetId createdAt"
      )
      .populate("businessId", "businessName");

    // Extract unique internalCampaignIds from error logs
    const campaignIds = [
      ...new Set(
        errorLogs.map((log) => log.internalCampaignId).filter((id) => id)
      ),
    ];

    // Fetch full ad details only for campaigns with errors
    const ads = await internalCampiagnModel
      .find({ _id: { $in: campaignIds } })
      .populate("addTypeId", "title")
      .populate("businessId", "businessName")
      .populate("externalCampiagnId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    // Count total ads with errors for pagination
    const count = await internalCampiagnModel.countDocuments({
      _id: { $in: campaignIds },
    });
    const pageCount = Math.ceil(count / limit);

    // Format response data
    const formattedData = ads.map((ad) => {
      // Find all error logs for this campaign
      const campaignErrors = errorLogs
        .filter(
          (log) =>
            log.internalCampaignId &&
            log.internalCampaignId.toString() === ad._id.toString()
        )
        .map((log) => ({
          errorType: log.errorType,
          errorMessage: log.errorMessage,
          errorDetails: log.errorDetails,
          metaCampaignId: log.metaCampaignId,
          metaAdSetId: log.metaAdSetId,
          createdAt: log.createdAt,
        }));

      // Return full ad data with errors
      return {
        _id: ad._id,
        businessId: ad.businessId?._id,
        businessName: ad.businessId?.businessName,
        metaAdId: ad.metaAdId,
        title: ad.title,
        image: ad.image,
        isCallToActionEnabled: ad.isCallToActionEnabled,
        destinationUrl: ad.destinationUrl,
        audienceId: ad.audienceId,
        interest: ad.interest,
        location: ad.location,
        audienceGender: ad.audienceGender,
        ageRangeFrom: ad.ageRangeFrom,
        ageRangeTo: ad.ageRangeTo,
        days: ad.days,
        facebookBudget: ad.facebookBudget,
        instaBudget: ad.instaBudget,
        googleBudget: ad.googleBudget,
        paymentStatus: ad.paymentStatus,
        startDate: ad.startDate,
        endDate: ad.endDate,
        dayStartTime: ad.dayStartTime,
        dayEndTime: ad.dayEndTime,
        status: ad.status,
        isFacebookAdEnabled: ad.isFacebookAdEnabled,
        isInstaAdEnabled: ad.isInstaAdEnabled,
        isGoogleAdEnabled: ad.isGoogleAdEnabled,
        addType: ad.addTypeId?.title,
        creativeId: ad.creativeId,
        externalCampaignId: ad.externalCampiagnId?._id,
        externalCampaignName: ad.externalCampiagnId?.name,
        imageHashId: ad.imageHashId,
        facebookAdSetId: ad.facebookAdSetId,
        instaAdSetId: ad.instaAdSetId,
        transaction: ad.transactionId,
        createdAt: ad.createdAt,
        updatedAt: ad.updatedAt,
        errors: campaignErrors,
      };
    });

    return res.status(200).send({
      success: true,
      message: "Ads with errors fetched successfully",
      data: formattedData,
      page: pageCount,
      // total: count,
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: "An error occurred while fetching ads with errors",
      error: err.message,
    });
  }
};

exports.getAdsWithErrorsByid = async (req, res) => {
  try {
    const { adsId } = req.query;

    // Find error logs and get distinct internalCampaignIds
    const errorLogs = await AdErrorLog.find({ internalCampaignId: adsId })
      .select(
        "internalCampaignId errorType errorMessage errorDetails metaCampaignId metaAdSetId createdAt"
      )
      .populate("businessId", "businessName");

    // Extract unique internalCampaignIds from error logs
    const campaignIds = [
      ...new Set(
        errorLogs.map((log) => log.internalCampaignId).filter((id) => id)
      ),
    ];

    // Fetch full ad details only for campaigns with errors
    const ads = await internalCampiagnModel
      .find({ _id: { $in: campaignIds } })
      .populate("addTypeId", "title")
      .populate("businessId", "businessName")
      .populate("externalCampiagnId", "name");

    // Format response data
    const formattedData = ads.map((ad) => {
      // Find all error logs for this campaign
      const campaignErrors = errorLogs
        .filter(
          (log) =>
            log.internalCampaignId &&
            log.internalCampaignId.toString() === ad._id.toString()
        )
        .map((log) => ({
          errorType: log.errorType,
          errorMessage: log.errorMessage,
          errorDetails: log.errorDetails,
          metaCampaignId: log.metaCampaignId,
          metaAdSetId: log.metaAdSetId,
          createdAt: log.createdAt,
        }));

      // Return full ad data with errors
      return {
        _id: ad._id,
        businessId: ad.businessId?._id,
        businessName: ad.businessId?.businessName,
        metaAdId: ad.metaAdId,
        title: ad.title,
        image: ad.image,
        isCallToActionEnabled: ad.isCallToActionEnabled,
        destinationUrl: ad.destinationUrl,
        audienceId: ad.audienceId,
        interest: ad.interest,
        location: ad.location,
        audienceGender: ad.audienceGender,
        ageRangeFrom: ad.ageRangeFrom,
        ageRangeTo: ad.ageRangeTo,
        days: ad.days,
        facebookBudget: ad.facebookBudget,
        instaBudget: ad.instaBudget,
        googleBudget: ad.googleBudget,
        paymentStatus: ad.paymentStatus,
        startDate: ad.startDate,
        endDate: ad.endDate,
        dayStartTime: ad.dayStartTime,
        dayEndTime: ad.dayEndTime,
        status: ad.status,
        isFacebookAdEnabled: ad.isFacebookAdEnabled,
        isInstaAdEnabled: ad.isInstaAdEnabled,
        isGoogleAdEnabled: ad.isGoogleAdEnabled,
        addType: ad.addTypeId?.title,
        creativeId: ad.creativeId,
        externalCampaignId: ad.externalCampiagnId?._id,
        externalCampaignName: ad.externalCampiagnId?.name,
        imageHashId: ad.imageHashId,
        facebookAdSetId: ad.facebookAdSetId,
        instaAdSetId: ad.instaAdSetId,
        transaction: ad.transactionId,
        createdAt: ad.createdAt,
        updatedAt: ad.updatedAt,
        errors: campaignErrors,
      };
    });

    return res.status(200).send({
      success: true,
      message: "Ads with errors fetched successfully",
      data: formattedData[0],

      // total: count,
    });
  } catch (err) {
    return res.status(500).send({
      success: false,
      message: err.message,
    });
  }
};
