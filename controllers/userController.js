const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const debug = require('debug')('userController');

// send user data on GET.
exports.user_get = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.send(false);
    }
    return res.send(user);
  })(req, res, next);
}

// Handle user create on POST.
exports.user_create_post = [
  // Validate fields.
  body('firstName', 'First name must include at least 3 characters.')
    .isLength({ min: 3 })
    .trim()
    .escape(),
  body('lastName', 'Last name must include at least 3 characters.')
    .isLength({ min: 3 })
    .trim()
    .escape(),
  body('email', 'Email must be a valid email address.')
    .isEmail()
    .normalizeEmail(),
  body('password', 'Password must be at least 8 characters.')
    .isLength({ min: 8 })
    .trim()
    .escape(),
  body('confirmPassword', 'Passwords must match.')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords must match.');
      }
      return true;
    })
    .trim()
    .escape(),
  // Process request after validation and sanitization.
  (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);
    console.log(req.body);

    // If there are no errors, save user to database.
    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      res.send(errors.array());
    } else {
      User.findOne({ email: req.body.email }, (err, user) => {
        if (err) {
          return next(err);
        }
        if (user) {
          // User exists, redirect to login page.
          res.redirect('/login');
        } else {
          // Hash password.
          bcrypt.hash(req.body.password, 10, (err, hash) => {
            if (err) {
              return next(err);
            }
            // Create new user object.
            const user = new User({
              firstName: req.body.firstName,
              lastName: req.body.lastName,
              email: req.body.email,
              password: hash,
            });
            // Save user to database.

            user.save((err) => {
              if (err) {
                return next(err);
              }
              // Successful - redirect to new user record.
              debug(`New user created: ${user.firstName} ${user.lastName}`);
              next();
            });
          });
        }
      });
    }
  },
];

// Handle user login on POST.
exports.user_login_post = (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      });
    }
    req.login(user, { session: false }, (err) => {
      if (err) {
        return next(err);
      }
      debug(`User ${user.firstName} ${user.lastName} logged in.`);
      // Generate JWT.
      const token = jwt.sign(user.toJSON(), process.env.JWT_SECRET);
      return res.json({
        user,
        token,
      });
    });
  })(req, res, next);
};

// Display user logout on GET.
exports.user_logout_get = (req, res, next) => {
  req.logout();
  res.redirect('/');
};
