import { generatePriceRecommendation } from "../utils/recommendation/priceRecommendation.js";

const priceRecommendationCtrl = {
  /**
   * Get price recommendation based on user location and property features
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @returns {Object} Price recommendation response
   */
  getPriceRecommendation: async (req, res) => {
    try {
      // Extract user location from request
      const userLocation = req.body.userLocation;
      if (!userLocation || !userLocation.lat || !userLocation.lng) {
        return res.status(400).json({ 
          success: false, 
          message: "Vui lòng cung cấp vị trí của bạn (lat/lng)" 
        });
      }
      
      // Extract property features from request
      const propertyFeatures = req.body.propertyFeatures;
      if (!propertyFeatures) {
        return res.status(400).json({ 
          success: false, 
          message: "Vui lòng cung cấp thông tin về phòng trọ (số phòng, số tầng, số giường)" 
        });
      }
      
      console.log(`[PRICE CONTROLLER] Getting recommendation based on user location`, {
        location: `${userLocation.city || 'Unknown'} (${userLocation.lat}, ${userLocation.lng})`,
        propertyFeatures
      });
      
      // Generate price recommendation based on location and property features
      const recommendation = await generatePriceRecommendation(userLocation, propertyFeatures);
      
      if (!recommendation.success) {
        return res.status(400).json(recommendation);
      }
      
      return res.status(200).json(recommendation);
      
    } catch (err) {
      console.error("[PRICE CONTROLLER] Error in price recommendation:", {
        message: err.message,
        stack: err.stack,
      });
      
      return res.status(500).json({ 
        success: false, 
        message: "Đã xảy ra lỗi khi tạo đề xuất giá" 
      });
    }
  },
};

export default priceRecommendationCtrl;
