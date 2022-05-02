const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const jwt = require('jsonwebtoken');

// Handle user create on POST.
exports.user_create_post = [
  // Validate fields.
  body('first-name', 'First name must include at least 3 characters.')
    .isLength({ min: 3 })
    .trim()
    .escape(),
  body('last-name', 'Last name must include at least 3 characters.')
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
  body('confirm-password', 'Passwords must match.').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords must match.');
    }
    return true;
  }),
  // Process request after validation and sanitization.
  (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    // If there are no errors, save user to database.
    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      res.render('user_form', {
        title: 'Create User',
        user: user,
        errors: errors.array(),
      });
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
              res.redirect(user.url);
            });
          });
        }
      });
    }
  },
];

// Display list of all users.
exports.user_list_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: User list GET');
};

// Display detail page for a specific user.
exports.user_detail_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: User detail GET');
};

// Handle user login on POST.
exports.user_login_post = (req, res, next) => {
  res.send('NOT IMPLEMENTED: User login POST');
};

// Display user logout on GET.
exports.user_logout_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: User logout GET');
};
