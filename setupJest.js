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
beforeAll(async () => {
  await mongoose.connect(process.env['MONGO_URI']);
});

afterAll(async () => {
  await mongoose.disconnect();
});
