import Estate from "../../models/estateModel.js";

/**
 * Calculates the Haversine distance between two geographic coordinate points
 * @param {Number} lat1 - Latitude of first point
 * @param {Number} lng1 - Longitude of first point
 * @param {Number} lat2 - Latitude of second point
 * @param {Number} lng2 - Longitude of second point
 * @returns {Number} Distance in kilometers
 */
const calculateHaversineDistance = (lat1, lng1, lat2, lng2) => {
  // Convert latitude and longitude from degrees to radians
  const toRad = (value) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const earthRadius = 6371; // Radius of Earth in km
  return earthRadius * c;
};

/**
 * Find estates within the user's area or nearby areas
 * @param {Object} userLocation - Object containing lat, lng and city of the user
 * @param {Number} maxDistance - Maximum distance in km to search for nearby estates
 * @returns {Array} Array of estates in the area with their distances
 */
const findEstatesByLocation = async (userLocation, maxDistance = 20) => {
  try {
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      console.error("[PRICE RECOMMEND] Invalid user location provided");
      return [];
    }

    const userLat = parseFloat(userLocation.lat);
    const userLng = parseFloat(userLocation.lng);
    const userCity = userLocation.city;

    console.log(
      `[PRICE RECOMMEND] Finding estates near user location in ${
        userCity || "unknown area"
      }`
    );

    // First attempt: find estates in the same city if city is provided
    let estatesInArea = [];
    if (userCity) {
      estatesInArea = await Estate.find({
        "address.city": userCity,
      }).lean();

      console.log(
        `[PRICE RECOMMEND] Found ${estatesInArea.length} estates in ${userCity}`
      );
    }

    // If not enough estates found in the city or no city provided, search by distance
    if (estatesInArea.length < 3) {
      console.log(
        `[PRICE RECOMMEND] Insufficient data in user's city, searching nearby areas within ${maxDistance}km`
      );

      // Get all available estates
      const allEstates = await Estate.find({}).lean();

      // Calculate distance for each estate and filter by maxDistance
      const nearbyEstates = allEstates.filter((estate) => {
        if (!estate.address || !estate.address.lat || !estate.address.lng)
          return false;

        const estateLat = parseFloat(estate.address.lat);
        const estateLng = parseFloat(estate.address.lng);

        if (isNaN(estateLat) || isNaN(estateLng)) return false;

        const distance = calculateHaversineDistance(
          userLat,
          userLng,
          estateLat,
          estateLng
        );

        // Add distance to the estate object for later use
        estate.distance = distance;
        return distance <= maxDistance;
      });

      // Sort by distance (closest first)
      nearbyEstates.sort((a, b) => a.distance - b.distance);

      // If we have estates from city search, combine them
      if (estatesInArea.length > 0) {
        // Add distance to city estates if not already added
        estatesInArea = estatesInArea.map((estate) => {
          if (estate.distance === undefined) {
            const estateLat = parseFloat(estate.address.lat);
            const estateLng = parseFloat(estate.address.lng);
            estate.distance = calculateHaversineDistance(
              userLat,
              userLng,
              estateLat,
              estateLng
            );
          }
          return estate;
        });

        // Combine and remove duplicates
        const estateIds = new Set(estatesInArea.map((e) => e._id.toString()));
        const uniqueNearbyEstates = nearbyEstates.filter(
          (e) => !estateIds.has(e._id.toString())
        );

        estatesInArea = [...estatesInArea, ...uniqueNearbyEstates];
        // Re-sort by distance
        estatesInArea.sort((a, b) => a.distance - b.distance);
      } else {
        estatesInArea = nearbyEstates;
      }

      console.log(
        `[PRICE RECOMMEND] Found ${estatesInArea.length} estates within ${maxDistance}km of user location`
      );
    } else {
      // Add distance to estates if using city search
      estatesInArea = estatesInArea.map((estate) => {
        if (estate.distance === undefined) {
          const estateLat = parseFloat(estate.address.lat);
          const estateLng = parseFloat(estate.address.lng);
          estate.distance = calculateHaversineDistance(
            userLat,
            userLng,
            estateLat,
            estateLng
          );
        }
        return estate;
      });
    }

    return estatesInArea;
  } catch (error) {
    console.error("[PRICE RECOMMEND] Error finding estates by location:", {
      message: error.message,
      stack: error.stack,
    });
    return [];
  }
};

/**
 * Find similar estates based on property features from a pool of nearby estates
 * @param {Object} propertyFeatures - Features of the property to find similar estates for
 * @param {Array} nearbyEstates - Array of estates already filtered by location
 * @param {Number} maxResults - Maximum number of similar estates to return
 * @returns {Array} Array of similar estates with similarity scores
 */
