const User = require("../models/User");

const getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      status: "success",
      data: {
        user,
        assistantMessageCount: user.assistantMessageCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateUserProfile = async (req, res, next) => {
  try {
    const { seesAds } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { seesAds },
      { new: true, runValidators: true }
    );
    res.status(200).json({
      status: "success",
      data: {
        user: updatedUser,
        assistantMessageCount: updatedUser.assistantMessageCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getUsage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      status: "success",
      data: {
        dailyUsed: user.dailyUsed,
        dailyLimit: process.env.FREE_DAILY_LIMIT || 5,
        monthlyUsed: user.monthlyUsed,
        monthlyLimit:
          user.plan === "free"
            ? (process.env.FREE_DAILY_LIMIT || 5) * 30
            : getPlanLimit(user.plan),
        plan: user.plan,
        assistantMessageCount: user.assistantMessageCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

function getPlanLimit(plan) {
  const limits = {
    hobby: process.env.HOBBY_MONTHLY_LIMIT || 100,
    occ: process.env.OCC_MONTHLY_LIMIT || 300,
    pro: process.env.PRO_MONTHLY_LIMIT || 600,
    ent: process.env.ENT_MONTHLY_LIMIT || 5000,
  };
  return limits[plan] || 0;
}

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUsage,
};
