const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId

const callRequestModel = new mongoose.Schema({
   userId:{
       type:ObjectId,
       ref:'userModel'
    },
    status: {
        type: String,
        enum: ["Pending", "Completed", "No Response", "Busy", "Scheduled"],
        default: "Pending"
    },
    followUps: [{
        scheduledTime: {
            type: String,
        },
        notes: String
    }]
 
},
{timestamps:true})

module.exports = mongoose.model('CallRequest',callRequestModel);