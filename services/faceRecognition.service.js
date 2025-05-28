import { RekognitionClient, CompareFacesCommand, IndexFacesCommand, SearchFacesByImageCommand, CreateCollectionCommand, ListCollectionsCommand, DetectFacesCommand, ListFacesCommand } from "@aws-sdk/client-rekognition";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

class FaceRecognitionService {
    constructor() {
        this.BUCKET_NAME = "easyrenthub-images";
        this.COLLECTION_ID = "easyrenthub_faces";
        this.SIMILARITY_THRESHOLD = 95;

        const awsConfig = {
            region: process.env.AWS_REGION || "ap-southeast-2"
        };

        if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            awsConfig.credentials = {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            };
        }

        console.log("AWS Config initialized with region:", awsConfig.region);
        console.log("AWS Credentials available:", !!awsConfig.credentials);

        this.rekognitionClient = new RekognitionClient(awsConfig);
        this.s3Client = new S3Client(awsConfig);
    }

    async uploadImageToS3(imageBuffer, userId) {
        const key = `faces/${userId}/${uuidv4()}.jpg`;
        
        await this.s3Client.send(new PutObjectCommand({
            Bucket: this.BUCKET_NAME,
            Key: key,
            Body: imageBuffer,
            ContentType: 'image/jpeg'
        }));

        return key;
    }

    async validateFaceImage(imageBuffer) {
        try {
            const detectCommand = new DetectFacesCommand({
                Image: {
                    Bytes: imageBuffer
                },
                Attributes: ['ALL']
            });
            
            const detectResult = await this.rekognitionClient.send(detectCommand);
            
            if (!detectResult.FaceDetails || detectResult.FaceDetails.length === 0) {
                return {
                    isValid: false,
                    message: 'No face detected in the image'
                };
            }
            
            if (detectResult.FaceDetails.length > 1) {
                return {
                    isValid: false,
                    message: 'Multiple faces detected. Please provide an image with only one face'
                };
            }
            
            const faceDetails = detectResult.FaceDetails[0];
            
            if (faceDetails.Confidence < 90) {
                return {
                    isValid: false,
                    message: 'Low confidence face detection. Please provide a clearer image'
                };
            }
            
            const leftEyeOpen = faceDetails.EyesOpen?.Value && faceDetails.EyesOpen?.Confidence > 90;
            const rightEyeOpen = faceDetails.EyesOpen?.Value && faceDetails.EyesOpen?.Confidence > 90;
            
            if (!leftEyeOpen || !rightEyeOpen) {
                return {
                    isValid: false,
                    message: 'Please ensure eyes are open and clearly visible'
                };
            }
            
            if (faceDetails.MouthOpen?.Value === false && faceDetails.MouthOpen?.Confidence < 90) {
                return {
                    isValid: false,
                    message: 'Please ensure your mouth is visible (not covered)'
                };
            }
            
            const isGoodPose = 
                Math.abs(faceDetails.Pose?.Pitch) < 20 &&
                Math.abs(faceDetails.Pose?.Roll) < 20 &&
                Math.abs(faceDetails.Pose?.Yaw) < 20;
                
            if (!isGoodPose) {
                return {
                    isValid: false,
                    message: 'Please look directly at the camera without tilting your head'
                };
            }
            
            const bbox = faceDetails.BoundingBox;
            const faceArea = bbox.Width * bbox.Height;
            
            if (faceArea < 0.15) {
                return {
                    isValid: false,
                    message: 'Face is too small in the image. Please move closer to the camera'
                };
            }
            
            return {
                isValid: true,
                message: 'Valid face image',
                faceDetails: faceDetails
            };
            
        } catch (error) {
            console.error('Error validating face image:', error);
            return {
                isValid: false,
                message: 'Failed to validate face image'
            };
        }
    }

    async registerFace(imageBuffer, userId) {
        try {
            const validation = await this.validateFaceImage(imageBuffer);
            
            if (!validation.isValid) {
                throw new Error(validation.message);
            }
            
            const s3Key = await this.uploadImageToS3(imageBuffer, userId);

            const indexCommand = new IndexFacesCommand({
                CollectionId: this.COLLECTION_ID,
                Image: {
                    S3Object: {
                        Bucket: this.BUCKET_NAME,
                        Name: s3Key
                    }
                },
                ExternalImageId: userId,
                DetectionAttributes: ['ALL']
            });

            const indexResult = await this.rekognitionClient.send(indexCommand);
            
            return indexResult.FaceRecords && indexResult.FaceRecords.length > 0;
        } catch (error) {
            console.error('Error registering face:', error);
            throw error;
        }
    }

    async verifyFace(imageBuffer, userId) {
        try {
            console.log(`Verifying face for user: ${userId}`);
            
            let validation;
            try {
                validation = await this.validateFaceImage(imageBuffer);
            } catch (error) {
                console.log(`Face validation failed: ${error.message}`);
                return { verified: false, message: error.message };
            }
            
            if (!validation.isValid) {
                console.log(`Face validation failed: ${validation.message}`);
                return { verified: false, message: validation.message };
            }
            
            let searchResult;
            try {
                const searchCommand = new SearchFacesByImageCommand({
                    CollectionId: this.COLLECTION_ID,
                    Image: {
                        Bytes: imageBuffer
                    },
                    FaceMatchThreshold: this.SIMILARITY_THRESHOLD,
                    MaxFaces: 5
                });

                searchResult = await this.rekognitionClient.send(searchCommand);
            } catch (error) {
                console.error("Error searching for face:", error);
                return { verified: false, message: "Error processing face image" };
            }
            
            console.log("Search result:", JSON.stringify(searchResult, null, 2));

            if (!searchResult.FaceMatches || searchResult.FaceMatches.length === 0) {
                console.log("No face matches found");
                return { verified: false, message: "Face not recognized" };
            }

            const userMatches = searchResult.FaceMatches.filter(match => 
                match.Face?.ExternalImageId === userId);
            
            if (userMatches.length === 0) {
                console.log(`No matches found for user ID: ${userId}`);
                return { verified: false, message: "Face doesn't match with registered user" };
            }

            const bestMatch = userMatches.reduce((best, current) => 
                (current.Similarity > best.Similarity) ? current : best, userMatches[0]);
            
            console.log(`Best match similarity: ${bestMatch.Similarity} for user: ${bestMatch.Face?.ExternalImageId}`);
            
            const isVerified = bestMatch.Similarity >= this.SIMILARITY_THRESHOLD;
            console.log(`Verification result: ${isVerified ? 'SUCCESS' : 'FAILED'}`);
            
            return { 
                verified: isVerified, 
                message: isVerified ? "Face verification successful" : "Face similarity below required threshold",
                similarity: bestMatch.Similarity
            };
        } catch (error) {
            console.error('Error verifying face:', error);
            return { verified: false, message: "Face verification process failed" };
        }
    }

    async createCollection() {
        try {
            const listCommand = new ListCollectionsCommand({});
            const collections = await this.rekognitionClient.send(listCommand);
            
            const collectionExists = collections.CollectionIds.some(id => id === this.COLLECTION_ID);
            
            if (!collectionExists) {
                const createCommand = new CreateCollectionCommand({
                    CollectionId: this.COLLECTION_ID
                });
                
                await this.rekognitionClient.send(createCommand);
                console.log(`Collection ${this.COLLECTION_ID} created successfully`);
            }
            
            return true;
        } catch (error) {
            console.error('Error creating collection:', error);
            throw error;
        }
    }

    async compareFaceImages(sourceImage, targetImage) {
        try {
            const compareCommand = new CompareFacesCommand({
                SourceImage: { Bytes: sourceImage },
                TargetImage: { Bytes: targetImage },
                SimilarityThreshold: this.SIMILARITY_THRESHOLD
            });
            
            const result = await this.rekognitionClient.send(compareCommand);
            return result;
        } catch (error) {
            console.error('Error comparing faces:', error);
            throw error;
        }
    }

    async isFaceRegistered(userId) {
        try {
            const searchCommand = new SearchFacesByImageCommand({
                CollectionId: this.COLLECTION_ID,
                MaxFaces: 1,
                FaceMatchThreshold: this.SIMILARITY_THRESHOLD
            });
            
            const listCommand = new ListFacesCommand({
                CollectionId: this.COLLECTION_ID,
                MaxResults: 1000
            });
            
            const listResult = await this.rekognitionClient.send(listCommand);
            
            const userFaces = listResult.Faces.filter(face => 
                face.ExternalImageId === userId);
            
            return {
                isRegistered: userFaces.length > 0,
                faceCount: userFaces.length
            };
        } catch (error) {
            console.error('Error checking face registration:', error);
            throw error;
        }
    }
}

export default new FaceRecognitionService();