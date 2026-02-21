const axios = require("axios");
const webhookModel = require("../models/webhookModel");
const VERIFY_TOKEN = "da21e0d80f1d406e99ff7b518fd3936b";
// const PAGE_ACCESS_TOKEN = "YOUR_PAGE_ACCESS_TOKEN";
const businessModel = require("../models/businessModel");
const leadModel = require("../models/leadModel");
const adsetModel = require("../models/internalCampiagnModel");
const addDetailsModel = require("../models/adsDetailModel");
const leadHistoryChangeStatusModel = require("../models/leadHistoryChangeStatusModel");
const cron = require("node-cron");
const pinnedLeadsModel = require("../models/pinnedLeadsModel");

const puppeteer = require("puppeteer");

async function checkWhatsAppNumber(phoneNumber) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto("https://web.whatsapp.com");

  console.log("Scan the QR code and log in...");
  await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait for manual login

  await page.goto(`https://web.whatsapp.com/send?phone=${phoneNumber}`);
  await page.waitForTimeout(5000);

  const isRegistered = await page.evaluate(() => {
    return !document.body.innerText.includes(
      "Phone number shared via URL is invalid"
    );
  });

  await browser.close();
  return isRegistered
    ? "Number is on WhatsApp ✅"
    : "Number is NOT on WhatsApp ❌";
}

const fetchAndProcessLeadDetails = async (data, PAGE_ACCESS_TOKEN) => {
  const url = `https://graph.facebook.com/v21.0/${data?.leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`;
  try {
    const response = await axios.get(url);
    const leadDetails = response?.data;
    const extractedData = {};

    // Populate the extractedData object with the key-value pairs
    leadDetails?.field_data.forEach((item) => {
      extractedData[item.name] = item.values[0];
    });
    await leadModel.findByIdAndUpdate(
      { _id: data?._id },
      {
        $set: {
          userContactNumber: extractedData?.phone_number, // Map phone number
          name: extractedData?.full_name, // Map full name
          email: extractedData?.email, // Map email
          whatsappNumber: extractedData?.whatsapp_number,
        },
      },
      { new: true }
    );
    console.log("Lead details:", leadDetails);
  } catch (error) {
    console.error("Error fetching lead details:", error);
  }
};

// Endpoint to verify webhook
exports.getWebhook = (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

// Endpoint to handle webhook events
exports.postWebhook = async (req, res) => {
  const payload = req.body;

  if (payload.entry) {
    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;
        if (value.leadgen_id) {
          const leadgenId = value.leadgen_id;
          const pageId = value.page_id;
          // const formId = value.form_id;
          let business = await businessModel.findOne({ pageId: pageId });
          // console.log(business?.pageAccessToken,"DKDJDJ")
          await webhookModel.create({ leadgenId: leadgenId });
          let find = await leadModel.findOne({ leadgenId: leadgenId });
          if (!find) {
            let data = await leadModel.create({
              businessId: business?._id,
              adsetId: null,
              adId: value?.ad_id,
              pageId: value?.page_id,
              leadgenId: value?.leadgen_id,
              formId: value?.form_id,
              createdTime: value?.created_time,
              leadSource: "META",
              leadStatus: "NEW",
            });
            await fetchAndProcessLeadDetails(data, business?.pageAccessToken);
            await pinnedLeadsModel.create({
              userId: req.user._id,
              leadId: data._id,
            });
          }
        }
      }
    }
  }

  res.status(200).send("Event received");
};

// */10 * * * * *

// cron.schedule("0 */4 * * *", async () => {
//   console.log("Scheduler started");
//   const currentTimestamp = Math.floor(Date.now() / 1000);

//   // Update the documents and add the field islastSchedulerRunTime with the current timestamp
//   await addDetailsModel.updateMany(
//     { mainAdId: { $ne: null, $exists: true } }, // Condition to find the documents
//     { $set: { islastSchedulerRunTime: currentTimestamp } } // Data to update
//   );
//   try {
//     const addDetails = await addDetailsModel
//       .find({ mainAdId: { $ne: null, $exists: true } })
//       .populate("businessId");

