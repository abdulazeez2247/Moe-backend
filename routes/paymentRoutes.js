const express = require("express");
const {
  createSubscription,
  confirmPayment,
  handleWebhook,
  createPaymentIntent,
  confirmPaymentIntent,
} = require("../controllers/paymentController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/create-subscription", protect, createSubscription);
router.post("/confirm-payment", protect, confirmPayment);
router.post("/create-payment-intent", protect, createPaymentIntent);
router.post("/confirm-payment-intent", protect, confirmPaymentIntent);

router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

module.exports = router;
