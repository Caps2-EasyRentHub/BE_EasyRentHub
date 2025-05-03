import { checkRole } from "./checkRole.js";

const manageAccountStatus = async (req, res, next) => {
  try {
    const role = await checkRole(req.user._id);
    const targetUserId = req.params.id;

    if (role === "Admin") {
      return next();
    }

    if (
      (role === "Tenant" || role === "Landlord") &&
      req.user._id.toString() === targetUserId
    ) {
      if (req.body.status === 0) {
        return res.status(403).json({
          title: "Không được phép",
          message:
            "Bạn không thể tự khóa tài khoản của mình. Vui lòng liên hệ Admin để được hỗ trợ.",
        });
      }
      return next();
    }

    return res.status(403).json({
      title: "Không đủ quyền",
      message: "Bạn không có quyền quản lý trạng thái tài khoản",
    });
  } catch (error) {
    return res.status(500).json({ msg: error.message });
  }
};

export default manageAccountStatus;
