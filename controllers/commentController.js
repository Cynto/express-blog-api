const Comment = require('../models/comment');
const Post = require('../models/post');
const User = require('../models/user');
const passport = require('passport');
const { body, validationResult } = require('express-validator');
const debug = require('debug')('postController');

// Handle comment create on POST.
exports.comment_create_post = [
  passport.authenticate('jwt', { session: false }),
  // Validate fields.
  body('content')
    .isLength({ min: 5 })
    .withMessage('Comment must include at least 5 characters.')
    .isLength({ max: 240 })
    .withMessage('Comment must not include over 240 characters.')
    .trim()
    .escape(),
  // Process request after validation and sanitization.
  (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      res.status(401).send({
        errors: errors.array(),
      });
    } else {
      const comment = new Comment({
        content: req.body.content,
        post: req.body.post,
        user: req.user._id,
      });
      comment.save((err) => {
        if (err) {
          return next(err);
        }
        debug(`Comment created: ${comment}`);
        // Update post's comment array.
        Post.findById(req.body.post, (err, post) => {
          if (err) {
            return next(err);
          }
          post.comments.push(comment);
          post.save((err) => {
            if (err) {
              return next(err);
            }
            debug(`Comment added to post: ${post}`);
          });
        });
        res.status(201).json({
          comment: comment,
        });
      });
    }
  },
];

// Display list of all comments.
exports.comment_list_get = (req, res, next) => {
  Comment.find({
    post: req.params.postId,
  })
    .populate('user', 'firstName lastName')
    .exec((err, comments) => {
      if (err) {
        return next(err);
      }
      res.json({ comments });
    });
};

// Display detail page for a specific comment.
exports.comment_detail_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Comment detail GET');
};

// Handle comment delete on DELETE.
exports.comment_delete_delete = [
  passport.authenticate('jwt', { session: false }),
  (req, res, next) => {
    Comment.findById(req.params.id, (err, comment) => {
      if (err) {
        return next(err);
      }
      if (!comment) {
        return res.status(404).send({
          message: 'Comment not found.',
        });
      }
      if (comment.user.toString() !== req.user._id.toString()) {
        return res.status(401).send({
          message: 'You are not authorized to delete this comment.',
        });
      }
      comment.remove((err) => {
        if (err) {
          return next(err);
        }

        // delete the comment from the post
        Post.findById(comment.post, (err, post) => {
          if (err) {
            return next(err);
          }
          post.comments.pull(comment);
          post.save((err) => {
            if (err) {
              return next(err);
            }
            debug(`Comment removed from post: ${post}`);
          });
        });

        debug(`Comment deleted: ${comment.title}`);
        res.status(204).send();
      });
    });
  },
];
