const index = require('../../routes/index.js');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Post = require('../../models/post');

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

describe('POST /posts', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;
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

    const userRes = await request(app).post('/users/login').send(userPayload);
    userToken = userRes.body.token;
    user = userRes.body.user;

    const adminRes = await request(app).post('/users/login').send(adminPayload);
    adminToken = adminRes.body.token;
    admin = adminRes.body.user;
  });
  afterEach(async () => {});
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoose.connection.close();
  });

  it('should return 401 if token is not provided', async () => {
    const res = await request(app).post('/posts');
    expect(res.statusCode).toEqual(401);
  });

  it('should return 401 if token is not valid', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', 'Bearer 123');
    expect(res.statusCode).toEqual(401);
  });

  it('should return 403 if user is not admin', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.statusCode).toEqual(403);
  });

  it('should return 400 if data is not provided', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toEqual(400);
  });

  it('should return 400 and error array with 7 items if data is not valid', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'a',
        image: 'a',
        content: 'a',
        tags: 'a',
        featured: 4,
        published: 7,
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.errors.length).toEqual(7);
  });

  it('should return 400 if tags array is empty or contains more than 20 tags', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validPostPayload,
        tags: [],
      });
    expect(res.statusCode).toEqual(400);

    const res2 = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validPostPayload,
        tags: new Array(21).fill('test'),
      });
    expect(res2.statusCode).toEqual(400);
  });

  it('should return 500 if Post.findOne() throws an error', async () => {
    jest.spyOn(Post, 'findOne').mockImplementationOnce((filter, callback) => {
      callback(new Error('error'), null);
    });

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(500);
  });

  it('should return 500 if post.updateMany() throws an error', async () => {
    jest.spyOn(Post, 'updateMany').mockImplementationOnce(() => {
      throw new Error('error');
    });

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(500);
  });

  it('should return 500 if post.save() throws an error', async () => {
    jest.spyOn(Post.prototype, 'save').mockImplementationOnce((callback) => {
      return callback(new Error('error'));
    });

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(500);
  });

  it('fetch should be called if image is non imgur url', async () => {
    await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validPostPayload,
        image:
          'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
      });

    expect(global.fetch).toHaveBeenCalled();
  });

  it('should return 500 if fetch throws an error', async () => {
    jest.spyOn(global, 'fetch').mockImplementationOnce(() => {
      throw new Error('error');
    });

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validPostPayload,
        image:
          'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
      });

    expect(res.statusCode).toEqual(500);
  });

  it('should return 201 and post object if post is created', async () => {
    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(201);
    expect(res.body.post).not.toBeNull();
  });

  it('should return 201 and post object if post is created without first having imgur link', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      json: async () => ({
        data: {
          link: 'https://i.imgur.com/123.jpg',
        },
      }),
    });

    const res = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validPostPayload,
        image:
          'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body.post).not.toBeNull();
  });
});
