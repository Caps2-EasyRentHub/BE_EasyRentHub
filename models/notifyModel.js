import mongoose from 'mongoose'
const { Schema, Types, model } = mongoose

const notifySchema = new Schema({
    id: Types.ObjectId,
    user: { type: Types.ObjectId, ref: 'user' },
    recipients: [Types.ObjectId],
    url: String,
    text: String,
    content: String,
    image: String,
    isRead: { type: Boolean, default: false }
}, {
    timestamps: true
})

export default model('notify', notifySchema)