//     for (const campaign of addDetails) {
//       const { mainAdId, lastSchedulerRunTime, businessId } = campaign;

//       if (!businessId || !businessId.pageAccessToken) {
//         console.error(
//           `Missing businessId or pageAccessToken for campaign: ${campaign._id}`
//         );
//         continue; // Skip this campaign if the necessary data is missing
//       }

//       const pageAccessToken = businessId.pageAccessToken;

//       // Store the current scheduler run time
//       const currentSchedulerRunTime = new Date();

//       try {
//         // Fetch leads from Meta API for Facebook and Instagram ad IDs
//         const fbLeads = await fetchLeadsFromMetaAPI(
//           mainAdId,
//           lastSchedulerRunTime,
//           pageAccessToken
//         );

//         // Check if leads do not already exist and save them
//         await saveLeadsIfNotExist(fbLeads, campaign);

//         // Update the adset with the new scheduler run time
//         await addDetailsModel.updateOne(
//           { _id: campaign._id },
//           {
//             lastSchedulerRunTime: currentSchedulerRunTime,
//             is_lead_data_fetched: true,
//           }
//         );

//         console.log(
//           `Leads fetched and saved for campaign with mainAdId: ${mainAdId}`
//         );
//       } catch (error) {
//         console.error(`Error processing campaign ${campaign._id}:`, error);
//       }
//     }
//   } catch (error) {
//     console.error("Error fetching campaigns:", error);
//   }

//   console.log("Scheduler finished");
// });

// // Function to fetch leads from Meta API
// async function fetchLeadsFromMetaAPI(
//   adSetId,
//   lastSchedulerRunTime,
//   pageAccessToken
// ) {
//   try {
//     const url = `https://graph.facebook.com/v21.0/${adSetId}/leads?access_token=${pageAccessToken}&filtering=[ 
//     { 
//       "field": "time_created", 
//       "operator": "GREATER_THAN", 
//       "value": 1721715952 
//     } 
//   ]`;

//     const response = await axios.get(url);
//     console.log(response.data.data, "response.data.data");
//     return response.data.data;
//   } catch (error) {
//     console.error("Error fetching leads:", error?.message);
//     return [];
//   }
// }

// // Function to save leads if they do not already exist
// async function saveLeadsIfNotExist(leads, addDetails) {
//   for (const lead of leads) {
//     const leadExists = await leadModel.findOne({ leadgenId: lead?.id });

//     if (!leadExists) {
//       const extractedData = {};

//       // Populate the extractedData object with the key-value pairs
//       lead?.field_data.forEach((item) => {
//         extractedData[item.name] = item.values[0];
//       });
//       let a = await leadModel.create({
//         businessId: addDetails?.businessId?._id,
//         adsetId: addDetails?.metaAdsetId,
//         adId: addDetails?.mainAdId,
//         pageId: addDetails?.businessId?.pageId,
//         leadgenId: lead?.id,
//         createdTime: lead.created_time,
//         leadSource: "META",
//         leadStatus: "NEW",
//         userContactNumber: extractedData?.phone_number, // Map phone number
//         name: extractedData?.full_name, // Map full name
//         email: extractedData?.email, // Map email
//         whatsappNumber: extractedData?.whatsapp_number,
//       });

//       await pinnedLeadsModel.create({
//         userId: req.user._id,
//         leadId: data._id,
//       });
//     }
//   }
// }
//  changes
exports.getAllLeadsByPagination = async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const skip = (page - 1) * limit;

  try {
    const query = search ? { name: new RegExp(search, "i") } : {};

    const leads = await leadModel
      .find(query)
      .skip(skip)
      .populate("businessId")
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    const totalLeads = await leadModel.countDocuments(query);
    const totalPages = Math.ceil(totalLeads / limit);

    res.status(200).json({
      success: true,
      message: "All Leads fetched successfully",
      data: leads,
      page: parseInt(page),
      totalPages,
      totalLeads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching leads",
      error: error.message,
    });
  }
};


