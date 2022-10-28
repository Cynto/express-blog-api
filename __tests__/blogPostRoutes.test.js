const index = require('../routes/index.js');
var cookieParser = require('cookie-parser');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const passport = require('passport');
const userController = require('../controllers/userController');
const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');

const app = express();
require('../config/passport');

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

let posts = [];

jest.mock('node-fetch');

describe('blog post routes', () => {
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
  });
  afterEach(async () => {});
  afterAll(async () => {
    await mongoose.disconnect();
    await mongoose.connection.close();
  });

  describe('POST /posts', () => {
    beforeAll(async () => {});

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
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: userPayload.email, password: userPayload.password });
      const token = tokenRes.body.token;

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toEqual(403);
    });

    it('should return 400 if data is not provided', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toEqual(400);
    });

    it('should return 400 and error array with 6 items if data is not valid', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
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
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validPostPayload,
          tags: [],
        });
      expect(res.statusCode).toEqual(400);

      const res2 = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validPostPayload,
          tags: new Array(21).fill('test'),
        });
      expect(res2.statusCode).toEqual(400);
    });

    it('should return 500 if Post.findOne() throws an error', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      jest.spyOn(Post, 'findOne').mockImplementationOnce((filter, callback) => {
        callback(new Error('error'), null);
      });

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(validPostPayload);

      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if post.updateMany() throws an error', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      jest
        .spyOn(Post, 'updateMany')
        .mockImplementationOnce((filter, update) => {
          throw new Error('error');
        });

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(validPostPayload);

      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if post.save() throws an error', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      jest.spyOn(Post.prototype, 'save').mockImplementationOnce((callback) => {
        return callback(new Error('error'));
      });

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(validPostPayload);
    });

    it('fetch should be called if image is non imgur url', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validPostPayload,
          image:
            'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
        });

      expect(fetch).toHaveBeenCalled();
    });

    it('should return 500 if fetch throws an error', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      jest.spyOn(fetch, 'default').mockImplementationOnce(() => {
        throw new Error('error');
      });

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validPostPayload,
          image:
            'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
        });

      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if post.save() throws an error after imgur upload', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      jest.spyOn(fetch, 'default').mockImplementationOnce(() => {
        return Promise.resolve({
          json: () => {
            return Promise.resolve({
              data: {
                link: 'https://i.imgur.com/123.png',
              },
            });
          },
        });
      });

      jest.spyOn(Post.prototype, 'save').mockImplementationOnce((callback) => {
        throw new Error('error');
      });

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validPostPayload,
          image:
            'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
        });

      expect(res.statusCode).toEqual(500);
    });

    it('should return 201 if post is created', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(validPostPayload);

      expect(res.statusCode).toEqual(201);
    });

    it('should return 201 if post is created without first having imgur link', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      jest.spyOn(fetch, 'default').mockImplementationOnce(() => {
        return Promise.resolve({
          json: () => {
            return Promise.resolve({
              data: {
                link: 'https://i.imgur.com/123.png',
              },
            });
          },
        });
      });

      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validPostPayload,
          image:
            'https://www.google.com/images/branding/googlelogo/1x/googlelogo_color_272x92dp.png',
        });

      expect(res.statusCode).toEqual(201);
    });
  });

  describe('GET /posts', () => {
    beforeAll(async () => {
      await mongoose.connection.db.dropCollection('posts');
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });

      for (let i = 0; i <= 40; i++) {
        const newPost = await new Post({
          ...validPostPayload,
          title: `test title ${i}`,
          content: `test content ${i}`,
          url: `test-title-${i}`,
          user: tokenRes.body.user._id,
          published: i % 2 === 0,
          comments: [],
        });
        if (i === 3) {
          const newComment = await new Comment({
            content: 'test comment',
            user: tokenRes.body.user._id,
            post: newPost._id,
          });
          const savedComment = await newComment.save();
          newPost.comments = [savedComment._id];
        }

        const savedPost = await newPost.save();
        posts.push(savedPost);
      }
    });

    it('should return 500 if passport.authenticate throws an error', async () => {
      jest
        .spyOn(passport, 'authenticate')
        .mockImplementationOnce((strategy, options, callback) => {
          return (req, res, next) => {
            return callback(new Error('error'), null, null);
          };
        });

      const res = await request(app).get('/posts');

      expect(res.statusCode).toEqual(500);
    });

    it('should not return unpublished posts if user is not an admin', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: userPayload.email, password: userPayload.password });
      const token = tokenRes.body.token;

      const res = await request(app)
        .get('/posts')
        .set({
          Authorization: `Bearer ${token}`,
          allposts: 'true',
        });

      expect(res.body.length).toEqual(12);

      res.body.forEach((post) => {
        expect(post.published).toEqual(true);
      });
    });

    it('should return 12 posts if limit is not specified', async () => {
      const res = await request(app).get('/posts');

      expect(res.body.length).toEqual(12);
    });

    it('should return 15 posts if limit is set to 15', async () => {
      const res = await request(app).get('/posts?limit=15').set({
        allposts: 'true',
        limit: '15',
      });

      expect(res.body.length).toEqual(15);
    });

    it('should return 40 posts, if user is admin and all posts is set to true and limit is set to 40', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      const res = await request(app)
        .get('/posts')
        .set({
          Authorization: `Bearer ${token}`,
          allposts: 'true',
          limit: '40',
        });

      expect(res.body.length).toEqual(40);
    });

    it('should return posts sorted by createdAt in descending order', async () => {
      const res = await request(app).get('/posts');

      const sortedPosts = posts.sort((a, b) => {
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      expect(res.body[0]._id).toEqual(sortedPosts[0]._id.toString());
    });

    it('should return posts sorted by createdAt in ascending order', async () => {
      const res = await request(app)
        .get('/posts?sort=createdAt')
        .set('sort', 'createdAt');

      const sortedPosts = posts.sort((a, b) => {
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

      expect(res.body[0]._id).toEqual(sortedPosts[0]._id.toString());
    });

    it('should return posts sorted by comment count in descending order', async () => {
      const tokenRes = await request(app)
        .post('/users/login')
        .send({ email: adminPayload.email, password: adminPayload.password });
      const token = tokenRes.body.token;

      const res = await request(app)
        .get('/posts?sort=commentCount')
        .set({
          Authorization: `Bearer ${token}`,
          sort: 'commentCount',
          allposts: true,
        });

      const sortedPosts = posts.sort((a, b) => {
        return b.comments.length - a.comments.length;
      });

      expect(res.body[0]._id).toEqual(sortedPosts[0]._id.toString());
    });

    it('should return 500 if Post.aggregate callback returns error', async () => {
      jest.spyOn(Post, 'aggregate').mockImplementationOnce((agg, callback) => {
        callback(new Error('test error'), null);
      });

      const res = await request(app).get('/posts');

      expect(res.statusCode).toEqual(500);
    });
  });

  
});
