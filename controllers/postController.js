const Post = require('../models/post');
const User = require('../models/user');
const { validationResult } = require('express-validator');
const passport = require('passport');
const debug = require('debug')('postController');
const validator = require('../utils/validators.js');

// Handle post create on POST.
exports.post_create_post = [
  passport.authenticate('jwt', { session: false }),

  // Validate fields.
  ...validator.validatePost,
  // Process request after validation and sanitization.
  async (req, res, next) => {
    if (req.user.isAdmin) {
      // Extract the validation errors from a request.
      const errors = validationResult(req);

      // If there are no errors, save user to database.
      if (!errors.isEmpty()) {
        // There are errors. Render form again with sanitized values/error messages.
        return res.status(400).send({
          errors: errors.array(),
        });
      }
      let url = req.body.title.toLowerCase();
      url = url.replaceAll(' ', '-');
      url = url.replaceAll('?', '');
      // check if url already exists

      try {
        const post = await Post.findOne({ url: url });
        if (post) {
          url = `${url}-${Math.random().toString(36).slice(2)}`;
        }
      } catch (err) {
        return next(err);
      }

      // If featured, set all other posts to featured to false.
      if (req.body.featured === 'true') {
        try {
          Post.updateMany({ featured: true }, { featured: false });
        } catch (error) {
          return next(error);
        }
      }

      let imgurURL;
      if (!req.body.image.includes('i.imgur.com')) {
        const imgurFormData = new FormData();
        imgurFormData.append('image', req.body.image);
        try {
          const imgurResponse = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
              Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
            },
            body: imgurFormData,
          });

          const imgurData = await imgurResponse.json();
          imgurURL = imgurData.data.link;
        } catch (error) {
          return next(error);
        }
      }

      const newPost = new Post({
        title: req.body.title,
        url,
        content: req.body.content,
        image: imgurURL ? imgurURL : req.body.image,
        tags: req.body.tags,
        frontBanner: req.body.frontBanner,
        user: req.user._id,
        published: req.body.published,
        featured: req.body.featured,
      });

      try {
        const savedPost = await newPost.save();
        return res.status(201).json({ post: savedPost });
      } catch (error) {
        return next(error);
      }
    } else {
      return res.status(403).send('You are not authorized to create a post.');
    }
  },
];

// Display list of all posts.
exports.post_list_get = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user) => {
    if (err) {
      return next(err);
    }

    let sort = req.headers.sort || '-createdAt';
    let allPosts = req.headers.allposts || false;
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

    if (!user || user.isAdmin === false) {
      allPosts = false;
    } else if (user.isAdmin === true && allPosts === 'true') {
      allPosts = true;
    }

    return Post.aggregate(
      [
        {
          $match: {
            published: allPosts ? { $in: [true, false] } : true,
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
            published: 1,
            featured: 1,
            comments: 1,
            commentsCount: 1,
            user: {
              _id: 1,
              firstName: '$user.firstName',
              lastName: '$user.lastName',
            },
            createdAt: 1,
            updatedAt: 1,
          },
        },
      ],
      (err, posts) => {
        if (err) {
          return next(err);
        }

        res.json(posts);
      }
    );
  })(req, res, next);
};
// Display single post page.
exports.post_detail_get = async (req, res, next) => {
  try {
    const post = await Post.findOne({ url: req.params.url })
      .lean()
      .populate('user', 'firstName lastName')
      .populate({
        path: 'comments',
        populate: {
          path: 'user',
          select: 'firstName lastName',
          model: User,
        },
      });

    if (!post) {
      return res.status(404).json({
        post: null,
      });
    }
    if (post.published === false) {
      passport.authenticate('jwt', { session: false }, (err, user) => {
        if (err) {
          return next(err);
        }
        if (!user || user.isAdmin === false) {
          return res.status(403).json({ post: post, authorized: false });
        }
        if (user.isAdmin === true) {
          return res.status(200).json({ post });
        }
      })(req, res, next);
    } else {
      return res.status(200).json({ post });
    }
  } catch (error) {
    return next(error);
  }
};

// Handle post update on POST.
exports.post_update_put = [
  passport.authenticate('jwt', { session: false }),
  // Validate fields.
  ...validator.validatePost,
  async (req, res, next) => {
    if (req.user.isAdmin) {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      const { title, content, image, tags, published, featured } = req.body;
      // Check if post with url already exists. If it does, add a number to the end of the url.
      let url;
      try {
        url = title.toLowerCase().replace(/ /g, '-');
        url = url.replaceAll('?', '');
        // Check if url is already taken.
        const postWithURL = await Post.findOne({ url: url });

        if (postWithURL && postWithURL._id !== req.params.id) {
          url = `${url}-${Math.random().toString(36).slice(2)}`;
        }
      } catch (error) {
        return next(error);
      }

      let post;
      try {
        post = await Post.findById(req.params.id);

        if (!post) {
          return res.status(404).json({
            post: null,
          });
        }
        if (post.user.toString() !== req.user.id) {
          return res.status(403).json({ msg: 'User not authorized.' });
        }
      } catch (error) {
        return next(error);
      }
      let newImgURL;
      if (!image.includes('imgur')) {
        const imgurFormData = new FormData();
        imgurFormData.append('image', image);
        try {
          const imgurResponse = await fetch('https://api.imgur.com/3/image', {
            method: 'POST',
            headers: {
              Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
            },
            body: imgurFormData,
          });

          const imgurData = await imgurResponse.json();
          newImgURL = imgurData.data.link;
        } catch (error) {
          return next(error);
        }
      }

      try {
        post.title = title;
        post.content = content;
        post.image = newImgURL || image;
        post.tags = tags;
        post.published = published;
        post.featured = featured;
        post.url = url;
        await post.save();
        res.status(200).json({ post });
      } catch (error) {
        return next(error);
      }
    } else {
      return res.status(403).send('You are not authorized to edit this post.');
    }
  },
];

// Handle post delete on DELETE.
exports.post_delete_post = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, async (err, user) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.status(401).send('You must be logged in to delete a post.');
    }
    if (!user.isAdmin) {
      return res.status(403).send('You are not authorized to delete a post.');
    }
    try {
      const post = await Post.findByIdAndDelete(req.params.id);

      if (!post) {
        return res.status(404).json({
          status: 404,
        });
      }
      debug(`Post deleted: ${post.title}`);
      return res.status(204).json({
        status: 204,
      });
    } catch (error) {
      return next(error);
    }
  })(req, res, next);
};
