import Account from "../models/userModel.js";

async function checkRole(_id) {
  const account = await Account.findById(_id);
  return account.role;
}

export async function landlordRole(req, res, next) {
  const role = await checkRole(req.user._id);
  if (role === "Landlord") {
    req.role = role;
    return next();
  }
  return res.status(401).json({
    title: "Unauthorized",
    message: "You are not a Landlord",
  });
}

export async function adminRole(req, res, next) {
  const role = await checkRole(req.user._id);
  if (role === "Admin") {
    req.role = role;
    return next();
  }
  return res.status(401).json({
    title: "Unauthorized",
    message: "Admin access only",
  });
}
