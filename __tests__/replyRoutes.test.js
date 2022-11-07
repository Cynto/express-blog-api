const index = require('../routes/index.js');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const Comment = require('../models/comment');
const Reply = require('../models/reply');
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

describe('reply routes', () => {
  let user;
  let admin;
  let userToken;
  let adminToken;
  let post;
  let commentPayload;
  let comment;
  let validReplyPayload;
  let invalidReplyPayload;

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

    commentPayload = {
      post: post._id,
      content: 'test comment',
    };
    const commentRes = await request(app)
      .post(`/${post._id}/comments`)
      .set('Authorization', `Bearer ${userToken}`)
      .send(commentPayload);
    comment = commentRes.body.comment;

    validReplyPayload = {
      comment: comment._id,
      content: 'test reply',
      originalUser: user._id,
    };

    invalidReplyPayload = {
      comment: comment._id,
      content: '',
      originalUser: user._id,
    };
  });

  describe('POST /:postId/comments/:commentId/replies', () => {
    it('should return 401 if token is not provided', async () => {
      const res = await request(app).post(`/comments/${comment._id}/replies`);
      expect(res.statusCode).toEqual(401);
    });
    it('should return 401 if token is not valid', async () => {
      const res = await request(app)
        .post(`/comments/${comment._id}/replies`)
        .set('Authorization', 'Bearer 123');
      expect(res.statusCode).toEqual(401);
    });
    it('should return 400 if reply content is not provided', async () => {
      const res = await request(app)
        .post(`/comments/${comment._id}/replies`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(invalidReplyPayload);
      expect(res.statusCode).toEqual(400);
    });

    it('should return 404 if comment is not found', async () => {
      const res = await request(app)
        .post(`/comments/${new mongoose.Types.ObjectId()}/replies`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validReplyPayload);
      expect(res.statusCode).toEqual(404);
    });

    it('should return 500 if Comment.findById throws an error', async () => {
      jest.spyOn(Comment, 'findById').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .post(`/comments/${comment._id}/replies`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validReplyPayload);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if reply.save throws an error', async () => {
      jest.spyOn(Comment.prototype, 'save').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .post(`/comments/${comment._id}/replies`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validReplyPayload);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if comment.save throws an error', async () => {
      jest.spyOn(Comment.prototype, 'save').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .post(`/comments/${comment._id}/replies`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validReplyPayload);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 201 and reply object if reply is created successfully', async () => {
      const res = await request(app)
        .post(`/comments/${comment._id}/replies`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validReplyPayload);
      expect(res.statusCode).toEqual(201);
      expect(res.body.reply).toEqual(
        expect.objectContaining({
          __v: 0,
          _id: expect.any(String),
          comment: expect.any(String),
          content: expect.any(String),
          createdAt: expect.any(String),
          user: expect.any(String),
          originalUser: expect.any(String),
        })
      );
    });
  });

  describe('GET /comments/:commentId/replies', () => {
    it('should return 404 if comment is not found', async () => {
      const res = await request(app).get(
        `/comments/${new mongoose.Types.ObjectId()}/replies`
      );
      expect(res.statusCode).toEqual(404);
    });

    it('should return 500 if Reply.find throws an error', async () => {
      jest.spyOn(Reply, 'find').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app).get(`/comments/${comment._id}/replies`);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 200 and replies array if replies are found', async () => {
      const res = await request(app).get(`/comments/${comment._id}/replies`);
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('replies');
    });
  });

  describe('DELETE /comments/:commentId/replies/:replyId', () => {
    let reply;

    beforeAll(async () => {
      const replyRes = await request(app)
        .post(`/comments/${comment._id}/replies`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(validReplyPayload);
      reply = replyRes.body.reply;
    });

    it('should return 401 if token is not provided', async () => {
      const res = await request(app).delete(
        `/comments/${comment._id}/replies/${reply._id}`
      );
      expect(res.statusCode).toEqual(401);
    });
    it('should return 401 if token is not valid', async () => {
      const res = await request(app)
        .delete(`/comments/${comment._id}/replies/${reply._id}`)
        .set('Authorization', 'Bearer 123');
      expect(res.statusCode).toEqual(401);
    });
    it('should return 404 if reply is not found', async () => {
      const res = await request(app)
        .delete(
          `/comments/${comment._id}/replies/${new mongoose.Types.ObjectId()}`
        )
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(404);
    });

    it('should return 404 if comment is not found', async () => {
      const res = await request(app)
        .delete(
          `/comments/${new mongoose.Types.ObjectId()}/replies/${reply._id}`
        )
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(404);
    });

    it('should return 403 if user is not author of the reply', async () => {
      const res = await request(app)
        .delete(`/comments/${comment._id}/replies/${reply._id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toEqual(403);
    });

    it('should return 500 if Reply.findById throws an error', async () => {
      jest.spyOn(Reply, 'findById').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .delete(`/comments/${comment._id}/replies/${reply._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if comment.save throws an error', async () => {
      jest.spyOn(Comment.prototype, 'save').mockImplementationOnce(() => {
        throw new Error();
      });

      const res = await request(app)
        .delete(`/comments/${comment._id}/replies/${reply._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(500);
    });

    it('should return 200 if reply is deleted successfully', async () => {
      const res = await request(app)
        .delete(`/comments/${comment._id}/replies/${reply._id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toEqual(200);
    });
  });
});
