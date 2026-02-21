const {
  statusCodes,
  defaultResponseMessage,
  apiResponseStatusCode,
} = require("../Message/defaultMessage");
const { deleteFileFromObjectStorage } = require("../middlewares/multer");
const businessService = require("../services/businessService");
const userService = require("../services/userService");
const responseBuilder = require("../utils/responseBuilder");
const axios = require("axios");
const permissionModel = require("../models/permissionModel");
const businessModel = require("../models/businessModel");
const Staff = require("../models/staffModel");

exports.createBusiness = async (req, res) => {
  const {
    businessName,
    userId,
    businessCategoryId,
    servicesId,
    businessContact,
    whatsappNumber,
    stateId,
    cityId,
    countryId,
    websiteLink,
    businessEmail,
    instagramLink,
    twitterLink,
    youtubeLink,
    facebookLink,
    address,
    tagline,
  } = req.body;

  if (!businessName) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "businessName is required")
      );
  }

  if (!userId) {
    return res
      .status(statusCodes["Bad Request"])
      .json(responseBuilder(apiResponseStatusCode[400], "userId is required"));
  }

  if (!businessCategoryId) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(
          apiResponseStatusCode[400],
          "businessCategoryId is required"
        )
      );
  }

  if (!servicesId) {
    return res
      .status(statusCodes["Bad Request"])
      .json(
        responseBuilder(apiResponseStatusCode[400], "servicesId is required")
      );
  }

  await userService.updateUser(userId, { roleId: "66ae0d19a1432b1bddd15b0f" });

  let dataObj = {
    businessName,
    userId,
    businessCategoryId,
    servicesId,
    businessContact,
    whatsappNumber,
    stateId,
    cityId,
    countryId,
    websiteLink,
    instagramLink,
    twitterLink,
    youtubeLink,
    facebookLink,
    address,
    businessEmail,
    tagline,
    businessImage: req.file?.location,
  };
  const createData = await businessService.createBusiness(dataObj);

  await permissionModel.create({
    businessId: createData._id,
    userId: userId,
    accessLevel: "ADMIN",
    permissions: [],
  });

  return res
    .status(statusCodes.Created)
    .json(
      responseBuilder(
        apiResponseStatusCode[201],
        defaultResponseMessage?.CREATED,
        createData
      )
    );
};

exports.getAllBusiness = async (req, res) => {
  try {
    const { 
      page = 1, 
      search,
      disable, 
      isBmAccessProvidedToAdminBm, 
      type,
      staffId
    } = req.query;

    const limit = 20;
    const skip = (page - 1) * limit;
    let query = {};

    if (search) query.businessName = new RegExp(search, "i");
    if (disable) query.z = disable;
    if (type) query.type = type;
    if (isBmAccessProvidedToAdminBm) query.isBmAccessProvidedToAdminBm = isBmAccessProvidedToAdminBm;

    // Fetch all businesses sorted for consistent ordering
    const allBusinesses = await businessModel.find(query).sort({ createdAt: 1 });

    // Fetch active staff
    const Staff = require('../models/staffModel');
    const staffMembers = await Staff.find({ isActive: true }).sort({ _id: 1 });

    const staffCount = staffMembers.length;

    // Assign logic (deterministic by index)
    const assignedList = allBusinesses.map((business, index) => {
      if (staffCount > 0) {
        const assignedStaff = staffMembers[index % staffCount];
        return {
          ...business._doc,
          assignedStaff: assignedStaff._id,
          staffName: assignedStaff.name,
          isAssigned: true
        };
      }
      return business;
    });

    // If filter by staffId
    let finalData = assignedList;
    if (staffId) {
      finalData = assignedList.filter(b => b.assignedStaff == staffId);
    }

    // Pagination after assignment
    const paginated = finalData.slice(skip, skip + limit);
    const pageCount = Math.ceil(finalData.length / limit);

    return res.status(statusCodes.OK).json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage.FETCHED,
        paginated,
        pageCount
      )
    );

  } catch (error) {
    console.error("getAllBusiness Error:", error);
    return res.status(statusCodes.INTERNAL_ERROR).json(
      responseBuilder(
        apiResponseStatusCode[500],
        defaultResponseMessage.ERROR,
        error.message
      )
    );
  }
};

