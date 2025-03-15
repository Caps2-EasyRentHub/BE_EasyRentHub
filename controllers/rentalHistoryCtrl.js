import RentalHistory from '../models/rentalHistoryModel.js'
import Estate from '../models/estateModel.js'

const rentalHistoryCtrl = {
    createRentalHistory: async (req, res) => {
        try {
            const { estateId, startDate, rentalPrice } = req.body
            
            if (!estateId || !startDate || !rentalPrice) {
                return res.status(400).json({ msg: "Please provide all required fields." })
            }
            
            const estate = await Estate.findById(estateId)
            if (!estate) {
                return res.status(404).json({ msg: "Estate not found." })
            }
            
            const newRentalHistory = new RentalHistory({
                estate: estateId,
                tenant: req.user._id,
                estateName: estate.name,
                address: estate.address,
                property: estate.property,
                images: estate.images,
                startDate,
                rentalPrice,
            })
            
            await newRentalHistory.save()
            
            res.json({
                msg: "Rental history created successfully!",
                rentalHistory: newRentalHistory
            })
            
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },
    
    getRentalHistoryByUser: async (req, res) => {
        try {
            const rentalHistories = await RentalHistory.find({
                $or: [
                    { tenant: req.user._id },
                    { owner: req.user._id }
                ]
            })
            .populate('estate', 'name images address price property')
            .populate('tenant', 'full_name avatar email')
            .populate('owner', 'full_name avatar email')
            .sort('-createdAt')
            
            res.json({
                msg: "Success!",
                result: rentalHistories.length,
                rentalHistories
            })
            
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },
    
    getRentalHistoryByEstate: async (req, res) => {
        try {
            const { estateId } = req.params
            
            // Find rental history for a specific estate
            const rentalHistories = await RentalHistory.find({ estate: estateId })
            .populate('estate', 'name images address price property')
            .populate('tenant', 'full_name avatar email')
            .populate('owner', 'full_name avatar email')
            .sort('-createdAt')
            
            res.json({
                msg: "Success!",
                result: rentalHistories.length,
                rentalHistories
            })
            
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    },
    
    updateRentalHistory: async (req, res) => {
        try {
            const { id } = req.params
            const { paymentStatus, status, notes } = req.body
            
            // Find and update the rental history
            const rentalHistory = await RentalHistory.findOneAndUpdate(
                { _id: id },
                { paymentStatus, status, notes },
                { new: true }
            )
            .populate('estate', 'name images address price property')
            .populate('tenant', 'full_name avatar email')
            .populate('owner', 'full_name avatar email')
            
            if (!rentalHistory) {
                return res.status(404).json({ msg: "Rental history not found." })
            }
            
            res.json({
                msg: "Rental history updated successfully!",
                rentalHistory
            })
            
        } catch (err) {
            return res.status(500).json({ msg: err.message })
        }
    }
}

export default rentalHistoryCtrl