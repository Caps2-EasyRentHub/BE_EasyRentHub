import express from "express";
import { getFavoriteRooms, addFavoriteRoom, removeFavoriteRoom } from "../controllers/favoriteCtrl.js";

const router = express.Router();

router.get("/:userId", getFavoriteRooms);
router.post("/", addFavoriteRoom);
router.delete("/", removeFavoriteRoom);

export default router;