exports.updateBusiness = async (req, res) => {
  try {
    const business  = req.bussiness;
    const businessImage = req.file
      ? req.file.location
      : business?.businessImage;

    if (req.file && business?.businessImage) {
      await deleteFileFromObjectStorage(business.businessImage);
    }

    const updateData = extractUpdateData(req.body, businessImage);

    // Handle Meta Access Token
    const metaTokenResponse = await handleMetaAccessToken(
      req.body.metaAccessToken
    );
    if (metaTokenResponse.error)
      return res.status(500).json(metaTokenResponse.error);
    updateData.metaAccessToken = metaTokenResponse.token;

    // Update Business
    let updatedBusiness = await businessService.updateBusiness(
      { _id: business._id },
      updateData
    );

    // Handle Page Subscription and Business Manager
    if (req.body.pageId && req.body.pageAccessToken) {
      const pageSubscriptionResponse = await handlePageSubscription(
        updatedBusiness,
        req.body.pageId,
        req.body.pageAccessToken
      );
      if (pageSubscriptionResponse.error)
        return res.status(500).json(pageSubscriptionResponse.error);

      const businessManagerResponse = await handleBusinessManagerAccess(
        updatedBusiness,
        req.body.pageId,
        req.body.pageAccessToken
      );
      if (businessManagerResponse.error)
        return res.status(500).json(businessManagerResponse.error);
      updatedBusiness = businessManagerResponse.updatedBusiness;
    }

    return res
      .status(statusCodes.OK)
      .json(
        responseBuilder(
          apiResponseStatusCode[200],
          defaultResponseMessage.UPDATED,
          updatedBusiness
        )
      );
  } catch (error) {
    console.error("Error updating business:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Failed to update business",
        error: error.message,
      });
  }
};

function extractUpdateData(body, businessImage) {
  return {
    businessName: body.businessName,
    userId: body.userId,
    businessCategoryId: body.businessCategoryId,
    servicesId: body.servicesId,
    businessContact: body.businessContact,
    whatsappNumber: body.whatsappNumber,
    stateId: body.stateId,
    cityId: body.cityId,
    websiteLink: body.websiteLink,
    instagramLink: body.instagramLink,
    countryId: body.countryId,
    twitterLink: body.twitterLink,
    youtubeLink: body.youtubeLink,
    facebookLink: body.facebookLink,
    address: body.address,
    tagline: body.tagline,
    businessImage,
    businessEmail: body.businessEmail,
    metaAccessToken: body.metaAccessToken,
    pageId: body.pageId,
    pageAccessToken: body.pageAccessToken,
  };
}

async function handleMetaAccessToken(metaAccessToken) {
  if (!metaAccessToken) return { token: null };
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v21.0/oauth/access_token`,
      {
        params: {
          client_id: process.env.clientId,
          client_secret: process.env.clientSecret,
          grant_type: "fb_exchange_token",
          fb_exchange_token: metaAccessToken,
        },
      }
    );
    return { token: data.access_token };
  } catch (error) {
    console.error("Error updating Meta Access Token:", error);
    return {
      error: {
        success: false,
        message: "Failed to update Meta Access Token",
        error: error.response?.data || error.message,
      },
    };
  }
}

async function handlePageSubscription(business, pageId, pageAccessToken) {
  if (business.isPageSubscribe) return {};
  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`,
      null,
      {
        params: {
          subscribed_fields: "leadgen",
          access_token: pageAccessToken,
        },
      }
    );
    await businessService.updateBusiness(
      { _id: business._id },
      { isPageSubscribe: true }
    );
    return {};
  } catch (error) {
    console.error("Error subscribing page for leadgen:", error);
    return {
      error: {
        success: false,
        message: "Failed to subscribe page for leadgen",
        error: error.response?.data || error.message,
      },
    };
  }
}

