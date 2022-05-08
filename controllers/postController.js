const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');
const { body, validationResult } = require('express-validator');

// Handle post create on POST.
exports.post_create_post = [
  // Validate fields.
  body('title', 'Title must include between 5 and 100 characters.')
    .isLength({ min: 5, max: 100 })
    .trim()
    .escape(),
  body('content', 'Content must include between 5 and 1500 characters.')
    .isLength({ min: 5, max: 1500 })
    .trim()
    .escape(),
  body('image', 'Image must be a valid URL.').isURL().trim(),
  body('tags', 'Tags must include between 1 and 20 characters.')
    .isLength({ min: 1, max: 20 })
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
      const post = new Post({
        title: req.body.title,
        content: req.body.content,
        image: req.body.image,
        tags: req.body.tags,
        user: req.user._id,
        published: false,
      });
      post.save((err) => {
        if (err) {
          return next(err);
        }
        return res.send(post);
      });
    }
  },
];

// Display list of all posts.
exports.post_list_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post list GET');
};

// Display single post page.
exports.post_detail_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post detail GET');
};

// Handle post update on POST.
exports.post_update_put = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post update POST');
};

// Handle post delete on DELETE.
exports.post_delete_post = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post delete DELETE');
};
