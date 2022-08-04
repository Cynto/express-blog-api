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
      // check if url already exists
      Post.findOne({ url: url }, (err, post) => {
        if (err) {
          return next(err);
        }
        if (post) {
          url = `${url}-${Math.random().toString(36).slice(2)}`;
        }

        // If featured, set all other posts to featured to false.
        if (req.body.featured) {
          Post.updateMany({ featured: true }, { featured: false }, (err) => {
            if (err) {
              return next(err);
            }
          });
        }

        const newPost = new Post({
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

        newPost.save((err) => {
          if (err) {
            return next(err);
          }
          debug(`New post created: ${newPost.title}`);
          console.log(newPost);
          res.json({ post: newPost });
        });
      });
    }
  },
];

// Display list of published posts.
exports.post_published_get = (req, res, next) => {
  // Check sort header for sort order.
  const sort = req.headers.sort || '-createdAt';
  const limit = req.headers.limit || 12;

  Post.find({
    published: true,
  })
    .populate('user', 'firstName lastName')
    .sort(sort)
    .limit(limit)
    .exec((err, posts) => {
      if (err) {
        return next(err);
      }
      res.json(posts);
    });
};

// Display list of all posts.
exports.post_list_get = [
  passport.authenticate('jwt', { session: false }),
  (req, res, next) => {
    let sort = req.headers.sort || '-createdAt';

    const limit = req.headers.limit || 12;

    if (sort !== 'comments') {
      Post.find({})
        .lean()
        .populate('user', 'firstName lastName')
        .populate('comments')
        .sort(sort)
        .limit(limit)
        .exec((err, posts) => {
          if (err) {
            console.log(err);
            return next(err);
          }
          res.json(posts);
        });
    } else {
      Post.aggregate([
        {
          $lookup: {
            from: 'comments',
            localField: '_id',
            foreignField: 'post',
            as: 'comments',
          },
        },

        {
          $addFields: {
            commentsCount: { $size: '$comments' },
          },
        },

        {
          $sort: { commentsCount: -1 },
        },
        {
          $limit: limit,
        },
        {
          $lookup: {
            from: 'users',
            localField: 'user',
            foreignField: '_id',
            as: 'user',
          },
        },
        {
          $unwind: '$user',
        },
        {
          $project: {
            _id: 1,
            title: 1,
            url: 1,
            content: 1,
            image: 1,
            tags: 1,
            frontBanner: 1,
            user: 1,
            published: 1,
            featured: 1,
            comments: 1,
            commentsCount: 1,
            user: {
              _id: 1,
              firstName: '$user.firstName',
              lastName: '$user.lastName',
            },
          },
        },
      ]).exec((err, posts) => {
        console.log(posts);
        if (err) {
          return next(err);
        }
        res.json(posts);
      });
    }
  },
];

// Display single post page.
exports.post_detail_get = (req, res, next) => {
  Post.findOne({ url: req.params.url })
    .lean()
    .populate('user', 'firstName lastName')

    .exec((err, post) => {
      if (err) {
        return next(err);
      }
      if (!post) {
        return res.status(404).send('Post not found.');
      }
      res.json(post);
    });
};

// Handle post update on POST.
exports.post_update_put = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post update POST');
};

// Handle post delete on DELETE.
exports.post_delete_post = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post delete DELETE');
};
