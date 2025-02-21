import mongoose from 'mongoose'
const { Schema, Types, model } = mongoose

const reviewSchema = new Schema({
    content: {
        type: String,
        required: true
    },
    star: {
        type: Number,
        required: true
    },
    images: {
        type: Array,
        required: false,
    },
    user: { type: Types.ObjectId, ref: 'user' },
    estateId: Types.ObjectId,
    estateUserId: Types.ObjectId
}, {
    timestamps: true
})

export default model('review', reviewSchema)