const findSimilarEstatesFromPool = (
  propertyFeatures,
  nearbyEstates,
  maxResults = 10
) => {
  try {
    if (!propertyFeatures || !nearbyEstates || nearbyEstates.length === 0) {
      console.log(
        "[PRICE RECOMMEND] No property features or nearby estates provided"
      );
      return [];
    }

    console.log(
      `[PRICE RECOMMEND] Finding similar estates from a pool of ${nearbyEstates.length} nearby estates`
    );

    // Calculate similarity scores
    const scoredEstates = nearbyEstates.map((estate) => {
      // Feature weights
      const bedroomWeight = 0.4;
      const bathroomWeight = 0.3;
      const floorsWeight = 0.3;

      // Check if estate has property data
      if (!estate.property) {
        return {
          estate,
          similarityScore: 0,
          distance: estate.distance || 0,
        };
      }

      // Calculate feature similarities (0 to 1 scale)
      const bedroomDiff = Math.abs(
        (estate.property.bedroom || 0) - (propertyFeatures.bedroom || 0)
      );
      const bathroomDiff = Math.abs(
        (estate.property.bathroom || 0) - (propertyFeatures.bathroom || 0)
      );
      const floorsDiff = Math.abs(
        (estate.property.floors || 0) - (propertyFeatures.floors || 0)
      );

      const bedroomSimilarity = Math.max(0, 1 - bedroomDiff / 3);
      const bathroomSimilarity = Math.max(0, 1 - bathroomDiff / 2);
      const floorsSimilarity = Math.max(0, 1 - floorsDiff / 3);

      // Combined similarity score
      const similarityScore =
        bedroomWeight * bedroomSimilarity +
        bathroomWeight * bathroomSimilarity +
        floorsWeight * floorsSimilarity;

      return {
        estate,
        similarityScore,
        distance: estate.distance || 0,
      };
    });

    // Filter out estates with very low similarity
    const validEstates = scoredEstates.filter(
      (item) => item.similarityScore > 0.3
    );

    // Sort by similarity score (most similar first)
    validEstates.sort((a, b) => b.similarityScore - a.similarityScore);

    // Return top results
    return validEstates.slice(0, maxResults);
  } catch (error) {
    console.error(
      "[PRICE RECOMMEND] Error finding similar estates from pool:",
      {
        message: error.message,
        stack: error.stack,
      }
    );
    return [];
  }
};

/**
 * Generates price recommendation for a property based on user location
 * @param {Object} userLocation - Location data with lat, lng, and optionally city
 * @param {Object} propertyFeatures - Property features like bedroom, bathroom, floors
 * @returns {Object} Price recommendation data
 */
export const generatePriceRecommendation = async (
  userLocation,
  propertyFeatures
) => {
  try {
    console.log(
      "[PRICE RECOMMEND] Generating price recommendation based on user location"
    );

    // Find estates near user location
    const estatesInArea = await findEstatesByLocation(userLocation);

    if (!estatesInArea || estatesInArea.length === 0) {
      console.log(
        "[PRICE RECOMMEND] No estates found near the specified location"
      );
      return {
        success: false,
        message: "Không tìm thấy bất động sản nào ở khu vực này để đề xuất giá",
      };
    }

    // Find similar estates from the location-filtered pool
    const similarEstates = findSimilarEstatesFromPool(
      propertyFeatures,
      estatesInArea
    );

    if (!similarEstates || similarEstates.length === 0) {
      console.log("[PRICE RECOMMEND] No similar estates found for comparison");
      return {
        success: false,
        message:
          "Không có đủ dữ liệu để đề xuất giá cho phòng trọ này trong khu vực của bạn",
      };
    }

    // Only use estates with high similarity (score > 0.5)
    const highlyRelevantEstates = similarEstates.filter(
      (item) => item.similarityScore > 0.5
    );

    // Use at least 3 estates or all if less than 3 available
    const estatesForPricing =
      highlyRelevantEstates.length >= 3
        ? highlyRelevantEstates
        : similarEstates;

    // Calculate price statistics
    const prices = estatesForPricing.map((item) => item.estate.price);
    const averagePrice =
      prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Calculate recommended price range (±15% of average)
    const recommendedPriceMin = Math.round(
      Math.max(minPrice, averagePrice * 0.85)
    );
    const recommendedPriceMax = Math.round(
      Math.min(maxPrice, averagePrice * 1.15)
    );

    // Get location info for estate recommendation
    let locationInfo = userLocation.city || "khu vực của bạn";

    // If user didn't provide city, use the city from the most similar estate
    if (!userLocation.city && estatesForPricing.length > 0) {
      const topEstate = estatesForPricing[0].estate;
      if (topEstate.address && topEstate.address.city) {
        locationInfo = topEstate.address.city;
      }
    }

    // Prepare the response
    const result = {
      success: true,
      recommendedPriceRange: {
        min: recommendedPriceMin,
        max: recommendedPriceMax,
        average: Math.round(averagePrice),
      },
      similarEstatesCount: estatesForPricing.length,
      locationInfo: locationInfo,
      propertyFeatures: {
        bedrooms: propertyFeatures.bedroom,
        bathrooms: propertyFeatures.bathroom,
        floors: propertyFeatures.floors,
      },
      explanation: `Giá đề xuất ${
        Math.round((recommendedPriceMin / 1000000) * 10) / 10
      } - ${
        Math.round((recommendedPriceMax / 1000000) * 10) / 10
      } triệu dựa trên ${
        estatesForPricing.length
      } phòng tương tự ở ${locationInfo} (${propertyFeatures.bedroom} phòng, ${
        propertyFeatures.floors
      } tầng, ${propertyFeatures.bathroom} giường)`,
    };

    console.log("[PRICE RECOMMEND] Generated recommendation:", result);
    return result;
  } catch (error) {
    console.error("[PRICE RECOMMEND] Error generating price recommendation:", {
      message: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      message: "Đã xảy ra lỗi khi tạo đề xuất giá",
    };
  }
};
