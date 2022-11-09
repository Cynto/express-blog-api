const index = require('../routes/index.js');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Post = require('../models/post');
const initialiseMongoServer = require('../config/mongoConfigTesting');

const app = express();
require('../config/passport');
const Comment = require('../models/comment');
const passport = require('passport');
const Passport = require('passport');

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

describe('Blog Post Routes', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;
  let post;
  let posts = [];
  let unpublishedPost;
  beforeAll(async () => {
    await initialiseMongoServer();
    await request(app).post('/users').send(userPayload);
    await request(app).post('/users').send(adminPayload);

    const userRes = await request(app).post('/users/login').send(userPayload);
    userToken = userRes.body.token;
    user = userRes.body.user;

    const adminRes = await request(app).post('/users/login').send(adminPayload);
    adminToken = adminRes.body.token;
    admin = adminRes.body.user;

    const newPost = await new Post({
      ...validPostPayload,
      title: `test title`,
      content: `test content`,
      url: `test-title`,
      user: adminRes.body.user._id,
      published: true,
      comments: [],
    });
    const newUnpublishedPost = await new Post({
      ...validPostPayload,
      title: `test title2`,
      content: `test content`,
      url: `test-title2`,
      user: adminRes.body.user._id,
      published: false,
      comments: [],
    });

    const newComment = await new Comment({
      content: 'test comment',
      user: adminRes.body.user._id,
      post: newPost._id,
    });
    const savedComment = await newComment.save();
    newPost.comments = [savedComment._id];

    const savedPost = await newPost.save();
    const savedUnpublishedPost = await newUnpublishedPost.save();

    post = savedPost;
    unpublishedPost = savedUnpublishedPost;
  });

  describe('POST /posts', () => {
    beforeEach(async () => {});
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
      jest.spyOn(global, 'fetch').mockImplementationOnce(() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              data: {
                link: 'https://i.imgur.com/123.jpg',
              },
            }),
        })
      );

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

  describe('PUT /posts/:id', () => {
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
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.imgur.com/3/image',
        {
          method: 'POST',
          headers: {
            Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
          },
          body: formData,
        }
      );
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

    it('should return 500 if featured is true and Post.updateMany throws error', async () => {
      jest.spyOn(Post, 'updateMany').mockRejectedValueOnce(new Error('error'));

      const res = await request(app)
        .put(`/posts/${post._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ...validPostPayload,
          featured: true,
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

  describe('GET /posts/:id', () => {
    it('should return 500 if Post.findOne throws error', async () => {
      jest.spyOn(Post, 'findOne').mockImplementationOnce(() => {
        throw new Error('test error');
      });

      const res = await request(app).get('/posts/test-title');

      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if passport.authenticate throws an error when post is unpublished', async () => {
      jest
        .spyOn(passport, 'authenticate')
        .mockImplementationOnce((strategy, options, callback) => {
          return () => {
            return callback(new Error('error'), null, null);
          };
        });

      const res = await request(app).get('/posts/test-title2');

      expect(res.statusCode).toEqual(500);
    });

    it('should return 404 if post is not found', async () => {
      const res = await request(app).get('/posts/test-title-3');

      expect(res.statusCode).toEqual(404);
    });

    it('should return 403 if post is not published and user is not an admin', async () => {
      const res = await request(app)
        .get('/posts/test-title2')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(403);
    });

    it('should return 200 and post object if post is published', async () => {
      const res = await request(app).get('/posts/test-title');

      expect(res.statusCode).toEqual(200);
      expect(res.body.post).not.toBeNull();
    });

    it('should return 200 & post object if post is unpublished and user is admin', async () => {
      const res = await request(app)
        .get('/posts/test-title2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.post).not.toBeNull();
    });
  });

  describe('GET /posts', () => {
    beforeAll(async () => {
      await mongoose.connection.db.dropCollection('posts');
      for (let i = 0; i <= 40; i++) {
        const newPost = await new Post({
          ...validPostPayload,
          title: `test title ${i}`,
          content: `test content ${i}`,
          url: `test-title-${i}`,
          user: admin._id,
          published: i % 2 === 0,
          comments: [],
        });
        if (i === 3) {
          const newComment = await new Comment({
            content: 'test comment',
            user: admin._id,
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
          return () => {
            return callback(new Error('error'), null, null);
          };
        });

      const res = await request(app).get('/posts');

      expect(res.statusCode).toEqual(500);
    });

    it('should not return unpublished posts if user is not an admin', async () => {
      const res = await request(app)
        .get('/posts')
        .set({
          Authorization: `Bearer ${userToken}`,
          allposts: 'true',
        });

      expect(res.body.length).toEqual(12);

      res.body.forEach((post) => {
        expect(post.published).toEqual(true);
      });
    });

    it('first item of array should be featured post if aggregate query does not return featured post', async () => {
      jest.spyOn(Post, 'aggregate').mockImplementationOnce((agg, callback) => {
        return callback(null, []);
      });

      const res = await request(app).get('/posts');

      expect(res.body[0].featured).toEqual(true);
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
      const res = await request(app)
        .get('/posts')
        .set({
          Authorization: `Bearer ${adminToken}`,
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
      const res = await request(app)
        .get('/posts?sort=commentCount')
        .set({
          Authorization: `Bearer ${adminToken}`,
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

    it('should return 500 if Post.findOne throws error if no featured post is found', async () => {
      jest.spyOn(Post, 'aggregate').mockImplementationOnce((agg, callback) => {
        callback(null, []);
      });

      jest.spyOn(Post, 'findOne').mockImplementationOnce(() => {
        throw new Error('test error');
      });

      const res = await request(app).get('/posts');

      expect(res.statusCode).toEqual(500);
    });
  });

  describe('DELETE /posts/:id', () => {
    let postToDelete;

    beforeAll(async () => {
      const newPost = await new Post({
        ...validPostPayload,
        title: 'test title',
        content: 'test content',
        url: 'test-title',
        user: admin._id,
        published: true,
        comments: [],
      });
      postToDelete = await newPost.save();
    });
    it('should return 500 if passport.authenticate callback sends error', async () => {
      jest
        .spyOn(Passport, 'authenticate')
        .mockImplementationOnce((strategy, options, callback) => () => {
          callback(new Error('test error'), null);
        });

      const res = await request(app)
        .delete(`/posts/${postToDelete._id}`)
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
        .delete(`/posts/${postToDelete._id}`)
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
        .delete(`/posts/${postToDelete._id}`)
        .set({
          Authorization: `Bearer ${adminToken}`,
        });
      expect(res.statusCode).toEqual(500);
    });

    it('should return 204 if user is admin and post exists and post is deleted successfully', async () => {
      const res = await request(app)
        .delete(`/posts/${postToDelete._id}`)
        .set({
          Authorization: `Bearer ${adminToken}`,
        });
      expect(res.statusCode).toEqual(204);
    });
  });
});
