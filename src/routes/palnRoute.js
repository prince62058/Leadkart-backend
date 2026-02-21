const express = require("express");
const controller = require("../controller/planController");
const router = express.Router();
const { planMid } = require("../middelwares/planMidd");
const { authUser } = require("../middelwares/authMidd");

router.post(
  "/plan/createPlan",
  authUser,
  controller.createPlan
);
router.get(
  "/plan/getAllPlan",
  authUser,
  controller.getAllPlan
);

router.get(
  "/plan/getSinglePlan/:planId",
  authUser,
  planMid,
  controller.getSinglePlan
);
router.put(
  "/plan/updatePlan/:planId",
  authUser,
  planMid,
  controller.updatePlan
);
router.put(
"/plan/disablePlan/:planId",
  authUser,
  planMid,
  controller.disablePlan
);

module.exports = router;
