import Reviews from "../models/reviewModel.js";
import Estate from "../models/estateModel.js";

class APIfeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  paginating() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 9;
    const skip = (page - 1) * limit;
    this.query = this.query.skip(skip).limit(limit);
    return this;
  }
}

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
  getUserReviews: async (req, res) => {
    try {
      const userId = req.params.id;

      const features = new APIfeatures(
        Reviews.find({ user: userId }),
        req.query
      ).paginating();

      const reviews = await features.query
        .sort("-createdAt")
        .populate("user", "avatar full_name email")
        .populate({
          path: "estateId",
          select: "name address images property price",
          model: "estate",
        });

      res.json({
        msg: "Success!",
        result: reviews.length,
        reviews,
      });
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
