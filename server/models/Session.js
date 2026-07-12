const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    expiresAt: { type: Number, required: true },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Session', sessionSchema);
