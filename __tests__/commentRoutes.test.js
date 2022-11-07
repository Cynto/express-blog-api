const index = require('../routes/index.js');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Post = require('../models/post');
const Comment = require('../models/comment');
const setupMongoMemory = require('../setupMongoMemory');

require('../config/passport');

const app = express();
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
  firstName: 'Admin',
  lastName: 'Admin',
  email: 'admin@gmail.com',
  password: '12345678',
  confirmPassword: '12345678',
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

describe('comment routes', () => {
  let user;
  let admin;
  let post;
  let userToken;
  let adminToken;
  let validCommentPayload;
  let invalidCommentPayload;
  beforeAll(async () => {
    await setupMongoMemory();

    await request(app).post('/users').send(userPayload);
    await request(app).post('/users').send(adminPayload);

    const userRes = await request(app).post('/users/login').send(userPayload);
    userToken = userRes.body.token;
    user = userRes.body.user;

    const adminRes = await request(app).post('/users/login').send(adminPayload);
    adminToken = adminRes.body.token;
    admin = adminRes.body.user;

    const postRes = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPostPayload);
    post = postRes.body.post;

    validCommentPayload = {
      content: 'test content',
      post: post._id,
    };
    invalidCommentPayload = {
      content: '',
      post: post._id,
    };
  });

  describe('POST /:postId/comments', () => {
    it('should return 401 if user is not logged in', async () => {
      const res = await request(app).post(`/${post._id}/comments`);
      expect(res.statusCode).toEqual(401);
    });

    it('should return 400 and error array with one value if comment is empty', async () => {
      const res = await request(app)
        .post(`/${post._id}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidCommentPayload);
      expect(res.statusCode).toEqual(400);
      expect(res.body.errors.length).toEqual(1);
    });

    it('should return 404 if post does not exist', async () => {
      const res = await request(app)
        .post('/5f7a1e1f1c9d440000f2c7e0/comments')
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCommentPayload);
      expect(res.statusCode).toEqual(404);
    });

    it('should return 500 if post.findById throws an error', async () => {
      jest.spyOn(Post, 'findById').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .post(`/${post._id}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCommentPayload);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if comment.save throws an error', async () => {
      jest.spyOn(Comment.prototype, 'save').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .post(`/${post._id}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCommentPayload);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if post.save throws an error', async () => {
      jest.spyOn(Post.prototype, 'save').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .post(`/${post._id}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCommentPayload);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 201 and comment object if comment is valid', async () => {
      const res = await request(app)
        .post(`/${post._id}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCommentPayload);
      expect(res.statusCode).toEqual(201);
      expect(res.body.comment.content).toEqual(validCommentPayload.content);
    });

    it('should add comment to post.comments array', async () => {
      await mongoose.connection.db.dropCollection('comments');
      const res = await request(app)
        .post(`/${post._id}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCommentPayload);

      const postRes = await request(app).get(`/posts/${post.url}`);
      expect(postRes.body.post.comments).toContainEqual({
        ...res.body.comment,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    });
  });

  describe('GET /:postId/comments', () => {
    beforeAll(async () => {
      await mongoose.connection.db.dropCollection('comments');

      await request(app)
        .post(`/${post._id}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCommentPayload);
    });
    it('should return 404 if post does not exist', async () => {
      const res = await request(app).get('/5f7a1e1f1c9d440000f2c7e0/comments');
      expect(res.statusCode).toEqual(404);
    });

    it('should return 500 if post.findById throws an error', async () => {
      jest.spyOn(Post, 'findById').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app).get(`/${post._id}/comments`);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if comment.find throws an error', async () => {
      jest.spyOn(Comment, 'find').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app).get(`/${post._id}/comments`);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 200 and array of comments if post exists', async () => {
      const res = await request(app).get(`/${post._id}/comments`);
      expect(res.statusCode).toEqual(200);
      expect(res.body.comments.length).toEqual(1);
    });
  });

  describe('DELETE /:postId/comments/:commentId', () => {
    let comment;
    beforeAll(async () => {
      await mongoose.connection.db.dropCollection('comments');

      const commentRes = await request(app)
        .post(`/${post._id}/comments`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validCommentPayload);
      comment = commentRes.body.comment;
    });

    it('should return 401 if user is not logged in', async () => {
      const res = await request(app).delete(
        `/${post._id}/comments/${comment._id}`
      );
      expect(res.statusCode).toEqual(401);
    });

    it('should return 404 if post does not exist', async () => {
      const res = await request(app)
        .delete('/5f7a1e1f1c9d440000f2c7e0/comments/5f7a1e1f1c9d440000f2c7e0')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(404);
    });

    it('should return 404 if comment does not exist', async () => {
      const res = await request(app)
        .delete(`/${post._id}/comments/5f7a1e1f1c9d440000f2c7e0`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(404);
    });

    it('should return 404 if post is not found', async () => {
      jest.spyOn(Post, 'findById').mockImplementationOnce(() => null);

      const res = await request(app)
        .delete(`/${post._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(404);
    });

    it('should return 403 if user is not the author of the comment', async () => {
      const res = await request(app)
        .delete(`/${post._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(403);
    });

    it('should return 500 if post.findById throws an error', async () => {
      jest.spyOn(Post, 'findById').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .delete(`/${post._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if comment.findById throws an error', async () => {
      jest.spyOn(Comment, 'findById').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .delete(`/${post._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if post.save throws an error', async () => {
      jest.spyOn(Post.prototype, 'save').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .delete(`/${post._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if comment.remove throws an error', async () => {
      jest.spyOn(Comment.prototype, 'remove').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .delete(`/${post._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 200 if comment exists and is successfully deleted', async () => {
      const res = await request(app)
        .delete(`/${post._id}/comments/${comment._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(200);
    });
  });
});
