import Users from "../models/userModel.js";
import Estates from "../models/estateModel.js";

const userCtrl = {
  getUser: async (req, res) => {
    try {
      const user = await Users.findById(req.params.id).select("-password");
      const estates = await Estates.find({ user: req.params.id });

      if (!user) return res.status(400).json({ msg: "User does not exist." });

      res.json({ user, lengthEstates: estates.length });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  getAllUsers: async (req, res) => {
    try {
      const users = await Users.find().select("-password");
      res.status(200).json(users);
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default userCtrl;
