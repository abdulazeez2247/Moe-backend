const { stripe } = require("../config/payment");
const User = require("../models/User");
const Payment = require("../models/Payment");

const createSubscription = async (req, res, next) => {
  try {
    const { plan, paymentMethodId } = req.body;

    const priceIds = {
      free: process.env.STRIPE_PRICE_FREE,
      hobbyist: process.env.STRIPE_PRICE_HOBBY,
      occasional: process.env.STRIPE_PRICE_OCC,
      professional: process.env.STRIPE_PRICE_PRO,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    };

    const planPrices = {
      free: 0,
      hobbyist: 900,
      occasional: 2000,
      professional: 2900,
      enterprise: 14900,
    };

    if (!priceIds[plan]) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid plan selected",
      });
    }

    if (plan === "free") {
      await User.findByIdAndUpdate(req.user.id, {
        plan,
        subscriptionStatus: "active",
      });

      return res.status(200).json({
        status: "success",
        message: "Free plan activated successfully",
      });
    }

    let customer = await stripe.customers.list({
      email: req.user.email,
      limit: 1,
    });

    if (customer.data.length === 0) {
      customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          userId: req.user.id.toString(),
        },
      });
    } else {
      customer = customer.data[0];
    }

    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customer.id,
    });

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceIds[plan] }],
      expand: ["latest_invoice.payment_intent"],
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        userId: req.user.id.toString(),
        plan: plan,
      },
    });

    const paymentIntent = subscription.latest_invoice.payment_intent;

    if (paymentIntent.status === "requires_action") {
      return res.status(200).json({
        status: "requires_action",
        client_secret: paymentIntent.client_secret,
        message: "3D Secure authentication required",
      });
    }

    if (paymentIntent.status !== "succeeded") {
      return res.status(400).json({
        status: "fail",
        message: `Payment failed: ${paymentIntent.status}`,
      });
    }

    await User.findByIdAndUpdate(req.user.id, {
      plan,
      customerId: customer.id,
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
    });

    await Payment.create({
      user: req.user.id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customer.id,
      stripePaymentIntentId: paymentIntent.id,
      plan,
      amount: planPrices[plan],
      currency: "usd",
      status: "completed",
      type: "subscription",
    });

    res.status(200).json({
      status: "success",
      message: "Subscription created successfully",
      subscriptionId: subscription.id,
    });
  } catch (error) {
    console.error("Subscription error:", error);

    if (error.type === "StripeCardError") {
      return res.status(400).json({
        status: "fail",
        message: error.message,
      });
    }

    next(error);
  }
};

const createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, currency = "usd", metadata = {} } = req.body;

    if (process.env.NODE_ENV === "production") {
      if (amount < 50) {
        return res.status(400).json({
          status: "fail",
          message: "Amount must be at least $0.50",
        });
      }
      if (amount > 9999999) {
        return res.status(400).json({
          status: "fail",
          message: "Amount exceeds maximum limit",
        });
      }
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found",
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        userId: req.user.id.toString(),
        userEmail: user.email,
        userName: user.name || "Customer",
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      description: `Payment for ${metadata.productName || "product"} by ${
        user.email
      }`,
      receipt_email:
        process.env.NODE_ENV === "production" ? user.email : undefined,
      statement_descriptor:
        process.env.NODE_ENV === "production" ? "YOURCOMPANY" : "TESTCOMPANY",
      statement_descriptor_suffix: metadata.productName
        ? metadata.productName.substring(0, 12)
        : "PRODUCT",
    });

    console.log(
      `PaymentIntent created: ${paymentIntent.id} for user: ${
        user.email
      }, amount: ${amount / 100} ${currency}`
    );

    res.status(200).json({
      status: "success",
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      metadata: paymentIntent.metadata,
    });
  } catch (error) {
    console.error("PaymentIntent creation error:", error);

    if (error.type === "StripeInvalidRequestError") {
      return res.status(400).json({
        status: "fail",
        message: "Invalid payment request",
        code: error.code,
        param: error.param,
      });
    }

    next(error);
  }
};

const confirmPaymentIntent = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

    if (
      ["succeeded", "processing", "requires_action"].includes(
        paymentIntent.status
      )
    ) {
      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntent.id },
        {
          user: req.user.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: paymentIntent.status,
          type: "one_time",
          metadata: paymentIntent.metadata,
          clientIp: req.ip,
          userAgent: req.get("User-Agent"),
        },
        { upsert: true, new: true }
      );
    }

    if (paymentIntent.status === "requires_action") {
      return res.status(200).json({
        status: "requires_action",
        client_secret: paymentIntent.client_secret,
        message: "3D Secure authentication required",
      });
    }

    res.status(200).json({
      status: "processing",
      message: "Payment is being processed",
      paymentStatus: paymentIntent.status,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Payment confirmation error:", error);

    if (error.type === "StripeCardError") {
      return res.status(400).json({
        status: "fail",
        message: "Payment failed. Please check your card details.",
        decline_code: error.decline_code,
        code: error.code,
      });
    }

    next(error);
  }
};

