import express from 'express';
import rentalHistoryCtrl from '../controllers/rentalHistoryCtrl.js';
import auth from '../middleware/auth.js';

const rentalHistoryRouter = express.Router();

rentalHistoryRouter.get('/rental-history', auth, rentalHistoryCtrl.getRentalHistoryForLandlord);
rentalHistoryRouter.get('/create-rental-history', auth, rentalHistoryCtrl.createRentalHistory);


export default rentalHistoryRouter;