exports.getAllLeadsByPaginationForAdmin = async (req, res) => {
  const { page = 1, limit = 20, search, userId } = req.query;
  const skip = (page - 1) * limit;

  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID missing in request",
      });
    }

    // Step 1: Find all business IDs for this user
    const userBusinesses = await businessModel.find({ userId }, { _id: 1 });
    const businessIds = userBusinesses.map((b) => b._id);

    // Step 2: Build aggregation pipeline
    const matchStage = {
      $match: {
        businessId: { $in: businessIds },
      },
    };

    const lookupStage = {
      $lookup: {
        from: "businesses",
        localField: "businessId",
        foreignField: "_id",
        as: "business",
      },
    };

    const unwindStage = {
      $unwind: "$business",
    };

    // Enhanced search stage
    const searchStage = search
      ? {
          $match: {
            $or: [
              { "business.businessName": { $regex: search, $options: "i" } },
              { name: { $regex: search, $options: "i" } },
              { email: { $regex: search, $options: "i" } },
              { userContactNumber: { $regex: search, $options: "i" } },
              // If phone number is stored with country code or formatted differently
              { 
                $expr: {
                  $regexMatch: {
                    input: { $toString: "$phone" },
                    regex: search,
                    options: "i"
                  }
                }
              }
            ],
          },
        }
      : null;

    const facetStage = {
      $facet: {
        data: [
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: parseInt(limit) },
          {
            $project: {
              name: 1,
              email: 1,
              phone: 1,
              createdAt: 1,
              "business.businessName": 1,
              // Include other fields you need
            }
          }
        ],
        totalCount: [{ $count: "count" }],
      },
    };

    const pipeline = [matchStage, lookupStage, unwindStage];
    if (searchStage) pipeline.push(searchStage);
    pipeline.push(facetStage);

    // Fixed typo: aggregrate -> aggregate
    const results = await leadModel.aggregate(pipeline);

    const leads = results[0]?.data || [];
    const totalLeads = results[0]?.totalCount[0]?.count || 0;
    const totalPages = Math.ceil(totalLeads / limit);

    res.status(200).json({
      success: true,
      message: "All Leads fetched successfully",
      data: leads,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      totalLeads,
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};



exports.getSingleLeadDetail = async (req, res) => {
  const { leadId } = req.query;

  try {
    const lead = await leadModel.findById(leadId).populate("businessId");

    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Lead fetched successfully",
      data: lead,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getLeadOfYourBussinessByMemberId = async (req, res) => {
  try {
    const {
      businessId,
      adId,
      stage,
      name,
      sortByDate = -1,
      page = 1,
      startDate,
      endDate,
    } = req.query;

    const filter = {};
    const skip = (parseInt(page) - 1) * 20;

    // Basic filters
    if (businessId) filter.businessId = businessId;
    if (adId) filter.adId = adId;
    if (name) {
      const searchRegex = new RegExp(name, "i");
      filter.$or = [
      { name: searchRegex },
      { userContactNumber: searchRegex }
      ];
    }
    if (stage && stage !== "ALL") filter.leadStatus = stage;

    // Date filter - with validation
    if (startDate || endDate) {
      const dateFilter = {};
      
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate format. Please use ISO date format (YYYY-MM-DD)",
          });
        }
        dateFilter.$gte = new Date(start.setHours(0, 0, 0, 0));
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate format. Please use ISO date format (YYYY-MM-DD)",
          });
        }
        dateFilter.$lte = new Date(end.setHours(23, 59, 59, 999));
      }

      filter.createdAt = dateFilter;
    }

    // Sorting
    const sortOptions = sortByDate == 1 ? { createdAt: 1 } : { createdAt: -1 };

	 let fi = {
		 businessId: businessId,
	 }
    // Fetch lead
    const [leads, totalCount, count] = await Promise.all([
      leadModel.find(filter)
        .populate("internalCampiagnId")
        .sort(sortOptions)
       .skip(skip)
       .limit(20),
      leadModel.countDocuments(filter),
      leadModel.countDocuments(fi),
    ]);

    // Attach ad image
    const leadsWithAds = await Promise.all(
      leads.map(async (lead) => {
        return {
          ...lead.toObject(),
          adImage: lead?.internalCampiagnId?.image || lead?.internalCampiagnId?.thambnail || null,
        };
      })
    );

    // Send response
    return res.status(200).json({
      success: true,
      message: "Leads fetched successfully with ad images",
      data: leadsWithAds,
      totalPages: Math.ceil(totalCount / 20),
      currentPage: parseInt(page),
      totalCount,
	  check: count == 0 ? true : false
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Error fetching leads",
    });
  }
};

