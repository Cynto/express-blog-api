const config = require('./utils/config');

async function globalTeardown() {
  console.log(global.__MONGOINSTANCE);
  if (config.Memory) {
    // Config to decided if a mongodb-memory-server instance should be used
    const instances = global.__MONGOINSTANCES;
    instances.map(async (instance) => {
      await instance.stop();
    });
  }
}

exports.default = globalTeardown;
