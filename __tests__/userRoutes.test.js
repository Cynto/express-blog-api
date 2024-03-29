const index = require('../routes/index.js');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const express = require('express');

const mongoose = require('mongoose');
const passport = require('passport');
const userController = require('../controllers/userController');
const User = require('../models/user');
const bcrypt = require('bcryptjs');
const initialiseMongoServer = require('../config/mongoConfigTesting');

require('../config/passport');
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use('/', index);

const userObjPayload = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@gmail.com',
  password: '12345678',
  confirmPassword: '12345678',
};

describe('user routes', () => {
  beforeAll(async () => {
    await initialiseMongoServer();
  });
  afterEach(async () => {
    await mongoose.connection.db.dropDatabase();
  });
  describe('GET /user', () => {
    it('should return 401 and null user if token is not valid', async () => {
      const res = await request(app)
        .get('/user')
        .set('Authorization', 'Bearer 123');
      expect(res.statusCode).toEqual(401);
      expect(res.body.user).toEqual(null);
    });
    it('should return 401 and null user if token is not provided', async () => {
      const res = await request(app).get('/user');
      expect(res.statusCode).toEqual(401);
      expect(res.body.user).toEqual(null);
    });

    it('should return 500 if passport.authenticate throws an error', async () => {
      const err = new Error('test error');
      const user = null;
      const info = null;
      jest
        .spyOn(passport, 'authenticate')
        .mockImplementation((strategy, options, callback) => {
          return () => {
            callback(err, user, info);
          };
        });
      const res = await request(app).get('/user');

      expect(res.statusCode).toEqual(500);
    });

    it('should return 200 and user object if token is valid', async () => {
      await request(app).post('/users').send(userObjPayload);

      const res2 = await request(app).post('/users/login').send({
        email: userObjPayload.email,
        password: userObjPayload.password,
      });

      const res3 = await request(app)
        .get('/user')
        .set('Authorization', `Bearer ${res2.body.token}`);

      expect(res3.statusCode).toEqual(200);
      expect(res3.body.user).toEqual({
        _id: expect.any(String),
        firstName: userObjPayload.firstName,
        lastName: userObjPayload.lastName,
        isAdmin: false,
      });
    });
  });

  describe('POST /users', () => {
    it("should return 401 and errors array with 6 items if fields aren't filled out", async () => {
      const res = await request(app).post('/users').send({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      expect(res.statusCode).toEqual(401);
      expect(res.body.errors.length).toEqual(6);
    });

    it('should return 401 and an error if passwords do not match', async () => {
      const res = await request(app).post('/users').send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@gmail.com',
        password: '12345678',
        confirmPassword: '123456789',
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.errors.length).toEqual(1);
      expect(res.body.errors[0].msg).toEqual('Passwords do not match.');
    });

    it('should return 403 and an error if email is already in use', async () => {
      await request(app).post('/users').send(userObjPayload);
      const res2 = await request(app).post('/users').send(userObjPayload);

      expect(res2.statusCode).toEqual(403);
      expect(res2.body.errors.length).toEqual(1);
      expect(res2.body.errors[0].msg).toEqual('Email is already in use.');
    });

    it('should return 401 if admin code is provided but is not valid', async () => {
      const res = await request(app).post('/users').send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@gmail.com',
        password: '12345678',
        confirmPassword: '12345678',
        adminCode: '123',
      });

      expect(res.statusCode).toEqual(401);
    });

    it('should return 500 if User.findOne throws an error', async () => {
      const err = new Error('test error');
      const user = null;

      User.findOne = jest
        .spyOn(User, 'findOne')
        .mockImplementation((filter, callback) => {
          callback(err, user);
        });

      const res = await request(app).post('/users').send(userObjPayload);

      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if bcrypt.hash throws an error', async () => {
      const err = new Error('test error');
      const user = null;

      bcrypt.hash = jest
        .spyOn(bcrypt, 'hash')
        .mockImplementation((password, saltRounds, callback) => {
          callback(err, user);
        });

      const res = await request(app).post('/users').send(userObjPayload);

      expect(res.statusCode).toEqual(500);
    });

    it('should return 500 if user.save throws an error', async () => {
      const err = new Error('test error');
      const user = null;

      jest.spyOn(User.prototype, 'save').mockImplementation((callback) => {
        callback(err, user);
      });

      const res = await request(app).post('/users').send(userObjPayload);

      expect(res.statusCode).toEqual(500);
    });

    it('should return 200 and user object if admin code provided is valid', async () => {
      const res = await request(app)
        .post('/users')
        .send({
          ...userObjPayload,
          adminCode: process.env.ADMIN_CODE,
        });
      expect(res.statusCode).toEqual(200);
      expect(res.body.user).toEqual({
        _id: expect.any(String),
        firstName: userObjPayload.firstName,
        lastName: userObjPayload.lastName,
        isAdmin: true,
      });
    });

    it('should return 200 and user object if user is created', async () => {
      const res = await request(app).post('/users').send(userObjPayload);

      expect(res.statusCode).toEqual(200);
      expect(res.body.user).toEqual({
        _id: expect.any(String),
        firstName: userObjPayload.firstName,
        lastName: userObjPayload.lastName,
        isAdmin: false,
      });
    });
  });

  describe('POST /users/login', () => {
    beforeEach(async () => {
      await request(app).post('/users').send(userObjPayload);
    });

    it('should return 401 and an error if email is not found', async () => {
      const res = await request(app).post('/users/login').send({
        email: 'john2@gmail.com',
        password: '123456789',
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.errors.length).toEqual(1);
      expect(res.body.errors[0].msg).toEqual('Invalid email or password.');
    });

    it('should return 401 and an error if password is incorrect', async () => {
      const res = await request(app).post('/users/login').send({
        email: userObjPayload.email,
        password: '123456789',
      });

      expect(res.statusCode).toEqual(401);
      expect(res.body.errors.length).toEqual(1);
      expect(res.body.errors[0].msg).toEqual('Invalid email or password.');
    });

    it('should return 500 if passport.authenticate throws an error', async () => {
      const err = new Error('test error');
      const user = null;

      jest
        .spyOn(passport, 'authenticate')
        .mockImplementation((strategy, options, callback) => {
          return (req, res, next) => {
            callback(err, user, next);
          };
        });

      const res = await request(app).post('/users/login').send(userObjPayload);

      expect(res.statusCode).toEqual(500);
    });

    it('next should be called with error if req.login throws error', async () => {
      const next = jest.fn();
      const err = new Error('test error');
      const user = userObjPayload;

      jest
        .spyOn(passport, 'authenticate')
        .mockImplementation((strategy, options, callback) => {
          return (req, res, next) => {
            callback(null, user, next);
          };
        });
      const req = {
        login: jest.fn(),
      };

      req.login.mockImplementation((user, {}, callback) => {
        callback(err);
      });

      userController.user_login_post(req, {}, next);

      expect(next).toHaveBeenCalledWith(err);
    });

    it('should return 200, user object and token if login attempt is successful', async () => {
      const res = await request(app).post('/users/login').send({
        email: userObjPayload.email,
        password: userObjPayload.password,
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.user).toEqual({
        _id: expect.any(String),
        firstName: userObjPayload.firstName,
        lastName: userObjPayload.lastName,
        isAdmin: false,
      });
      expect(res.body.token).toEqual(expect.any(String));
    });
  });
});