exports.updateLeadDetails = async (req, res) => {
  const { leadId } = req.query;
  console.log(leadId, "leadId");
  const { followUpDate, note, leadStatus, followUpTime, followUpNote } =
    req.body;
  let leadActivity = await leadModel.findById(leadId);

  if (!leadActivity.rescentActivity) {
    leadActivity.rescentActivity = [];
  }
  leadActivity.rescentActivity.push({
    activity: followUpDate
      ? `Follow Up : ${followUpDate}`
      : note
      ? `Note Update : ${note}`
      : `Lead Status : ${leadStatus}`,
    date: new Date().toISOString(),
  });
  console.log(leadActivity.rescentActivity, "newRescentActivity");
  const updateData = await leadModel.findOneAndUpdate(
    { _id: leadId },
    {
      $set: {
        followUpDate,
        followUpTime,
        followUpNote,
        rescentActivity: leadActivity.rescentActivity,
        note,
        leadStatus,
      },
    },
    {
      new: true,
    }
  );
  // await leadHistoryChangeStatusModel.create({
  //   leadId: updateData._id,
  //   historyType: leadStatus != undefined ? "STATUSCHANGE" : "ACTIONTYPE",
  //   actionType:
  //     followUpDate != undefined ? "FOLLOW_UP_DATE_SET" : "LEAD_CONTACT_CHANGES",
  //   statusChange: leadStatus,
  //   userId: req.user._id,
  // });
  // console.log(updateData);

  return res
    .status(200)
    .send({ success: true, message: "update successfully", data: updateData });
};

// exports.updateLeadDetails = async (req, res) => {

//   const { leadId } = req.query;
//   const {
//     adsetId,
//     adId,
//     name,
//     userContactNumber,
//     whatsappNumber,
//     email,
//     followUpDate,
//     note,
//     leadStatus,
//   } = req.body;
//   const updateData = await leadModel.findOneAndUpdate(
//     { _id: leadId },
//     {
//       $set: {
//         adsetId:adsetId,
//         adId:adId,
//         name:name,
//         userContactNumber:userContactNumber,
//         whatsappNumber:whatsappNumber,
//         email:email,
//         followUpDate:followUpDate,
//         note:note,
//         leadStatus:leadStatus,
//       },
//     },
//     {
//       new:true
//     }
//   );
//   return res.status(200).send({success:true,message:"update successfully",data:updateData})
// };

//  changes

exports.getLeadDetails = async (req, res) => {
  const { leadId } = req.query;
  const leadExists = await leadModel.findById(leadId);
  return res.status(200).json({
    success: true,
    message: "Get Lead Details",
    data: leadExists,
  });
};

