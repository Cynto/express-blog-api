const mongoose = require('mongoose');

const mongoDB = process.env.MONGODB_URI;

mongoose.connect(
  mongoDB,
  { useNewUrlParser: true, useUnifiedTopology: true },
  (err) => {
    if (err) {
      console.log('MongoDB connection error: ' + err);
    } else {
      console.log('MongoDB connection successful');
    }
  }
);
const db = mongoose.connection;

module.exports = db;
