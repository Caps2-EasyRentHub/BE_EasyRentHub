import Estate from "../../models/estateModel.js";
import Review from "../../models/reviewModel.js";
import Favorite from "../../models/favoriteModel.js";
import RentalTransaction from "../../models/rentalTransactionModel.js";

const extractEstateFeatures = (estate) => {
  const features = {
    price: estate.price || 0,
    bedrooms: estate.property.bedroom || 0,
    bathrooms: estate.property.bathroom || 0,
    floors: estate.property.floors || 0,
    location: {
      city: estate.address.city || "",
      country: estate.address.country || "",
      lat: parseFloat(estate.address.lat) || 0,
      lng: parseFloat(estate.address.lng) || 0,
    },
    rating: estate.rating_star || 0,
  };

  console.log(`[EXTRACT] Estate ID: ${estate._id} - Features:`, features);
  return features;
};

const createUserPreferenceProfile = async (userId) => {
  try {
    console.log(
      `[USER PROFILE] Creating preference profile for user: ${userId}`
    );

    const favorites = await Favorite.findOne({ user: userId }).populate({
      path: "rooms",
      select: "price property address rating_star",
    });
    const reviews = await Review.find({ user: userId }).populate({
      path: "estateId",
      select: "price property address rating_star",
    });
    const rentalHistory = await RentalTransaction.find({
      tenant: userId,
      status: "approved",
    }).populate({
      path: "estate",
      select: "price property address rating_star",
    });

    console.log(`[USER PROFILE] Found: 
      - Favorites: ${favorites?.rooms?.length || 0} estates
      - Reviews: ${reviews.length} estates
      - Rental history: ${rentalHistory.length} estates`);

    const favoriteEstates =
      favorites && favorites.rooms
        ? favorites.rooms.filter((room) => room && room._id)
        : [];
    const reviewedEstates = reviews
      .map((review) => review.estateId)
      .filter((estate) => estate && estate._id);
    const rentedEstates = rentalHistory
      .map((rental) => rental.estate)
      .filter((estate) => estate && estate._id);

    const allUserEstates = [
      ...new Set([...favoriteEstates, ...reviewedEstates, ...rentedEstates]),
    ];

    console.log(
      `[USER PROFILE] User ${userId} interacted with ${allUserEstates.length} unique estates`
    );

    if (allUserEstates.length === 0) {
      console.log(`[USER PROFILE] No estates found for user ${userId}`);
      return null;
    }

    // Calculate average preferences
    const avgPreferences = {
      price: 0,
      bedrooms: 0,
      bathrooms: 0,
      floors: 0,
      rating: 0,
      locations: {},
    };

    let validEstateCount = 0;

    allUserEstates.forEach((estate) => {
      const features = extractEstateFeatures(estate);
      if (!features) return; // Skip invalid estates

      avgPreferences.price += features.price;
      avgPreferences.bedrooms += features.bedrooms;
      avgPreferences.bathrooms += features.bathrooms;
      avgPreferences.floors += features.floors;
      avgPreferences.rating += features.rating;

      const city = features.location.city;
      if (city) {
        avgPreferences.locations[city] =
          (avgPreferences.locations[city] || 0) + 1;
      }

      validEstateCount++;
    });

    if (validEstateCount === 0) {
      console.log(
        `[USER PROFILE] No valid estates with features for user ${userId}`
      );
      return null;
    }

    // Calculate averages
    avgPreferences.price /= validEstateCount;
    avgPreferences.bedrooms /= validEstateCount;
    avgPreferences.bathrooms /= validEstateCount;
    avgPreferences.floors /= validEstateCount;
    avgPreferences.rating /= validEstateCount;

    // Find most preferred locations (top 3)
    avgPreferences.preferredLocations = Object.entries(avgPreferences.locations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry) => entry[0]);

    delete avgPreferences.locations;

    console.log(`[USER PROFILE] User preferences calculated:`, avgPreferences);
    return avgPreferences;
  } catch (error) {
    console.error(
      `[ERROR] Error creating user preference profile for user ${userId}:`,
      {
        message: error.message,
        stack: error.stack,
      }
    );
    return null;
  }
};

