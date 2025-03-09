import Users from '../models/userModel.js'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const { hash, compare } = bcrypt
const { sign } = jwt

const authCtrl = {
    register: async (req, res) => {
        try {
            const { full_name, email, password } = req.body
            let newFullName = full_name.toLowerCase().replace(/ /g, '')

            const fullName = await Users.findOne({ full_name: newFullName })
            if (fullName) return res.status(400).json({ msg: "This user name already exists." })

            const user_email = await Users.findOne({ email })
            if (user_email) return res.status(400).json({ msg: "This email already exists." })

            if (password.length < 6)
                return res.status(400).json({ msg: "Password must be at least 6 characters." })

            const passwordHash = await hash(password, 12)

            const newUser = new Users({
                full_name: newFullName, email, status: 0, password: passwordHash, role: 1
            })

            const access_token = createAccessToken({ id: newUser._id })
            const refresh_token = createRefreshToken({ id: newUser._id })

            res.cookie('refreshtoken', refresh_token, {
                httpOnly: true,
                path: '/api/refresh_token',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30days
            })

            await newUser.save()

            res.json({
                msg: 'Register Success!',
                access_token,
                user: {
                    ...newUser._doc,
                    password: ''
                }
            })
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },
    login: async (req, res) => {
        try {
            const { email, password } = req.body

            const user = await Users.findOne({ email })

            if (!user) return res.status(400).json({ msg: "This email does not exist." })

            const isMatch = await compare(password, user.password)
            if (!isMatch) return res.status(400).json({ msg: "Password is incorrect." })

            const access_token = createAccessToken({ id: user._id })
            const refresh_token = createRefreshToken({ id: user._id })

            res.cookie('refreshtoken', refresh_token, {
                httpOnly: true,
                path: '/api/refresh_token',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30days
            })

            res.json({
                msg: 'Login Success!',
                access_token,
                user: {
                    ...user._doc,
                    password: ''
                }
            })
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },
    logout: async (req, res) => {
        try {
            res.clearCookie('refreshtoken', { path: '/api/refresh_token' })
            return res.json({ msg: "Logged out!" })
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },
}

const createAccessToken = (payload) => {
    return sign(payload, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
}

const createRefreshToken = (payload) => {
    return sign(payload, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '30d' })
}

export default authCtrl