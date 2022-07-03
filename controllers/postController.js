const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const debug = require('debug')('postController');

// Handle post create on POST.
exports.post_create_post = [
  passport.authenticate('jwt', { session: false }),

  // Validate fields.
  body('title')
    .isLength({ min: 36 })
    .withMessage('Title must include at least 36 characters.')
    .isLength({ max: 50 })
    .withMessage('Title must not include over 50 characters.')
    .trim()
    .escape(),
  body('content')
    .isLength({ min: 80 })
    .withMessage('Content must include at least 80 characters.')
    .isLength({ max: 2500 })
    .withMessage('Content must not include over 2500 characters.')
    .trim(),
  body('image', 'Image must be a valid URL.')
    .optional({ checkFalsy: true })
    .isURL()
    .trim(),
  body('tags', 'There must be between 1 and 20 tags.')
    .isArray({
      min: 1,
      max: 20,
    })
    .isLength({ min: 1, max: 20 }),

  // Process request after validation and sanitization.
  (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);
    console.log(req.body);

    // If there are no errors, save user to database.
    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      res.status(401).send({
        errors: errors.array(),
      });
    } else {
      let url = req.body.title.toLowerCase();
      url = url.replaceAll(' ', '-');
      const post = new Post({
        title: req.body.title,
        url,
        content: req.body.content,
        image: req.body.image,
        tags: req.body.tags,
        frontBanner: req.body.frontBanner,
        user: req.user._id,
        published: req.body.published,
        featured: req.body.featured,
      });

      post.save((err) => {
        if (err) {
          return next(err);
        }
        debug(`New post created: ${post.title}`);
        console.log(post);
        res.json({ post });
      });
    }
  },
];

// Display list of all posts.
exports.post_list_get = (req, res, next) => {
  if (req.headers.frontpage) {
    Post.find({ published: true })
      .lean()
      .populate('user', 'firstName lastName')
      .populate('comments')
      .limit(10)
      .exec((err, posts) => {
        if (err) {
          console.log(err);
          return next(err);
        }
        console.log(posts);
        res.json(posts);
      });
  }
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
