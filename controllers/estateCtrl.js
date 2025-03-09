import Estate from "../models/estateModel.js";
import Review from "../models/reviewModel.js";

const estateCtrl = {
  createEstate: async (req, res) => {
    try {
      const { name, listType, images, address, price, property } = req.body;

      if (images.length === 0)
        return res.status(400).json({ msg: "Please add your photo." });

      const newEstate = new Estate({
        name,
        listType,
        images,
        address,
        price,
        property,
        status: 0,
        user: req.user._id,
      });
      await newEstate.save();

      res.json({
        msg: "Created Estate!",
        newEstate: {
          ...newEstate._doc,
          user: req.user,
        },
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  updateEstate: async (req, res) => {
    try {
      const { name, listType, images, address, price, property } = req.body;

      const estate = await Estate.findOneAndUpdate(
        { _id: req.params.id },
        {
          name,
          listType,
          images,
          address,
          price,
          property,
        }
      )
        .populate("user likes", "avatar full_name", "users")
        .populate({
          path: "reviews",
          populate: {
            path: "user likes",
            select: "-password",
            model: "users",
          },
        });

      res.json({
        msg: "Updated Estate!",
        newEstate: {
          ...estate._doc,
          name,
          listType,
          images,
          address,
          price,
          property,
        },
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  deleteEstate: async (req, res) => {
    try {
      const estate = await Estate.findOneAndDelete({
        _id: req.params.id,
        user: req.user._id,
      });

      res.json({
        msg: "Deleted Estate!",
        newEstate: {
          ...estate,
          user: req.user,
        },
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  getEstate: async (req, res) => {
    try {
      const estate = await Estate.findById(req.params.id)
        .populate("user likes", "avatar full_name address", "users")
        .populate({
          path: "reviews",
          populate: {
            path: "user likes",
            select: "-password",
            model: "users",
          },
        });

      if (!estate)
        return res.status(400).json({ msg: "This estate does not exist." });

      res.json({
        estate,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default estateCtrl;