const calculateSimilarity = (userPreferences, estate) => {
  if (!userPreferences || !estate || !estate._id) return 0;

  const estateFeatures = extractEstateFeatures(estate);
  if (!estateFeatures) return 0;

  const priceWeight = 0.3;
  const bedroomsWeight = 0.15;
  const bathroomsWeight = 0.15;
  const floorsWeight = 0.1;
  const ratingWeight = 0.2;
  const locationWeight = 0.1;

  const priceDiff =
    Math.abs(estateFeatures.price - userPreferences.price) /
    Math.max(1, userPreferences.price);
  const normalizedPriceSimilarity = 1 / (1 + priceDiff);

  const bedroomDiff = Math.abs(
    estateFeatures.bedrooms - userPreferences.bedrooms
  );
  const bathroomDiff = Math.abs(
    estateFeatures.bathrooms - userPreferences.bathrooms
  );
  const floorsDiff = Math.abs(estateFeatures.floors - userPreferences.floors);

  const normalizedBedroomSimilarity = Math.max(0, 1 - bedroomDiff / 3);
  const normalizedBathroomSimilarity = Math.max(0, 1 - bathroomDiff / 2);
  const normalizedFloorsSimilarity = Math.max(0, 1 - floorsDiff / 3);

  const ratingSimilarity =
    estateFeatures.rating >= userPreferences.rating
      ? 1
      : estateFeatures.rating / Math.max(1, userPreferences.rating);

  const locationSimilarity = userPreferences.preferredLocations.includes(
    estateFeatures.location.city
  )
    ? 1
    : 0;

  const similarityScore =
    priceWeight * normalizedPriceSimilarity +
    bedroomsWeight * normalizedBedroomSimilarity +
    bathroomsWeight * normalizedBathroomSimilarity +
    floorsWeight * normalizedFloorsSimilarity +
    ratingWeight * ratingSimilarity +
    locationWeight * locationSimilarity;

  console.log(
    `[SIMILARITY] Estate ID: ${estate._id} - Score: ${similarityScore.toFixed(
      4
    )} - Details:`,
    {
      priceSim: normalizedPriceSimilarity.toFixed(4),
      bedroomSim: normalizedBedroomSimilarity.toFixed(4),
      bathroomSim: normalizedBathroomSimilarity.toFixed(4),
      floorsSim: normalizedFloorsSimilarity.toFixed(4),
      ratingSim: ratingSimilarity.toFixed(4),
      locationSim: locationSimilarity,
    }
  );

  return similarityScore;
};