async function handleBusinessManagerAccess(business, pageId, pageAccessToken) {
  if (business.isBmAccessProvidedToAdminBm)
    return { updatedBusiness: business };
  try {
    const clientUserId = await fetchClientUserId(business.metaAccessToken);
    console.log("Client User ID:", clientUserId);
    const clientUserName = await fetchClientUserName(pageAccessToken);
    console.log("Client User Name:", clientUserName);
    const metaManagerId = await ensureBusinessManagerExists(
      clientUserId,
      business.metaAccessToken
    );
    console.log("Meta Business Manager ID:", metaManagerId);
    await assignPageToBusinessManager(metaManagerId, pageId, pageAccessToken);
    console.log("Page assigned to Business Manager.");
    await provideAccessToAppOwnerBusinessManager(
      metaManagerId,
      business.metaAccessToken,
      pageId
    );
    console.log("Access provided to app owner's Business Manager.");
    await assignUserToPage(pageId, pageAccessToken);
    console.log("User assigned to page.");
    const updatedBusiness = await businessService.updateBusiness(
      { _id: business._id },
      {
        isBmAccessProvidedToAdminBm: true,
        metaMangerId: metaManagerId,
        isFacebookPageLinked: true,
        pageName: clientUserName,
      }
    );
    return { updatedBusiness };
  } catch (error) {
    // console.error("Error in Business Manager access:", error);
    return {
      error: {
        success: false,
        message:
          error.response?.data?.error?.message ||
          "Failed to manage Business Manager access",
        error: error.response?.data || error.message,
      },
    };
  }
}

async function fetchClientUserId(accessToken) {
  const { data } = await axios.get(
    `https://graph.facebook.com/v21.0/me?access_token=${accessToken}`
  );
  return data.id;
}

async function fetchClientUserName(accessToken) {
  const { data } = await axios.get(
    `https://graph.facebook.com/v21.0/me?access_token=${accessToken}`
  );
  return data.name;
}

async function ensureBusinessManagerExists(clientUserId, accessToken) {
  const { data } = await axios.get(
    `https://graph.facebook.com/v21.0/${clientUserId}/businesses?access_token=${accessToken}`
  );
  if (data.data.length > 0) return data.data[0].id;
  const { data: createResponse } = await axios.post(
    `https://graph.facebook.com/v21.0/${clientUserId}/businesses`,
    {
      name: "Leadkart Partnered BM",
      vertical: "ADVERTISING",
      timezone_id: 1,
      access_token: accessToken,
    }
  );
  return createResponse.id;
}

async function assignPageToBusinessManager(
  metaManagerId,
  pageId,
  pageAccessToken
) {
  try {
    console.log(pageAccessToken,"Assigning page to Business Manager...",metaManagerId);
    const { data } = await axios.get(
      `https://graph.facebook.com/v21.0/${metaManagerId}/client_pages`,
      {
        params: { access_token:  "EAAJeydN1ENwBPucUNrYCW144k4dv0ceyeaact0hVgUq0wRQ4GAHimXYj4ZA2N7zx3zlW2qBlncfz0YGJgiPkh3MWixZBOG2bfjV0XA80gJT6HZBeuUqTltemoj3DOGKzgZA3uTaBdaAUG96eTaTmmIWeOJjabusjd9WZBUuIC5NELcuDdXnlaVjPN11Eu6QLl4QZDZD" },
      }
    );
    if (data.data.some((item) => item.id === pageId)) {
      console.log("✅ Page already assigned to Business Manager.");
      return;
    }
    await axios.post(`https://graph.facebook.com/v23.0/${pageId}/agencies`, {
      business: process.env.businessId,
      permitted_tasks: ["MANAGE"],
      access_token: pageAccessToken,
    });
    console.log("✅ Page assigned to Business Manager.");
  } catch (error) {
    console.error("Error assigning page:", error);
    throw error;
  }
}

