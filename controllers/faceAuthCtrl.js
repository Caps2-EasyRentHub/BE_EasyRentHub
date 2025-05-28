import FaceRecognitionService from "../services/faceRecognition.service.js";
import { CompareFacesCommand } from "@aws-sdk/client-rekognition";

class FaceAuthController {
  async registerFace(req, res) {
    try {
      const userId = req.user.id;
      const imageBuffer = req.file?.buffer;

      if (!imageBuffer) {
        return res.status(400).json({ message: "No image provided" });
      }

      const result = await FaceRecognitionService.registerFace(
        imageBuffer,
        userId
      );

      res.json({ message: "Face registered successfully" });
    } catch (error) {
      console.error("Register face error:", error);

      if (
        error.message.includes("No face detected") ||
        error.message.includes("Multiple faces") ||
        error.message.includes("confidence") ||
        error.message.includes("eyes are open") ||
        error.message.includes("mouth is visible") ||
        error.message.includes("look directly") ||
        error.message.includes("Face is too small")
      ) {
        return res.status(400).json({ message: error.message });
      }

      res.status(500).json({ message: "Internal server error" });
    }
  }

  async verifyFace(req, res) {
    try {
      const userId = req.user.id;
      const imageBuffer = req.file?.buffer;

      if (!imageBuffer) {
        return res.status(400).json({ message: "No image provided" });
      }

      const result = await FaceRecognitionService.verifyFace(
        imageBuffer,
        userId
      );

      if (result.verified) {
        res.json({ 
          verified: true, 
          message: "Face verification successful",
          similarity: result.similarity 
        });
      } else {
        res.status(401).json({ 
          verified: false, 
          message: result.message || "Face verification failed",
          similarity: result.similarity
        });
      }
    } catch (error) {
      console.error("Verify face error:", error);
      
      res.status(401).json({ 
        verified: false, 
        message: "Face verification failed",
        detail: "An unexpected error occurred during verification"
      });
    }
  }

  async updateThreshold(req, res) {
    try {
      const { threshold } = req.body;

      if (!threshold || threshold < 70 || threshold > 100) {
        return res.status(400).json({
          message: "Invalid threshold. Must be between 70 and 100",
        });
      }

      FaceRecognitionService.SIMILARITY_THRESHOLD = threshold;

      res.json({
        success: true,
        message: `Similarity threshold updated to ${threshold}`,
      });
    } catch (error) {
      console.error("Error updating threshold:", error);
      res.status(500).json({ message: "Failed to update threshold" });
    }
  }

  async compareFaces(req, res) {
    try {
      const sourceImage = req.files?.source?.[0]?.buffer;
      const targetImage = req.files?.target?.[0]?.buffer;

      if (!sourceImage || !targetImage) {
        return res
          .status(400)
          .json({ message: "Both source and target images are required" });
      }

      const compareCommand = new CompareFacesCommand({
        SourceImage: { Bytes: sourceImage },
        TargetImage: { Bytes: targetImage },
        SimilarityThreshold: FaceRecognitionService.SIMILARITY_THRESHOLD,
      });

      const compareResult = await FaceRecognitionService.rekognitionClient.send(
        compareCommand
      );

      res.json({
        facesMatched: compareResult.FaceMatches?.length > 0,
        matches: compareResult.FaceMatches,
        unmatched: compareResult.UnmatchedFaces,
      });
    } catch (error) {
      console.error("Error comparing faces:", error);
      res.status(500).json({ message: "Face comparison failed" });
    }
  }

  async validateFaceImage(req, res) {
    try {
      const imageBuffer = req.file?.buffer;

      if (!imageBuffer) {
        return res.status(400).json({ message: "No image provided" });
      }

      const validation = await FaceRecognitionService.validateFaceImage(
        imageBuffer
      );

      console.log("validation " + validation.isValid);

      res.json(validation);
    } catch (error) {
      console.error("Validate face error:", error);
      res.status(500).json({ message: "Failed to validate face image" });
    }
  }

  async checkFaceRegistration(req, res) {
    try {
      const userId = req.user.id;
      
      const result = await FaceRecognitionService.isFaceRegistered(userId);
      
      res.json({
        isRegistered: result.isRegistered,
        faceCount: result.faceCount
      });
    } catch (error) {
      console.error("Check face registration error:", error);
      res.status(500).json({ message: "Failed to check face registration status" });
    }
  }
}

export default new FaceAuthController();
