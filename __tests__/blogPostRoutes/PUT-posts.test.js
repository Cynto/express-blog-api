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

describe('PUT /posts/:id', () => {
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

  it('should return 401 if user is not logged in', async () => {
    const res = await request(app).put('/posts/123');

    expect(res.statusCode).toEqual(401);
  });

  it('should return 403 if user is not admin', async () => {
    const res = await request(app)
      .put('/posts/123')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.statusCode).toEqual(403);
  });

  it('should return 400 and error array with 8 items if data is not provided', async () => {
    const res = await request(app)
      .put('/posts/123')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(400);
    expect(res.body.errors.length).toEqual(8);
  });

  it('should return 400 and error array with 8 items if data provided is invalid', async () => {
    const res = await request(app)
      .put('/posts/123')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'a',
        image: 'a',

        content: 'a',
        tags: '',
        published: 'a',
        featured: 'a',
      });

    expect(res.statusCode).toEqual(400);
  });

  it('should return 404 if post with id does not exist', async () => {
    const res = await request(app)
      .put(`/posts/${new mongoose.Types.ObjectId()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(404);
  });

  it('should return 403 if user is not post author', async () => {
    await request(app)
      .post('/users')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'bob5@gmail.com',
        password: '12345678',
        confirmPassword: '12345678',
        adminCode: `${process.env.ADMIN_CODE}`,
      });
    const adminResponse = await request(app).post('/users/login').send({
      email: 'bob5@gmail.com',
      password: '12345678',
    });
    const adminToken2 = adminResponse.body.token;

    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('Authorization', `Bearer ${adminToken2}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(403);
  });

  it('fetch should be called with correct arguments if non imgur URL', async () => {
    await request(app)
      .put(`/posts/${post._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validPostPayload,
        image:
          'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
      });

    const formData = new FormData();
    formData.append(
      'image',
      'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png'
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
      },
      body: formData,
    });
  });

  it('should return 500 if Post.findOne throws error ', async () => {
    jest.spyOn(Post, 'findOne').mockImplementationOnce(() => {
      throw new Error();
    });
    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(500);
  });

  it('should return 500 if post.findById throws error', async () => {
    jest.spyOn(Post, 'findById').mockRejectedValueOnce(new Error('error'));

    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(500);
  });

  it('should return 500 if error occurs while uploading image', async () => {
    global.fetch.mockImplementationOnce(() =>
      Promise.reject(new Error('error'))
    );

    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validPostPayload,
        image:
          'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
      });

    expect(res.statusCode).toEqual(500);
  });

  it('should return 500 is post.save() returns error', async () => {
    jest.spyOn(Post.prototype, 'save').mockImplementationOnce(() => {
      throw new Error('error');
    });

    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(500);
  });

  it('should return 200 and updated post if data is valid', async () => {
    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);

    expect(res.statusCode).toEqual(200);
    expect(res.body.post.title).toEqual(validPostPayload.title);
    expect(res.body.post.image).toEqual(validPostPayload.image);
    expect(res.body.post.content).toEqual(validPostPayload.content);
    expect(res.body.post.tags).toEqual(validPostPayload.tags);
    expect(res.body.post.published).toEqual(validPostPayload.published);
    expect(res.body.post.featured).toEqual(validPostPayload.featured);
  });

  it('should return 200 and post with updated image if data is valid and image is not imgur URL', async () => {
    jest.spyOn(global, 'fetch').mockImplementationOnce(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            data: {
              link: 'https://i.imgur.com/1234567890.jpg',
            },
          }),
      })
    );

    const res = await request(app)
      .put(`/posts/${post._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...validPostPayload,
        image:
          'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.post.image).toEqual('https://i.imgur.com/1234567890.jpg');
  });
});