async function provideAccessToAppOwnerBusinessManager(
  metaManagerId,
  accessToken,
  pageId
) {
  try {
    const { data } = await axios.get(
      `https://graph.facebook.com/v21.0/${process.env.businessId}/client_pages`,
      {
        params: { access_token: accessToken },
      }
    );
    if (data.data.some((item) => item.id === pageId)) return;
    await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.businessId}/managed_businesses`,
      {
        existing_client_business_id: metaManagerId,
        access_token: accessToken,
      }
    );
  } catch (error) {
    console.error("Error providing access to Business Manager:", error);
    throw error;
  }
}

async function assignUserToPage(pageId, pageAccessToken) {
  try {
    await axios.post(
      `https://graph.facebook.com/v21.0/${pageId}/assigned_users`,
      {
        user: process.env.assignUserId,  // How To Get https://graph.facebook.com/v21.0/1616534982230233/business_users?access_token=EAAJeydN1ENwBPjY8DDmwcjiiRFf2iGncTF8cgtAyn8DvZBZBH96elpA8Vs0GZAjZCoBkMbsyiQvrEsblwYDab0cI0yNMnHZAwQuPSnmQN4DSZBfbWuo8n0oS3j9jKZBWY1M3AvmGqJRZCgzjZANpM2KF5N0vz71PJSyAb7RPQYS9DCpDUUcEMlpRbuDhyNFbXnmyLggZDZD
        tasks: ["MANAGE", "CREATE_CONTENT", "MODERATE", "ADVERTISE", "ANALYZE"],
        business: process.env.businessId,
        access_token: process.env.systemUserAccessToken || "EAAJeydN1ENwBPjY8DDmwcjiiRFf2iGncTF8cgtAyn8DvZBZBH96elpA8Vs0GZAjZCoBkMbsyiQvrEsblwYDab0cI0yNMnHZAwQuPSnmQN4DSZBfbWuo8n0oS3j9jKZBWY1M3AvmGqJRZCgzjZANpM2KF5N0vz71PJSyAb7RPQYS9DCpDUUcEMlpRbuDhyNFbXnmyLggZDZD",
      }
    );
    console.log("✅ User assigned to page.");
  } catch (error) {
    console.error("Error assigning user to page:", error);
    throw error;
  }
}

exports.getByIdBusiness = async (req, res) => {
  // const url = `https://graph.facebook.com/oauth/access_token_info?access_token=${req.bussiness?.metaAccessToken}`;

  // const response = await new Promise((resolve, reject) => {
  //   https
  //     .get(url, (resHttp) => {
  //       let data = "";
  //       resHttp.on("data", (chunk) => (data += chunk));
  //       resHttp.on("end", () => {
  //         try {
  //           const parsedData = JSON.parse(data);
  //           resolve(parsedData);
  //         } catch (error) {
  //           reject(error);
  //         }
  //       });
  //     })
  //     .on("error", (error) => reject(error));
  // });

  // if (req.bussiness.metaAccessToken) {
  //   console.log(req.bussiness.metaAccessToken);
  //   const response = await axios.post(
  //     `https://graph.facebook.com/v21.0/299039119952016/instagram_accounts?access_token=EAAOmDJUkZC6ABO9bLwbXWWi0pjdkfo04GzfmqrNtB9ibp7SQBZAtBcgW1A1ofpJevMGPOJKVGIoHC6bWUWpAIt3v6gR69CXBCmXA4cEZAtHbpb9OXNjbDxkSZCeYVjyHLZAsFKT3ake4jUh1eEwqpKrxsSNGlOrJN4Kh0Dq2dSLkI0pYucxo7vx4TXC9LsiZAJZBYZBUW6RlRZBqVezLL&fields=id,username,profile_pic`
  //   );
  //   console.log("Response Data:", response.data);
  // }

  // req.bussiness._doc.isPageAccessTokenActive = true;
  // req.bussiness._doc.isMetaAccessTokenActive = true;
  // if (response?.error) {
  //   req.bussiness._doc.isMetaAccessTokenActive = false;
  // }
  req.bussiness._doc.is_instagram_account_associates = null;
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage?.FETCHED,
        req.bussiness
      )
    );
};

