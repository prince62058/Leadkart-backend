const {createCall, listCallRequest, updateCallRequestStatus, pushFollowUp} = require("../controllers/callRequestController");
const express = require("express");
const { userMid } = require("../middlewares/userMidd");
const { authUser } = require("../middlewares/authMidd");
const router = express.Router();

router.post("/createCall/:userId",userMid, createCall)
router.get("/listCallRequest",listCallRequest)
router.put("/updateCallRequestStatus",updateCallRequestStatus)
router.put("/pushFollowUp",pushFollowUp)
module.exports = router;