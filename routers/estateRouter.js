import express from "express";
import estateCtrl from "../controllers/estateCtrl.js";
import auth from "../middleware/auth.js";
import recommendationCtrl from "../controllers/recommendationCtrl.js";

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

estateRouter.get(
  "/recommendations/price",
  auth,
  recommendationCtrl.getPriceRecommendation
);

estateRouter.get(
  "/recommendations/price-suggestions",
  recommendationCtrl.getPriceSuggestions
);

export default estateRouter;
