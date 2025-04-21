import mongoose from 'mongoose'
const { Schema, Types, model } = mongoose

const userSchema = new Schema({
    full_name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 25
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    avatar: {
        type: String,
        default: 'https://res.cloudinary.com/dw1sniewf/image/upload/v1669720008/noko-social/audefto1as6m8gg17nu1.jpg'
    },
    mobile: { type: String, default: '' },
    address: {
        name: {
            type: String,
            default: ''
        },
        road: {
            type: String,
            default: ''
        },
        quarter: {
            type: String,
            default: ''
        },
        city: {
            type: String,
            default: ''
        },
        country: {
            type: String,
            default: ''
        },
        lat: {
            type: String,
            default: ''
        },
        lng: {
            type: String,
            default: ''
        },
    },
    role: {
        type: String,
        enum: ["Tenant", "Landlord"],
        default: "Tenant"
    },
    status: Number
}, {
    timestamps: true
})

const Users = model('user', userSchema);

export default Users;