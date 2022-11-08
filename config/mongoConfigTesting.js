const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const config = require('../utils/config');

const initialiseMongoServer = async () => {
  const instance = await MongoMemoryServer.create();
  const uri = instance.getUri();

  process.env.MONGO_URI = uri.slice(0, uri.lastIndexOf('/'));
  if (global.__MONGOINSTANCES) {
    global.__MONGOINSTANCES.push(instance);
  } else global.__MONGOINSTANCES = [instance];

  await mongoose.connect(`${process.env.MONGO_URI}/${config.Database}`);
  await mongoose.connection.db.dropDatabase();
};

module.exports = initialiseMongoServer;