exports.updateLeadSeenStatus = async (req, res) => {
  const { leadId } = req.query;

  try {
    const find = await leadModel.findOne({_id:leadId,seen:true});
    if(!find){
      let rescentActivity = [];
      rescentActivity.push({
        activity: "Lead Seen",
        date: new Date().toISOString(),
      });
      var updatedLead = await leadModel.findByIdAndUpdate(
        leadId,
        { $set: { seen: true, rescentActivity } },
        { new: true }
      );
    }
 



    return res.status(200).json({
      success: true,
      message: "Lead seen status updated successfully",
      data: updatedLead ? updatedLead : find ,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.uploadLeadDocument = async (req, res) => {
  const { leadId, type, index } = req.body;

  try {
    const lead = await leadModel.findById(leadId);
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    // Ensure document array exists
    if (!Array.isArray(lead.document)) {
      lead.document = [];
    }

    if (type === "ADD") {
      // Handle file upload
      const file = req.file;
      if (!file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded",
        });
      }
      // Save file information to lead document
      lead.document.push(file.location);
      await lead.save();

      return res.status(200).json({
        success: true,
        message: "Document uploaded successfully",
        data: lead,
      });
    } else if (type === "REMOVE") {
      // Remove document at given index
      if (
        typeof index === "undefined" ||
        !lead.document[index]
      ) {
        return res.status(400).json({
          success: false,
          message: "Document not found at given index",
        });
      }
      lead.document.splice(index, 1);
      await lead.save();

      return res.status(200).json({
        success: true,
        message: "Document removed successfully",
        data: lead,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Use 'ADD' or 'REMOVE'.",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



const XLSX = require("xlsx");
const stream = require("stream");
const { s3Client } = require("../middlewares/multer");

exports.getLeadOfYourBusinessByMemberIdExcel = async (req, res) => {
  try {
    const {
      businessId,
      adId,
      stage,
      name,
      sortByDate = -1,
      startDate,
      endDate,
    } = req.query;

    const filter = {};

    // Basic filters
    if (businessId) filter.businessId = businessId;
    if (adId) filter.adId = adId;
    if (name) {
      const searchRegex = new RegExp(name, "i");
      filter.$or = [
        { name: searchRegex },
        { userContactNumber: searchRegex },
      ];
    }
    if (stage && stage !== "ALL") filter.leadStatus = stage;

    // Date filter - with validation
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid startDate format. Please use ISO date format (YYYY-MM-DD)",
          });
        }
        dateFilter.$gte = new Date(start.setHours(0, 0, 0, 0));
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            success: false,
            message: "Invalid endDate format. Please use ISO date format (YYYY-MM-DD)",
          });
        }
        dateFilter.$lte = new Date(end.setHours(23, 59, 59, 999));
      }
      filter.createdAt = dateFilter;
    }

    // Sorting
    const sortOptions = sortByDate == 1 ? { createdAt: 1 } : { createdAt: -1 };

    let fi = { businessId: businessId };

    // Fetch all leads
    const [leads, totalCount, count] = await Promise.all([
      leadModel
        .find(filter)
        .populate("internalCampiagnId")
        .sort(sortOptions),
      leadModel.countDocuments(filter),
      leadModel.countDocuments(fi),
    ]);

    if (!leads.length) {
      return res.status(404).json({ success: false, message: "No leads found" });
    }

    // Prepare flat data for Excel/CSV
    const flatData = leads.map((lead) => ({
      name: lead.name || "N/A",
      userContactNumber: lead.userContactNumber || "N/A",
      leadStatus: lead.leadStatus || "N/A",
      createdAt: lead.createdAt ? new Date(lead.createdAt).toISOString() : "N/A",
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(flatData);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Leads");

    // Write buffer for Excel
    const excelBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const csvData = XLSX.utils.sheet_to_csv(worksheet);

    const timestamp = Date.now();
    const excelKey = `exports/leads_${timestamp}.xlsx`;
    const csvKey = `exports/leads_${timestamp}.csv`;

    const bucket = process.env.LINODE_BUCKET_NAME || "leadkart";

    // Upload Excel to Linode S3
    const excelUpload = s3Client.upload({
      Bucket: bucket,
      Key: excelKey,
      Body: excelBuffer,
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ACL: "public-read",
    }).promise();

    // Upload CSV to Linode S3
    const csvStream = new stream.PassThrough();
    csvStream.end(Buffer.from(csvData));

    const csvUpload = s3Client.upload({
      Bucket: bucket,
      Key: csvKey,
      Body: csvStream,
      ContentType: "text/csv",
      ACL: "public-read",
    }).promise();

    const [excelResult, csvResult] = await Promise.all([excelUpload, csvUpload]);

    return res.status(200).json({
      success: true,
      message: "Files uploaded to S3 successfully",
      excelDownloadUrl: excelResult.Location,
      csvDownloadUrl: csvResult.Location,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error generating or uploading files",
      error: error.message,
    });
  }
};
