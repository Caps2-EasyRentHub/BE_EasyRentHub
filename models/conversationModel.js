import mongoose from 'mongoose'
const { Schema, Types, model } = mongoose

const conversationSchema = new Schema({
    recipients: [{ type: Types.ObjectId, ref: 'user' }],
    text: String,
    media: Array,
    call: Object
}, {
    timestamps: true
})

export default model('conversation', conversationSchema)