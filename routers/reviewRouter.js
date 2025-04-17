import express from 'express'
import reviewCtrl from '../controllers/reviewCtrl.js'
import auth from '../middleware/auth.js'

const reviewRouter = express.Router()

reviewRouter.post('/review', auth, reviewCtrl.createReview)

reviewRouter.patch('/review/:id', auth, reviewCtrl.updateReview)

reviewRouter.delete('/review/:id', auth, reviewCtrl.deleteReview)

export default reviewRouter