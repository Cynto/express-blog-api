const index = require('../../routes/index.js');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Post = require('../../models/post');
const Passport = require('passport');

const app = express();
require('../../config/passport');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use('/', index);

const userPayload = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@gmail.com',
  password: '12345678',
  confirmPassword: '12345678',
};
const adminPayload = {
  ...userPayload,
  email: 'johnadmin@gmail.com',
  adminCode: `${process.env.ADMIN_CODE}`,
};

const validPostPayload = {
  title: 'test title',
  image: 'https://i.imgur.com/0vSEb71.jpg',
  content: 'test content',
  tags: ['test', 'test2'],
  featured: true,
  published: true,
};

global.fetch = jest.fn();

describe('DELETE /posts/:id', () => {
  let userToken;
  let adminToken;
  let post;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.restoreAllMocks();
  });
  beforeAll(async () => {
    const mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    await request(app).post('/users').send(userPayload);
    await request(app).post('/users').send(adminPayload);

    const userRes = await request(app).post('/users/login').send({
      email: userPayload.email,
      password: userPayload.password,
    });
    userToken = userRes.body.token;

    const adminRes = await request(app).post('/users/login').send({
      email: adminPayload.email,
      password: adminPayload.password,
    });
    adminToken = adminRes.body.token;

    const postResponse = await request(app)
      .post('/posts')
      .set({
        Authorization: `Bearer ${adminToken}`,
      })
      .send(validPostPayload);
    post = postResponse.body.post;
  });

  afterEach(async () => {});
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoose.connection.close();
  });

  it('should return 500 if passport.authenticate callback sends error', async () => {
    jest
      .spyOn(Passport, 'authenticate')
      .mockImplementationOnce((strategy, options, callback) => () => {
        callback(new Error('test error'), null);
      });

    const res = await request(app)
      .delete(`/posts/${post._id}`)
      .set({
        Authorization: `Bearer ${adminToken}`,
      })
      .send();
    expect(res.statusCode).toEqual(500);
  });

  it('should return 401 if user is not logged in', async () => {
    const res = await request(app).delete(`/posts/${post._id}`);
    expect(res.statusCode).toEqual(401);
  });

  it('should return 403 if user is not admin', async () => {
    const res = await request(app)
      .delete(`/posts/${post._id}`)
      .set({
        Authorization: `Bearer ${userToken}`,
      });
    expect(res.statusCode).toEqual(403);
  });

  it('should return 404 if post does not exist', async () => {
    const res = await request(app)
      .delete(`/posts/${mongoose.Types.ObjectId()}`)
      .set({
        Authorization: `Bearer ${adminToken}`,
      });
    expect(res.statusCode).toEqual(404);
  });

  it('should return 500 if findByIdAndDelete throws an error', async () => {
    jest.spyOn(Post, 'findByIdAndDelete').mockImplementationOnce(() => {
      throw new Error();
    });
    const res = await request(app)
      .delete(`/posts/${post._id}`)
      .set({
        Authorization: `Bearer ${adminToken}`,
      });
    expect(res.statusCode).toEqual(500);
  });

  it('should return 204 if user is admin and post exists', async () => {
    const res = await request(app)
      .delete(`/posts/${post._id}`)
      .set({
        Authorization: `Bearer ${adminToken}`,
      });
    expect(res.statusCode).toEqual(204);
  });
});