const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;

    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId);

    if (paymentIntent.status === "succeeded") {
      const subscription = await stripe.subscriptions.retrieve(
        paymentIntent.metadata.subscription_id
      );

      await User.findByIdAndUpdate(subscription.metadata.userId, {
        subscriptionStatus: "active",
      });

      await Payment.findOneAndUpdate(
        { stripePaymentIntentId: paymentIntentId },
        { status: "completed" }
      );

      return res.status(200).json({
        status: "success",
        message: "Payment confirmed successfully",
      });
    }

    res.status(400).json({
      status: "fail",
      message: `Payment status: ${paymentIntent.status}`,
    });
  } catch (error) {
    next(error);
  }
};

const handleWebhook = async (req, res, next) => {
  let event;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const sig = req.headers["stripe-signature"];

    if (!webhookSecret) {
      console.error("Webhook secret not configured");
      return res.status(500).json({ error: "Webhook not configured" });
    }

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log("Webhook received:", event.type, "ID:", event.id);

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;
      case "payment_intent.requires_action":
        await handlePaymentIntentRequiresAction(event.data.object);
        break;
      case "charge.succeeded":
        await handleChargeSucceeded(event.data.object);
        break;
      case "charge.failed":
        await handleChargeFailed(event.data.object);
        break;
      case "payment_intent.amount_capturable_updated":
        await handlePaymentIntentCapture(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true, event: event.type });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

const handlePaymentIntentSucceeded = async (paymentIntent) => {
  console.log(
    `💰 Payment succeeded: ${paymentIntent.id}, Amount: ${
      paymentIntent.amount / 100
    }`
  );

  const updateData = {
    status: "completed",
    completedAt: new Date(),
    stripeChargeId: paymentIntent.charges?.data[0]?.id,
    amount: paymentIntent.amount_received || paymentIntent.amount,
  };

  await Payment.findOneAndUpdate(
    { stripePaymentIntentId: paymentIntent.id },
    updateData,
    { upsert: true, new: true }
  );

  console.log(
    ` Payment ${paymentIntent.id} completed for user: ${paymentIntent.metadata.userEmail}`
  );
};

const handlePaymentIntentFailed = async (paymentIntent) => {
  console.log(` Payment failed: ${paymentIntent.id}`);

  await Payment.findOneAndUpdate(
    { stripePaymentIntentId: paymentIntent.id },
    {
      status: "failed",
      failure_message: paymentIntent.last_payment_error?.message,
      failure_code: paymentIntent.last_payment_error?.code,
      decline_code: paymentIntent.last_payment_error?.decline_code,
    },
    { upsert: true, new: true }
  );
};

const handlePaymentIntentRequiresAction = async (paymentIntent) => {
  console.log(` Payment requires action: ${paymentIntent.id}`);

  await Payment.findOneAndUpdate(
    { stripePaymentIntentId: paymentIntent.id },
    { status: "requires_action" },
    { upsert: true, new: true }
  );
};

const handleChargeSucceeded = async (charge) => {
  console.log(` Charge succeeded: ${charge.id}`);
};

const handleChargeFailed = async (charge) => {
  console.log(` Charge failed: ${charge.id}`);
};

const handlePaymentIntentCapture = async (paymentIntent) => {
  console.log(` Payment requires capture: ${paymentIntent.id}`);
};

const handleSubscriptionUpdated = async (subscription) => {
  const user = await User.findOne({ subscriptionId: subscription.id });
  if (user) {
    user.subscriptionStatus = subscription.status;
    await user.save();

    await Payment.findOneAndUpdate(
      { stripeSubscriptionId: subscription.id },
      { status: subscription.status }
    );
  }
};

const handleInvoicePaymentFailed = async (invoice) => {
  const customerUser = await User.findOne({ customerId: invoice.customer });
  if (customerUser) {
    customerUser.subscriptionStatus = "past_due";
    await customerUser.save();

    await Payment.create({
      user: customerUser._id,
      stripeCustomerId: invoice.customer,
      stripeInvoiceId: invoice.id,
      plan: customerUser.plan,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: "failed",
      type: "invoice",
    });
  }
};

const handleInvoicePaymentSucceeded = async (successfulInvoice) => {
  const successfulUser = await User.findOne({
    customerId: successfulInvoice.customer,
  });
  if (successfulUser) {
    await Payment.create({
      user: successfulUser._id,
      stripeCustomerId: successfulInvoice.customer,
      stripeInvoiceId: successfulInvoice.id,
      plan: successfulUser.plan,
      amount: successfulInvoice.amount_paid,
      currency: successfulInvoice.currency,
      status: "completed",
      type: "invoice",
    });
  }
};

const handleSubscriptionDeleted = async (deletedSubscription) => {
  const deletedUser = await User.findOne({
    subscriptionId: deletedSubscription.id,
  });
  if (deletedUser) {
    deletedUser.subscriptionStatus = "canceled";
    await deletedUser.save();
  }
};

module.exports = {
  createSubscription,
  createPaymentIntent,
  confirmPaymentIntent,
  confirmPayment,
  handleWebhook,
};
