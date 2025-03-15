import RentalHistory from "../models/rentalHistoryModel.js";
import Estate from "../models/estateModel.js";
import Users from "../models/userModel.js";

const rentalHistoryCtrl = {
    createRentalHistory: async (req, res) => {
        try {
          const { estateId, startDate, rentalPrice } = req.body;
    
          if (!estateId || !startDate || !rentalPrice) {
            return res.status(400).json({ msg: "Please provide all required fields." });
          }
    
          const estate = await Estate.findById(estateId);
          if (!estate) {
            return res.status(404).json({ msg: "Estate not found." });
          }
    
          const newRentalHistory = new RentalHistory({
            estate: estateId,
            tenant: req.user._id, 
            landlord: estate.user, 
            estateName: estate.name,
            address: estate.address,
            property: estate.property,
            images: estate.images,
            startDate,
            rentalPrice,
          });
          
          await newRentalHistory.save();
          
          res.json({
            msg: "Rental history created successfully!",
            rentalHistory: newRentalHistory,
          });
        } catch (err) {
          return res.status(500).json({ msg: err.message });
        }
      },

  getRentalHistoryForLandlord: async (req, res) => {
    try {      
      if (req.user.role !== "Landlord") {
        return res.status(403).json({ msg: "Bạn không có quyền truy cập." });
      }
      
      const estates = await Estate.find({ user: req.user._id });

      const rentalHistories = await RentalHistory.find({
        estate: { $in: estates.map((estate) => estate._id) },
      })
        .populate("tenant", "full_name email") 
        .populate("estate", "name"); 

      res.json({
        msg: "Lịch sử cho thuê đã được lấy thành công!",
        rentalHistories,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default rentalHistoryCtrl;
