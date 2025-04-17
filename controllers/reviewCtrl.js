import Reviews from "../models/reviewModel.js";
import Estate from "../models/estateModel.js";

const reviewCtrl = {
  createReview: async (req, res) => {
    try {
      const { estateId, content, star, images, estateUserId } = req.body;

      const estate = await Estate.findById(estateId);
      if (!estate)
        return res.status(400).json({ msg: "This estate does not exist." });

      const newReview = new Reviews({
        user: req.user._id,
        content,
        star,
        images,
        estateUserId,
        estateId,
      });

      await Estate.findOneAndUpdate(
        { _id: estateId },
        {
          $push: { reviews: newReview._id },
        },
        { new: true }
      );

      await newReview.save();

      res.json({ newReview });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  updateReview: async (req, res) => {
    try {
      const { content } = req.body;

      await Reviews.findOneAndUpdate(
        {
          _id: req.params.id,
          user: req.user._id,
        },
        { content }
      );

      res.json({ msg: "Update Success!" });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  deleteReview: async (req, res) => {
    try {
      const review = await Reviews.findOneAndDelete({
        _id: req.params.id,
        $or: [{ user: req.user._id }, { estateUserId: req.user._id }],
      });

      await Estate.findOneAndUpdate(
        { _id: review.estateId },
        {
          $pull: { reviews: req.params.id },
        }
      );

      res.json({ msg: "Deleted Review!" });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default reviewCtrl;
