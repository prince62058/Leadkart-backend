const express = require("express");
const controller = require("../controllers/commpanyController");
const {getCompany,updateCompany,toggleMaintenance} = require("../controllers/companyControllerV2");
const router = express.Router();
const { upload } = require("../middlewares/multer");

router.post(
  "/createOrUpdateCompany",
  upload.fields([
    { name: "logo" },
    { name: "banner" }
  ]),
  controller.createOrUpdateCompany
);
router.get('/getCompany',controller.getCompany)

//  V2

router.post(
  "/updateCompany",
  upload.fields([
    { name: "favicon" },
    { name: "logo" }
  ]),
  updateCompany
);
router.get('/getNewCompany',getCompany)
router.put('/toggleMaintenance',toggleMaintenance)
module.exports = router;
