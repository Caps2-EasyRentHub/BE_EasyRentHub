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
      // Fetch all users, excluding password field
      const users = await Users.find().select("-password");
      
      // Get estate counts for each user
      const usersWithEstateCounts = await Promise.all(
        users.map(async (user) => {
          const estates = await Estates.find({ user: user._id });
          return {
            ...user._doc,
            estateCount: estates.length
          };
        })
      );
      
      res.json(usersWithEstateCounts);
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  }
};

export default userCtrl;