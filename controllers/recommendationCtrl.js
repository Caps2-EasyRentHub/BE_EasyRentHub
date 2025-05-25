import { getRecommendationsForUser } from "../utils/recommendation/contentBasedFiltering.js";

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
};

export default recommendationCtrl;
