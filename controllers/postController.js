const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const debug = require('debug')('postController');
const fetch = require('node-fetch');
const FormData = require('form-data');

// Handle post create on POST.
exports.post_create_post = [
  passport.authenticate('jwt', { session: false }),

  // Validate fields.
  body('title')
    .isLength({ min: 5 })
    .withMessage('Title must include at least 5 characters.')
    .isLength({ max: 50 })
    .withMessage('Title must not include over 50 characters.')
    .trim()
    .escape(),
  body('content')
    .isLength({ min: 5 })
    .withMessage('Content must include at least 5 characters.')
    .isLength({ max: 10000 })
    .withMessage('Content must not include over 10000 characters.')
    .trim(),
  body('image', 'Image must be a valid URL.').isURL().trim(),
  body('tags')
    .isArray({})
    .custom((value) => {
      if (value.length > 20) {
        throw new Error('Tags must not include over 20 tags.');
      }
      if (value.length === 0) {
        throw new Error('Tags must include at least 1 tag.');
      }
      return true;
    })
    .withMessage('There must be between 1 and 20 tags.')
    .isLength({ min: 4, max: 20 })
    .withMessage('Each tag must include between 4 and 20 characters.'),
  body('published')
    .isBoolean()
    .withMessage('Published must be a boolean.')
    .trim(),
  body('featured')
    .isBoolean()
    .withMessage('Featured must be a boolean.')
    .trim(),
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
        if (req.body.featured === 'true') {
          Post.updateMany({ featured: true }, { featured: false }, (err) => {
            if (err) {
              return next(err);
            }
          });
        }
      });
      if (!req.body.image.includes('i.imgur.com')) {
        const imgurFormData = new FormData();
        imgurFormData.append('image', req.body.image);

        fetch('https://api.imgur.com/3/image', {
          method: 'POST',
          headers: {
            Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
          },
          body: imgurFormData,
        })
          .then((response) => response.json())
          .then((json) => {
            console.log(json);
            if (json.success) {
              const newPost = new Post({
                title: req.body.title,
                url,
                content: req.body.content,
                image: json.data.link,
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
            }
          })
          .catch((err) => {
            return next(err);
          });
      } else {
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
      }
    }
  },
];

// Display list of published posts.
exports.post_published_get = (req, res, next) => {
  // Check sort header for sort order.
  const sort = req.headers.sort || '-createdAt';
  const limit = Number(req.headers.limit) || 15;

  Post.aggregate([
    {
      $match: {
        published: true,
      },
    },
    {
      $lookup: {
        from: 'comments',
        localField: '_id',
        foreignField: 'post',
        as: 'comments',
      },
    },
    {
      $lookup: {
        from: 'replies',
        localField: 'comments._id',
        foreignField: 'comment',
        as: 'replies',
      },
    },
    {
      $addFields: {
        comments: {
          $setUnion: ['$comments', '$replies'],
        },
      },
    },

    {
      $sort: {
        createdAt: -1,
      },
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
        user: {
          _id: 1,
          firstName: '$user.firstName',
          lastName: '$user.lastName',
        },
      },
    },
  ]).exec((err, posts) => {
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

    const limit = Number(req.headers.limit) || 12;
    if (sort === '-createdAt') {
      sort = {
        createdAt: -1,
      };
    } else if (sort === 'createdAt') {
      sort = {
        createdAt: 1,
      };
    } else {
      sort = {
        commentsCount: -1,
      };
    }

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
        $lookup: {
          from: 'replies',
          localField: 'comments._id',
          foreignField: 'comment',
          as: 'replies',
        },
      },
      {
        $addFields: {
          commentsCount: {
            $add: [{ $size: '$comments' }, { $size: '$replies' }],
          },
        },
      },
      {
        $addFields: {
          comments: {
            $setUnion: ['$comments', '$replies'],
          },
        },
      },
      {
        $sort: sort,
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
      if (err) {
        return next(err);
      }
      res.json(posts);
    });
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
        return res.status(404).json({
          message: 'Post not found.',
        });
      }
      res.json({ post });
    });
};

// Handle post update on POST.
exports.post_update_put = [
  passport.authenticate('jwt', { session: false }),
  // Validate fields.
  body('title')
    .isLength({ min: 5 })
    .withMessage('Title must include at least 5 characters.')
    .isLength({ max: 50 })
    .withMessage('Title must not include over 50 characters.')
    .trim()
    .escape(),
  body('content')
    .isLength({ min: 5 })
    .withMessage('Content must include at least 5 characters.')
    .isLength({ max: 10000 })
    .withMessage('Content must not include over 10000 characters.')
    .trim(),
  body('image', 'Image must be a valid URL.').isURL().trim(),
  body('tags')
    .isArray({})
    .custom((value) => {
      if (value.length > 20) {
        throw new Error('Tags must not include over 20 tags.');
      }
      if (value.length === 0) {
        throw new Error('Tags must include at least 1 tag.');
      }
      return true;
    })
    .withMessage('There must be between 1 and 20 tags.')
    .isLength({ min: 4, max: 20 })
    .withMessage('Each tag must include between 4 and 20 characters.'),
  body('published')
    .isBoolean()
    .withMessage('Published must be a boolean.')
    .trim(),
  body('featured')
    .isBoolean()
    .withMessage('Featured must be a boolean.')
    .trim(),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    const { title, content, image, tags, published, featured } = req.body;
    Post.findById(req.params.id, (err, post) => {
      if (err) {
        return next(err);
      }
      if (!post) {
        return res.status(404).send('Post not found.');
      }
      if (post.user.toString() !== req.user._id.toString()) {
        console.log('hi');
        return res
          .status(401)
          .send('You are not authorized to edit this post.');
      }
      let url = title.toLowerCase().replace(/ /g, '-');
      // Check if url is already taken.
      Post.findOne({ url: url }, (err, postWithUrl) => {
        if (err) {
          return next(err);
        }
        if (postWithUrl) {
          if (postWithUrl._id.toString() !== req.params.id) {
            url = `${url}-${Math.random().toString(36).slice(2)}`;
          }
        }
      });
      if (!post.image.includes('imgur')) {
        const imgurFormData = new FormData();

        imgurFormData.append('image', req.body.image);

        fetch('https://api.imgur.com/3/image', {
          method: 'POST',
          headers: {
            Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
          },
          body: imgurFormData,
        })
          .then((response) => response.json())
          .then((json) => {
            console.log(json);
            if (json.success) {
              post.title = title;
              post.url = url;
              post.content = content;
              post.image = json.data.link;
              post.tags = tags;
              post.published = published;
              post.featured = featured;
              post.updatedAt = Date.now();
              post.save((err) => {
                if (err) {
                  return next(err);
                }
                res.json({ post });
              });
            } else {
              post.title = title;
              post.url = url;
              post.content = content;
              post.image = image;
              post.tags = tags;
              post.published = published;
              post.featured = featured;
              post.updatedAt = Date.now();
              post.save((err) => {
                if (err) {
                  return next(err);
                }
                res.json({ post });
              });
            }
          })
          .catch((err) => {
            return next(err);
          });
      } else {
        post.title = title;
        post.url = url;
        post.content = content;
        post.image = image;
        post.tags = tags;
        post.published = published;
        post.featured = featured;
        post.updatedAt = Date.now();
        post.save((err) => {
          if (err) {
            return next(err);
          }
          res.json({ post });
        });
      }
    });
  },
];

// Handle post delete on DELETE.
exports.post_delete_post = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post delete DELETE');
};
