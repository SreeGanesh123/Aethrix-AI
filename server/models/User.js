const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ['candidate', 'recruiter', 'trainer', 'super-admin'] },
    gender: { type: String, enum: ['male', 'female', 'non-binary', 'prefer-not-to-say'] },
    profilePicture: String,
    headline: String,
    bio: String,
    company: String,
    website: String,
    phone: String,
    dob: String,
    address: String,
    education: String,
    university: String,
    graduationYear: String,
    experience: String,
    skills: String,
    resume: String,
    linkedIn: String,
    github: String,
    portfolio: String,
    preferredJobRole: String,
    preferredLocation: String,
    sessionExpiresAt: Number,
    examPassed: { type: Boolean, default: false },
    certificateMeta: { type: mongoose.Schema.Types.Mixed, default: null },
    certificates: { type: [mongoose.Schema.Types.Mixed], default: [] },
    scheduleEvents: { type: [mongoose.Schema.Types.Mixed], default: [] },
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
}, {
    timestamps: true,
});

module.exports = mongoose.model('User', userSchema);
