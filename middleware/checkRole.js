const Account = require("../models/userModel");

async function checkRole(_id) {
    const account = await Account.findById(_id);
    return account.role;
}
async function landlordRole(req, res, next) {
    const role = await checkRole(req.user._id);
    if (role === "Landlord") {
        req.role = role;
        return next();
    }
    return res.status(401).json({
        title: "không đủ quyền",
        message: "Bạn không không phải là Landlord",
    });
}

module.exports = landlordRole;