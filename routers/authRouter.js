import express from 'express'
import authCtrl from '../controllers/authCtrl.js'

const authRouter = express.Router()

authRouter.post('/register', authCtrl.register)

authRouter.post('/login', authCtrl.login)

authRouter.post('/logout', authCtrl.logout)

export default authRouter