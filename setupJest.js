const mongoose = require('mongoose');
process.env.JWT_SECRET = 'secret-key';
process.env.DEBUG =
  'userController, commentController, postController, passport';
process.env.PORT = 4000;
process.env.ADMIN_CODE = 'idk';
process.env.IMGUR_CLIENT_ID = 'a102cb0c7100133';

global.fetch = jest.fn();

beforeEach(async () => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

afterAll(async () => {
  await mongoose.disconnect();
  const instances = global.__MONGOINSTANCES;
  instances.map(async (instance) => {
    await instance.stop();
  });
});