exports.disableBusiness = async (req, res) => {
  const getBusinessById = req.bussiness;
  const updateDisable = await businessService.disableBusiness(getBusinessById);
  let message = updateDisable.disable
    ? defaultResponseMessage?.DISABLED
    : defaultResponseMessage?.ENABLED;

  return res
    .status(statusCodes.OK)
    .json(responseBuilder(apiResponseStatusCode[200], message));
};

exports.getAllBusinessByUserId = async (req, res) => {
  const getAll = await businessService.getAllBusinessByUserId(req.user);
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage?.FETCHED,
        getAll
      )
    );
};

exports.getBusinessListForAdmin = async (req, res) => {
  const {
    page = 1,
    businessName,
    sort,
    disable,
    businessCategoryId,
    cityId,
  } = req.query;
  const skip = (page - 1) * 20;
  let query = {};
  let forSorting = {};

  if (businessName) {
    query.businessName = new RegExp(businessName, "i");
  }
  if (disable) {
    query.disable = disable;
  }
  if (businessCategoryId) {
    query.businessCategoryId = businessCategoryId;
  }
  if (cityId) {
    query.cityId = cityId;
  }
  if (sort == 1) {
    forSorting.createdAt = 1;
  } else {
    forSorting.createdAt = -1;
  }

  const getAll = await businessService.getAllBusinessListForAdmin(
    query,
    skip,
    sort
  );

  // Fetch the total count
  const totalCount = (await businessService.getAllBusinessListForAdmin(query))
    .length;
  const pageCount = Math.ceil(totalCount / 20);
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage?.FETCHED,
        getAll,
        pageCount
      )
    );
};

exports.getBusinessIdForAdmin = async (req, res) => {
  const { businessId } = req.query;
  let data = await businessService.getBusinessByIdForAdmin(businessId);
  return res
    .status(statusCodes.OK)
    .json(
      responseBuilder(
        apiResponseStatusCode[200],
        defaultResponseMessage?.FETCHED,
        data
      )
    );
};

exports.getUsersAllBusinessList = async (req, res) => {
  try {
    // const {page} = req.query
    // const skip = page?(page-1)*20:0
    console.log(req.user._id);
    const businessList = await permissionModel.aggregate([
      {
        $match: { userId: req.user._id },
      },
      {
        $lookup: {
          from: "businesses", // Replace 'businesses' with your actual business model collection name
          localField: "businessId",
          foreignField: "_id",
          as: "businessData",
        },
      },
      {
        $unwind: "$businessData",
      },
      {
        $addFields: {
          "businessData.roleName": "$roleName",
          "businessData.permissions": "$permissions",
        },
      },
      {
        $replaceRoot: { newRoot: "$businessData" },
      },
    ]);

    return res
      .status(statusCodes.OK)
      .json(
        responseBuilder(
          apiResponseStatusCode[200],
          defaultResponseMessage?.FETCHED,
          businessList
        )
      );
  } catch (error) {
    return res.status(500).send({ success: false, message: error.message });
  }
};

exports.unLinkPage = async (req, res) => {
  try {
    const { businessId } = req.body;
    await businessModel.findByIdAndUpdate(
      {
        _id: businessId,
      },
      {
        pageId: "",
        pageAccessToken: "",
        pageName: "",
        metaAccessToken: "",
        isPageSubscribe: false,
        isBmAccessProvidedToAdminBm: false,
        isFacebookPageLinked: false,
      },
      { new: true }
    );
    return res.status(200).json({
      success: true,
      message: "unlink Page Successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
