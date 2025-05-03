import Users from "../models/userModel.js";
import jwt from "jsonwebtoken";

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");

    if (!token) return res.status(400).json({ msg: "Invalid Authentication." });

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (!decoded)
      return res.status(400).json({ msg: "Invalid Authentication." });

    const user = await Users.findOne({ _id: decoded.id });
    if (!user) return res.status(400).json({ msg: "User does not exist." });

    if (user.status === 0) {
      return res.status(403).json({
        msg: "Tài khoản đã bị khóa. Vui lòng liên hệ với quản trị viên để được hỗ trợ.",
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ msg: "Invalid Authentication." });
  }
};

export default auth;
