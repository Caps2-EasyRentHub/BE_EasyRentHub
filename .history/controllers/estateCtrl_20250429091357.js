import Estate from "../models/estateModel.js";
import Review from "../models/reviewModel.js";
import Users from "../models/userModel.js";

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

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversine(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.pow(Math.sin(dLat / 2), 2) +
    Math.pow(Math.sin(dLon / 2), 2) *
      Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2));
  const c = 2 * Math.asin(Math.sqrt(a));
  const distance = earthRadius * c;

  return distance;
}

const estateCtrl = {
  createEstate: async (req, res) => {
    try {
      const { name, images, address, price, property } = req.body;

      if (req.user.role != "Landlord") {
        return res
          .status(403)
          .json({ msg: "Only landlord can create booking request." });
      }

      if (images.length === 0)
        return res.status(400).json({ msg: "Please add your photo." });

      const newEstate = new Estate({
        name,
        images,
        address,
        price,
        property,
        status: "available",
        user: req.user._id,
      });
      await newEstate.save();

      res.json({
        msg: "Created Estate!",
        newEstate: {
          ...newEstate._doc,
          user: req.user._id,
        },
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  getEstates: async (req, res) => {
    try {
      const features = new APIfeatures(Estate.find({}), req.query).paginating();

      const estates = await features.query
        .sort("price")
        .populate("user likes", "avatar full_name")
        .populate({
          path: "reviews",
          populate: {
            path: "user",
            select: "-password",
          },
        });

      res.json({
        msg: "Success!",
        result: estates.length,
        estates,
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
        .populate("user likes", "avatar full_name")
        .populate({
          path: "reviews",
          populate: {
            path: "user",
            select: "-password",
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
      await Review.deleteMany({ _id: { $in: estate.reviews } });

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
        .populate("user likes", "avatar full_name address")
        .populate({
          path: "reviews",
          populate: {
            path: "user",
            select: "-password",
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
  getRecommend: async (req, res) => {
    try {
      let totalDistance = 0;
      const arr = [];
      const estates = await Estate.find();
      const user = await Users.findById(req.params.id);
      const estate = await Estate.findById(req.params.id);
      let addressUser = "";
      if (user === null) {
        addressUser = estate.address;
      } else {
        addressUser = user.address;
      }

      for (let item of estates) {
        if (
          addressUser.lng &&
          addressUser.lat &&
          item.address.lng &&
          item.address.lat
        ) {
          await fetch(
            `https://router.project-osrm.org/route/v1/driving/${addressUser.lng},${addressUser.lat};${item.address.lng},${item.address.lat}?overview=full&geometries=geojson`
          )
            .then((res) => {
              return res.json();
            })
            .then((res) => {
              if (res.code === "Ok") {
                totalDistance = 0;
                const coords = res.routes[0].geometry.coordinates;

                for (let i = 0; i < coords.length - 1; i++) {
                  let p1 = coords[i];
                  let p2 = coords[i + 1];

                  let distance = haversine(p1[1], p1[0], p2[1], p2[0]);

                  totalDistance += distance;
                }

                item.distance = totalDistance.toFixed(2);
                if (totalDistance < 100000) {
                  arr.push(item);
                }
              }
            })
            .catch(function (err) {
              console.log("Unable to fetch -", err);
            });
        }
      }
      arr.sort((a, b) => {
        return a.distance - b.distance;
      });
      res.json({
        msg: "Success!",
        result: arr.length,
        estates: arr,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  likeEstate: async (req, res) => {
    try {
      const estate = await Estate.find({
        _id: req.params.id,
        likes: req.user._id,
      });
      if (estate.length > 0)
        return res.status(400).json({ msg: "You liked this Estate." });

      const like = await Estate.findOneAndUpdate(
        { _id: req.params.id },
        {
          $push: { likes: req.user._id },
        },
        { new: true }
      );

      if (!like)
        return res.status(400).json({ msg: "This post does not exist." });

      res.json({ msg: "Liked Estate!" });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  unLikeEstate: async (req, res) => {
    try {
      const like = await Estate.findOneAndUpdate(
        { _id: req.params.id },
        {
          $pull: { likes: req.user._id },
        },
        { new: true }
      );

      if (!like)
        return res.status(400).json({ msg: "This estate does not exist." });

      res.json({ msg: "UnLiked Estate!" });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  getUserEstates: async (req, res) => {
    try {
      const features = new APIfeatures(
        Estate.find({ user: req.params.id }),
        req.query
      ).paginating();
      const estates = await features.query.sort("-createdAt");

      res.json({
        estates,
        result: estates.length,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  getLikeEstates: async (req, res) => {
    try {
      const features = new APIfeatures(
        Estate.find({
          likes: { $in: req.user },
        }),
        req.query
      ).paginating();

      const likeEstates = await features.query.sort("-createdAt");
      res.json({
        likeEstates,
        result: likeEstates.length,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  searchEstates: async (req, res) => {
    try {
      const name = req.query.name || "";
      const estates = await Estate.find({
        name: { $regex: name },
      }).limit(10);
      res.json({ estates });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  searchEstatesByAuthor: async (req, res) => {
    try {
      const authorName = req.query.authorName || "";
      
      // Find users matching the author name
      const users = await Users.find({
        full_name: { $regex: authorName, $options: 'i' }
      }).select('_id');
      
      // Get user IDs
      const userIds = users.map(user => user._id);
      
      // Find estates created by these users
      const features = new APIfeatures(
        Estate.find({ user: { $in: userIds } }),
        req.query
      ).paginating();
      
      const estates = await features.query
        .sort("-createdAt")
        .populate("user likes", "avatar full_name")
        .populate({
          path: "reviews",
          populate: {
            path: "user",
            select: "-password",
          },
        });
      
      res.json({
        msg: "Success!",
        result: estates.length,
        estates,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default estateCtrl;
