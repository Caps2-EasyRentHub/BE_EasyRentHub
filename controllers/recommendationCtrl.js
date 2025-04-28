import { getRecommendationsForUser } from "../utils/recommendation/contentBasedFiltering.js";
import {
  getEstateRecommendedPrice,
  getSuggestedPriceRanges,
} from "../utils/recommendation/priceRecommendation.js";

const recommendationCtrl = {
  getContentBasedRecommendations: async (req, res) => {
    try {
      const user = req.userId || req.user;
      if (!user) {
        console.error("Authentication error: No user data found in request", {
          headers: req.headers,
        });
        return res
          .status(401)
          .json({ msg: "Unauthorized: No user data provided" });
      }

      const userId = user._id || user.id;
      if (!userId) {
        console.error(
          "Authentication error: User ID missing in token payload",
          {
            user,
            headers: req.headers,
          }
        );
        return res.status(401).json({ msg: "Unauthorized: Invalid user data" });
      }

      const userIdString = userId.toString();
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;

      // Validate limit
      if (isNaN(limit) || limit < 1) {
        return res.status(400).json({ msg: "Invalid limit parameter" });
      }

      console.log(
        `Fetching recommendations for user ${userIdString} with limit ${limit}`
      );

      const recommendations = await getRecommendationsForUser(
        userIdString,
        limit
      );

      res.json({
        msg: "Success!",
        result: recommendations.length,
        recommendations,
      });
    } catch (err) {
      console.error(
        `Error in getContentBasedRecommendations for user ${req.userId?._id}:`,
        {
          message: err.message,
          stack: err.stack,
        }
      );
      return res
        .status(500)
        .json({ msg: "Server error: Failed to fetch recommendations" });
    }
  },

  getPriceRecommendation: async (req, res) => {
    try {
      console.log(`[API] Received price recommendation request:`, req.body);

      // Validate required fields
      const { bedrooms, bathrooms, floors, city, country, lat, lng } = req.body;

      if (
        bedrooms === undefined ||
        bathrooms === undefined ||
        floors === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required property details (bedrooms, bathrooms, floors)",
        });
      }

      if (!lat || !lng) {
        return res.status(400).json({
          success: false,
          message: "Missing required location coordinates (lat, lng)",
        });
      }

      const estateData = {
        bedrooms: parseInt(bedrooms),
        bathrooms: parseInt(bathrooms),
        floors: parseInt(floors),
        city: city || "",
        country: country || "",
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      };

      // Get recommended price
      const result = await getEstateRecommendedPrice(estateData);

      res.json(result);
    } catch (err) {
      console.error(`Error in getPriceRecommendation:`, {
        message: err.message,
        stack: err.stack,
      });
      return res.status(500).json({
        success: false,
        message: "Server error: Failed to calculate price recommendation",
        error: err.message,
      });
    }
  },

  // API để lấy khoảng giá tham khảo cho các loại căn hộ khác nhau
  getPriceSuggestions: async (req, res) => {
    try {
      console.log("[API] Getting price suggestions");
      const result = await getSuggestedPriceRanges();
      res.json(result);
    } catch (err) {
      console.error("Error in getPriceSuggestions:", {
        message: err.message,
        stack: err.stack,
      });
      return res.status(500).json({
        success: false,
        message: "Server error: Failed to fetch price suggestions",
        error: err.message,
      });
    }
  },
};

export default recommendationCtrl;
