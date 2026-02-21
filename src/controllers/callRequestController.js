const callRequestModel = require("../models/callRequestModel");
const userModel   = require("../models/userModel");
const cron = require('node-cron');

exports.createCall = async(req,res)=>{
    const {userId} = req.body;
    try{
      const user = await userModel.findById(userId);
      if(!user){
        res.status(404).json({
            success:false,
            message:"User not found !"
        })
      }
      if(user.callRequest==true){
        return res.status(429).json({
          success:false,
          message:"You have already used it today. Try again after 12 AM."
        })
      }
      const data = await callRequestModel.create({userId});
	  await userModel.findByIdAndUpdate(userId, {callRequest:true}, {new:true});
       res.status(201).json({
        success:true,
        message:"Create Call is successfuly",
        data:data
       })

    }catch(error){
        res.status(500).json({
            success:false,
            message:error.message
        })
    }
}
exports.listCallRequest = async(req,res)=>{
   const {page =1, limit =20, userId, sort=-1} = req.query;
   const skip = (page-1)*limit;
   const filter = {
    ...(userId && {userId})
   }
  try{
    const data = await callRequestModel.find(filter).populate("userId").sort({createdAt:parseInt(sort)}).skip(skip).limit(limit);
     const total = await callRequestModel.countDocuments(filter);
     res.status(200).json({
        success:true,
        message:"Call Request List is fetched",
        data:data,
        currentPage:page,
        page: Math.ceil(total/limit)
     })
  }catch(error){
    res.status(500).json({
        success:false,
        message:error.message
    })
  }
}
exports.updateCallRequestStatus = async(req,res)=>{
  const {callRequestId} = req.query;
  const {status} = req.body;
  try{
   const call = await callRequestModel.findById(callRequestId);
   if(!call){
    return res.status(404).json({
      success:false,
      message:"callRequestId not found"
    })
   }

   const data = await callRequestModel.findByIdAndUpdate({_id:callRequestId}, {status:status}, {new:true});
   res.status(201).json(
    {
      success:true,
      message:"Status Update Successfully",
      data:data
    }
   )

  }catch(error){
    res.status(500).json({
      success:false,
      message:error.message
    })
  }
}


exports.pushFollowUp = async (req, res) => {
  const { callId } = req.query;
  const { scheduledTime, notes } = req.body;

  if (!scheduledTime) {
    return res.status(400).json({ message: 'scheduledTime is required.' });
  }

  const updatedCallRequest = await callRequestModel.findByIdAndUpdate(
    callId,
    {
      $push: {
        followUps: {
          scheduledTime,
          notes
        }
      }
    },
    { new: true, runValidators: true }
  );

  if (!updatedCallRequest) {
    return res.status(404).json({ message: 'Call Request not found.' });
  }

  res.status(200).json({
    message: 'Follow-up added successfully.',
    data: updatedCallRequest
  });
};



const resetCallRequests = async () => {
  try {
      await userModel.updateMany({}, { $set: { callRequest: false } });
      console.log('Successfully reset callRequest for all users');
  } catch (error) {
      console.error('Error resetting callRequest:', error);
  }
};

// Schedule the function to run every day at 12:00 AM
cron.schedule('0 0 * * *', () => {
  console.log('Running resetCallRequests at 12:00 AM IST');
  resetCallRequests();
}, {
  timezone: 'Asia/Kolkata'
});