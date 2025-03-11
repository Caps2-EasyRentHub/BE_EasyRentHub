import Estate from "../models/estateModel.js";
import Review from "../models/reviewModel.js";
import Users from "../models/userModel.js";

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
              console.log(res);
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
};

export default estateCtrl;
