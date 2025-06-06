import express from "express";
import estateCtrl from "../controllers/estateCtrl.js";
import auth from "../middleware/auth.js";
import recommendationCtrl from "../controllers/recommendationCtrl.js";
import priceRecommendationCtrl from "../controllers/priceRecommendationCtrl.js";

const estateRouter = express.Router();
estateRouter.get("/searchEstates", auth, estateCtrl.searchEstates);
estateRouter
  .route("/estates")
  .post(auth, estateCtrl.createEstate)
  .get(estateCtrl.getEstates);

estateRouter
  .route("/estate/:id")
  .patch(auth, estateCtrl.updateEstate)
  .get(auth, estateCtrl.getEstate)
  .delete(auth, estateCtrl.deleteEstate);

estateRouter.get("/recommend", auth, estateCtrl.getRecommend);

estateRouter.patch("/estate/:id/like", auth, estateCtrl.likeEstate);

estateRouter.patch("/estate/:id/unlike", auth, estateCtrl.unLikeEstate);

estateRouter.get("/user_estates/:id", auth, estateCtrl.getUserEstates);

estateRouter.get("/getLikeEstates", auth, estateCtrl.getLikeEstates);

estateRouter.get(
  "/recommendations/content-based",
  auth,
  recommendationCtrl.getContentBasedRecommendations
);

// New endpoint for price recommendation
estateRouter.get(
  "/price-recommendation",
  auth,
  priceRecommendationCtrl.getPriceRecommendation
);

// Endpoint that accepts POST data for estates that don't exist yet
estateRouter.post(
  "/price-recommendation",
  auth,
  priceRecommendationCtrl.getPriceRecommendation
);

// Price recommendation endpoint based on user location
estateRouter.post(
  "/price-recommendation-by-location",
  auth,
  priceRecommendationCtrl.getPriceRecommendation
);

export default estateRouter;
