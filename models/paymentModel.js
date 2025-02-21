import mongoose from 'mongoose'
const { Schema, Types, model } = mongoose

const paymentSchema = new Schema({
    type: String,
    checkIn: String,
    checkOut: String,
    discount: Number,
    paymentMethod: String,
    price: Number,
    note: String,
    status: String,
    user: { type: Types.ObjectId, ref: 'user' },
    estate: { type: Types.ObjectId, ref: 'user' },
    estateId: Types.ObjectId,
    estateUserId: Types.ObjectId
});
export default model('payment', paymentSchema)