const config = require('./utils/config');

async function globalTeardown() {
  if (config.Memory) {
    // Config to decided if a mongodb-memory-server instance should be used
    const instance = global.__MONGOINSTANCE;
    await instance.stop();
  }
}

exports.default = globalTeardown;
