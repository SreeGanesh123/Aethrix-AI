const mongoose = require('mongoose');
const dns = require('dns');

// Ensure Node resolves SRV records using reliable public DNS servers.
// This avoids local DNS servers rejecting MongoDB Atlas SRV lookups.
dns.setServers(['8.8.8.8', '1.1.1.1']);

function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) {
        throw new Error('MONGO_URI must be defined in the environment');
    }

    return mongoose.connect(uri);
}

module.exports = connectDB;
