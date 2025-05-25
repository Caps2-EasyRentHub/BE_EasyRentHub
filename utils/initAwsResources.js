import FaceRecognitionService from '../services/faceRecognition.service.js';

async function initializeAwsResources() {
    try {
        console.log('Initializing AWS Rekognition collection...');
        await FaceRecognitionService.createCollectionIfNotExists();
        console.log('AWS resources initialized successfully');
    } catch (error) {
        console.error('Failed to initialize AWS resources:', error);
    }
}

initializeAwsResources();

export default initializeAwsResources; 