const getGeneralEstateStatistics = async () => {
  try {
    console.log(`[GENERAL STATS] Calculating general estate statistics`);

    const estates = await Estate.find({ status: "available" }).lean();

    if (estates.length === 0) {
      console.log("[GENERAL STATS] No available estates found");
      return null;
    }

    console.log(`[GENERAL STATS] Found ${estates.length} available estates`);

    const stats = {
      price: 0,
      bedrooms: 0,
      bathrooms: 0,
      floors: 0,
      rating: 0,
      locations: {},
    };

    let validEstateCount = 0;

    estates.forEach((estate) => {
      const features = extractEstateFeatures(estate);
      if (!features) return;

      stats.price += features.price;
      stats.bedrooms += features.bedrooms;
      stats.bathrooms += features.bathrooms;
      stats.floors += features.floors;
      stats.rating += features.rating;

      const city = features.location.city;
      if (city) {
        stats.locations[city] = (stats.locations[city] || 0) + 1;
      }

      validEstateCount++;
    });

    if (validEstateCount === 0) {
      console.log("[GENERAL STATS] No valid estates with features");
      return null;
    }

    // Calculate averages
    stats.price /= validEstateCount;
    stats.bedrooms /= validEstateCount;
    stats.bathrooms /= validEstateCount;
    stats.floors /= validEstateCount;
    stats.rating /= validEstateCount;

    // Find most popular locations (top 3)
    stats.popularLocations = Object.entries(stats.locations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map((entry) => entry[0]);

    delete stats.locations;

    console.log(`[GENERAL STATS] Statistics calculated:`, stats);
    return stats;
  } catch (error) {
    console.error("[ERROR] Error getting general estate statistics:", {
      message: error.message,
      stack: error.stack,
    });
    return null;
  }
};

const getRecommendationsForUser = async (userId, limit = 10) => {
  try {
    console.log(
      `[RECOMMEND] Starting recommendation process for user: ${userId} with limit: ${limit}`
    );

    // Get user preferences if possible
    const userPreferences = await createUserPreferenceProfile(userId);

    // Get all available estates
    const estates = await Estate.find({ status: "available" }).lean();

    if (estates.length === 0) {
      console.log("[RECOMMEND] No available estates found for recommendations");
      return [];
    }

    console.log(
      `[RECOMMEND] Found ${estates.length} available estates for recommendations`
    );

    // If user has preferences, use them for personalized recommendations
    if (userPreferences) {
      console.log(
        `[RECOMMEND] Using personalized preferences for user ${userId}`
      );

      const scoredEstates = estates
        .map((estate) => ({
          estate,
          similarityScore: calculateSimilarity(userPreferences, estate),
        }))
        .filter((item) => item.similarityScore > 0);

      scoredEstates.sort((a, b) => b.similarityScore - a.similarityScore);

      const recommendationCount = Math.min(limit, scoredEstates.length);
      console.log(
        `[RECOMMEND] Returning ${recommendationCount} personalized recommendations for user ${userId}`
      );

      const topRecommendations = scoredEstates
        .slice(0, limit)
        .map((item) => item.estate);

      // Log top 3 recommendations detail (or fewer if less available)
      const logLimit = Math.min(3, topRecommendations.length);
      console.log(`[RECOMMEND] Top ${logLimit} recommendations details:`);
      for (let i = 0; i < logLimit; i++) {
        const rec = scoredEstates[i];
        console.log(
          `  [${i + 1}] Estate ID: ${
            rec.estate._id
          } - Score: ${rec.similarityScore.toFixed(4)} - Price: ${
            rec.estate.price
          }`
        );
      }

      return topRecommendations;
    }
    // Otherwise, use general estate statistics for non-personalized recommendations
    else {
      console.log(
        `[RECOMMEND] User ${userId} has no preferences, using general statistics`
      );

      const generalStats = await getGeneralEstateStatistics();

      if (!generalStats) {
        console.log(
          "[RECOMMEND] No general statistics available, returning popular estates"
        );
        const popularEstates = estates
          .sort((a, b) => {
            const aPopularity =
              (a.likes ? a.likes.length : 0) +
              (a.reviews ? a.reviews.length : 0);
            const bPopularity =
              (b.likes ? b.likes.length : 0) +
              (b.reviews ? b.reviews.length : 0);
            return bPopularity - aPopularity;
          })
          .slice(0, limit);

        console.log(
          `[RECOMMEND] Returning ${popularEstates.length} popular estates ranked by likes/reviews`
        );
        return popularEstates;
      }

      // Score estates based on general statistics
      console.log(`[RECOMMEND] Scoring estates based on general statistics`);
      const scoredEstates = estates.map((estate) => {
        const features = extractEstateFeatures(estate);

        // Basic scoring based on general preferences
        let score = 0;

        // Price score (closer to average is better)
        const priceDiff =
          Math.abs(features.price - generalStats.price) /
          Math.max(1, generalStats.price);
        const priceScore = 1 / (1 + priceDiff);

        // Amenities score (closer to average is better)
        const bedroomDiff = Math.abs(features.bedrooms - generalStats.bedrooms);
        const bathroomDiff = Math.abs(
          features.bathrooms - generalStats.bathrooms
        );
        const floorsDiff = Math.abs(features.floors - generalStats.floors);

        const amenitiesScore =
          (Math.max(0, 1 - bedroomDiff / 3) +
            Math.max(0, 1 - bathroomDiff / 2) +
            Math.max(0, 1 - floorsDiff / 3)) /
          3;

        // Rating score (higher is better)
        const ratingScore = features.rating / 5;

        // Location score (popular locations are better)
        const locationScore = generalStats.popularLocations.includes(
          features.location.city
        )
          ? 1
          : 0;

        // Final score with weights
        score =
          0.3 * priceScore +
          0.3 * amenitiesScore +
          0.3 * ratingScore +
          0.1 * locationScore;

        console.log(
          `[SCORE] Estate ID: ${estate._id} - Score: ${score.toFixed(
            4
          )} - Details:`,
          {
            priceScore: priceScore.toFixed(4),
            amenitiesScore: amenitiesScore.toFixed(4),
            ratingScore: ratingScore.toFixed(4),
            locationScore: locationScore,
          }
        );

        return {
          estate,
          score,
        };
      });

      // Sort by score
      scoredEstates.sort((a, b) => b.score - a.score);

      const recommendationCount = Math.min(limit, scoredEstates.length);
      console.log(
        `[RECOMMEND] Returning ${recommendationCount} general recommendations for user ${userId}`
      );

      const topRecommendations = scoredEstates
        .slice(0, limit)
        .map((item) => item.estate);

      // Log top 3 recommendations detail (or fewer if less available)
      const logLimit = Math.min(3, topRecommendations.length);
      console.log(
        `[RECOMMEND] Top ${logLimit} general recommendations details:`
      );
      for (let i = 0; i < logLimit; i++) {
        const rec = scoredEstates[i];
        console.log(
          `  [${i + 1}] Estate ID: ${
            rec.estate._id
          } - Score: ${rec.score.toFixed(4)} - Price: ${rec.estate.price}`
        );
      }

      return topRecommendations;
    }
  } catch (error) {
    console.error(`[ERROR] Error getting recommendations for user ${userId}:`, {
      message: error.message,
      stack: error.stack,
    });
    return [];
  }
};

export { getRecommendationsForUser };
