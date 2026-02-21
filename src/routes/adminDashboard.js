
const express = require("express");
const controller = require("../controllers/adminDashboard");
const router = express.Router();

router.get('/DashBoardApiAdmin',controller.DashBoardApiAdmin)
router.get('/dashBoardGraphsAndCharts',controller.dashBoardGraphsAndCharts)
router.get('/userListForAdmin',controller.userListForAdmin)
router.get('/adListForAdmin',controller.adListForAdmin)
router.get('/adbyIdForAdmin',controller.adbyIdForAdmin)
router.get('/permanentToken',controller.permanentToken)
router.get('/getAdsWithErrors',controller.getAdsWithErrors)
router.get('/getAdsWithErrorsByid',controller.getAdsWithErrorsByid)
module.exports = router;
