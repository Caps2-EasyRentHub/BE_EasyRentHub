import Estate from "../../models/estateModel.js";
import Review from "../../models/reviewModel.js";
import RentalTransaction from "../../models/rentalTransactionModel.js";
import { extractEstateFeatures } from "./contentBasedFiltering.js";

/**
 * Calculate similarity between a target estate and another estate based on features
 * using Cosine Similarity for vector comparison
 * @param {Object} targetEstate - The estate to compare against
 * @param {Object} compareEstate - The estate to compare with
 * @returns {Number} - Similarity score between 0 and 1
 */
const calculateEstateFeatureSimilarity = (targetEstate, compareEstate) => {
  if (!targetEstate || !compareEstate) return 0;

  const targetFeatures = extractEstateFeatures(targetEstate);
  const compareFeatures = extractEstateFeatures(compareEstate);

  if (!targetFeatures || !compareFeatures) return 0;

  // Feature weights
  const priceWeight = 0.2;
  const bedroomWeight = 0.25;
  const bathroomWeight = 0.15;
  const floorWeight = 0.1;
  const locationWeight = 0.3;

  // Calculate bedroom similarity (exact match is better)
  const bedroomDiff = Math.abs(
    targetFeatures.bedrooms - compareFeatures.bedrooms
  );
  const bedroomSimilarity = Math.max(0, 1 - bedroomDiff / 3);

  // Calculate bathroom similarity
  const bathroomDiff = Math.abs(
    targetFeatures.bathrooms - compareFeatures.bathrooms
  );
  const bathroomSimilarity = Math.max(0, 1 - bathroomDiff / 2);

  // Calculate floor similarity
  const floorDiff = Math.abs(targetFeatures.floors - compareFeatures.floors);
  const floorSimilarity = Math.max(0, 1 - floorDiff / 3);

  // Calculate location similarity using coordinates (Haversine distance)
  let locationSimilarity = 0;
  if (
    targetFeatures.location.lat &&
    targetFeatures.location.lng &&
    compareFeatures.location.lat &&
    compareFeatures.location.lng
  ) {
    // Calculate distance in km
    const distance = calculateDistance(
      targetFeatures.location.lat,
      targetFeatures.location.lng,
      compareFeatures.location.lat,
      compareFeatures.location.lng
    );
    // Normalize distance - closer is better (using 10km as max relevant distance)
    locationSimilarity = Math.max(0, 1 - distance / 10);
  } else if (targetFeatures.location.city && compareFeatures.location.city) {
    // If coordinates not available, check city match
    locationSimilarity =
      targetFeatures.location.city === compareFeatures.location.city ? 1 : 0;
  }

  // Calculate weighted similarity score
  const similarityScore =
    bedroomWeight * bedroomSimilarity +
    bathroomWeight * bathroomSimilarity +
    floorWeight * floorSimilarity +
    locationWeight * locationSimilarity;

  console.log(
    `[SIMILARITY] Comparing estates - Score: ${similarityScore.toFixed(
      4
    )} - Details:`,
    {
      bedroomSim: bedroomSimilarity.toFixed(4),
      bathroomSim: bathroomSimilarity.toFixed(4),
      floorSim: floorSimilarity.toFixed(4),
      locationSim: locationSimilarity.toFixed(4),
    }
  );

  return similarityScore;
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {Number} lat1 - Latitude of first point
 * @param {Number} lng1 - Longitude of first point
 * @param {Number} lat2 - Latitude of second point
 * @param {Number} lng2 - Longitude of second point
 * @returns {Number} - Distance in kilometers
 */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

/**
 * Get price recommendation for a new estate based on similar properties
 * @param {Object} estateData - The estate data to recommend price for
 * @param {Number} k - Number of similar estates to consider (default: 5)
 * @returns {Object} - Recommended price range and similar estates
 */
const getEstateRecommendedPrice = async (estateData, k = 2) => {
  try {
    console.log(`[PRICE RECOMMEND] Starting price recommendation process`);

    // Check if estateData is valid
    if (!estateData) {
      return {
        success: false,
        message: "Invalid estate data provided",
        recommendedPrice: null,
        similarEstates: [],
      };
    }

    // Create a temp estate object with the provided data
    const targetEstate = {
      property: {
        bedroom: estateData.bedrooms || 0,
        bathroom: estateData.bathrooms || 0,
        floors: estateData.floors || 0,
      },
      address: {
        city: estateData.city || "",
        country: estateData.country || "",
        lat: parseFloat(estateData.lat || 0),
        lng: parseFloat(estateData.lng || 0),
      },
      rating_star: 0,
    };

    const estates = await Estate.find({ status: "available" }).lean();

    if (estates.length === 0) {
      console.log(
        "[PRICE RECOMMEND] No available estates found for comparison"
      );
      return {
        success: false,
        message: "No comparable properties found",
        recommendedPrice: null,
        similarEstates: [],
      };
    }

    console.log(
      `[PRICE RECOMMEND] Found ${estates.length} available estates for comparison`
    );

    const scoredEstates = estates
      .map((estate) => ({
        estate,
        similarityScore: calculateEstateFeatureSimilarity(targetEstate, estate),
      }))
      .filter((item) => item.similarityScore > 0.6);

    if (scoredEstates.length === 0) {
      console.log("[PRICE RECOMMEND] No sufficiently similar estates found");
      return {
        success: false,
        message: "No sufficiently similar properties found",
        recommendedPrice: null,
        similarEstates: [],
      };
    }

    scoredEstates.sort((a, b) => b.similarityScore - a.similarityScore);

    const topSimilarEstates = scoredEstates.slice(0, k);

    // Calculate weighted average price based on similarity
    const totalSimilarity = topSimilarEstates.reduce(
      (sum, item) => sum + item.similarityScore,
      0
    );
    const weightedPrice =
      topSimilarEstates.reduce(
        (sum, item) => sum + item.estate.price * item.similarityScore,
        0
      ) / totalSimilarity;

    // Check rental transaction history for market trends
    const recentTransactions = await RentalTransaction.find({
      status: "approved",
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, // Last 90 days
    })
      .populate("estate")
      .lean();

    let marketAdjustment = 1.0;
    if (recentTransactions.length > 0) {
      // Compare recent transaction prices with listed prices
      const priceRatios = [];
      recentTransactions.forEach((transaction) => {
        if (transaction.estate && transaction.estate.price) {
          const ratio = transaction.rentalPrice / transaction.estate.price;
          if (ratio > 0) priceRatios.push(ratio);
        }
      });

      if (priceRatios.length > 0) {
        const avgRatio =
          priceRatios.reduce((sum, ratio) => sum + ratio, 0) /
          priceRatios.length;
        marketAdjustment = avgRatio;
        console.log(
          `[PRICE RECOMMEND] Market adjustment factor: ${marketAdjustment.toFixed(
            2
          )}`
        );
      }
    }

    // Apply market adjustment
    const adjustedPrice = weightedPrice * marketAdjustment;

    // Calculate price range (±10%)
    const minPrice = Math.floor(adjustedPrice * 0.9);
    const maxPrice = Math.ceil(adjustedPrice * 1.1);

    console.log(
      `[PRICE RECOMMEND] Calculated weighted price: ${weightedPrice.toFixed(2)}`
    );
    console.log(
      `[PRICE RECOMMEND] Adjusted price for market trends: ${adjustedPrice.toFixed(
        2
      )}`
    );
    console.log(
      `[PRICE RECOMMEND] Recommended price range: ${minPrice} - ${maxPrice}`
    );

    // Log details of similar estates used for calculation
    console.log(
      `[PRICE RECOMMEND] Top ${topSimilarEstates.length} similar estates used:`
    );
    topSimilarEstates.forEach((item, index) => {
      console.log(
        `  [${index + 1}] Estate ID: ${
          item.estate._id
        } - Score: ${item.similarityScore.toFixed(4)} - Price: ${
          item.estate.price
        }`
      );
    });

    return {
      success: true,
      recommendedPrice: {
        average: Math.round(adjustedPrice),
        range: {
          min: minPrice,
          max: maxPrice,
        },
      },
      similarEstates: topSimilarEstates.map((item) => ({
        id: item.estate._id,
        price: item.estate.price,
        similarity: item.similarityScore,
        features: extractEstateFeatures(item.estate),
      })),
      marketTrend: {
        adjustment: marketAdjustment,
        transactionsAnalyzed: recentTransactions.length,
      },
    };
  } catch (error) {
    console.error(`[ERROR] Error getting price recommendation:`, {
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      message: "Error calculating price recommendation",
      error: error.message,
    };
  }
};

/**
 * Get suggested price ranges for different property types
 * @returns {Object} - Object containing price ranges by property type and location
 */
const getSuggestedPriceRanges = async () => {
  try {
    console.log("[PRICE SUGGEST] Generating suggested price ranges");

    const estates = await Estate.find({ status: "available" }).lean();

    if (estates.length === 0) {
      console.log("[PRICE SUGGEST] No available estates found");
      return {
        success: false,
        message: "No available estates found to generate suggestions",
        suggestions: null,
      };
    }

    console.log(
      `[PRICE SUGGEST] Found ${estates.length} available estates for analysis`
    );

    // Group estates by bedroom count
    const bedroomGroups = {};

    estates.forEach((estate) => {
      const bedrooms = estate.property?.bedroom || 0;
      if (!bedroomGroups[bedrooms]) {
        bedroomGroups[bedrooms] = [];
      }
      bedroomGroups[bedrooms].push(estate);
    });

    // Group estates by location (city)
    const locationGroups = {};

    estates.forEach((estate) => {
      const city = estate.address?.city || "Unknown";
      if (!locationGroups[city]) {
        locationGroups[city] = [];
      }
      locationGroups[city].push(estate);
    });

    // Calculate price statistics for each bedroom group
    const bedroomPriceRanges = {};

    Object.keys(bedroomGroups).forEach((bedrooms) => {
      const estatesInGroup = bedroomGroups[bedrooms];

      if (estatesInGroup.length > 0) {
        const prices = estatesInGroup.map((estate) => estate.price);
        const avgPrice =
          prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        bedroomPriceRanges[bedrooms] = {
          min: minPrice,
          max: maxPrice,
          avg: Math.round(avgPrice),
          count: estatesInGroup.length,
        };
      }
    });

    // Calculate price statistics for each location group
    const locationPriceRanges = {};

    Object.keys(locationGroups).forEach((location) => {
      const estatesInLocation = locationGroups[location];

      if (estatesInLocation.length > 0) {
        const prices = estatesInLocation.map((estate) => estate.price);
        const avgPrice =
          prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        locationPriceRanges[location] = {
          min: minPrice,
          max: maxPrice,
          avg: Math.round(avgPrice),
          count: estatesInLocation.length,
        };
      }
    });

    // Calculate overall price statistics
    const allPrices = estates.map((estate) => estate.price);
    const overallStats = {
      min: Math.min(...allPrices),
      max: Math.max(...allPrices),
      avg: Math.round(
        allPrices.reduce((sum, price) => sum + price, 0) / allPrices.length
      ),
      count: estates.length,
    };

    return {
      success: true,
      suggestions: {
        overall: overallStats,
        byBedrooms: bedroomPriceRanges,
        byLocation: locationPriceRanges,
      },
    };
  } catch (error) {
    console.error("[ERROR] Error generating price suggestions:", {
      message: error.message,
      stack: error.stack,
    });

    return {
      success: false,
      message: "Error generating price suggestions",
      error: error.message,
    };
  }
};

export { getEstateRecommendedPrice, getSuggestedPriceRanges };
