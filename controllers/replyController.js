const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');
const Reply = require('../models/reply');
const { body, validationResult } = require('express-validator');
const passport = require('passport');
const debug = require('debug')('postController');

// Handle reply create on POST.
exports.reply_create_post = [
  passport.authenticate('jwt', { session: false }),

  // Validate fields.
  body('content')
    .isLength({ min: 5 })
    .withMessage('Reply must include at least 5 characters.')
    .isLength({ max: 240 })
    .withMessage('Reply must not include over 240 characters.')
    .trim(),

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
      const reply = new Reply({
        content: req.body.content,
        comment: req.body.comment,
        user: req.user._id,
        originalUser: req.body.originalUser,
      });
      reply.save((err) => {
        if (err) {
          return next(err);
        }
        debug(`Reply created: ${reply}`);
        Comment.findById(req.body.comment, (err, comment) => {
          if (err) {
            return next(err);
          }
          comment.replies.push(reply);
          comment.save((err) => {
            if (err) {
              return next(err);
            }
            debug(`Reply added to comment: ${comment}`);
          });
        });
        res.status(201).json({
          reply: reply,
        });
      });
    }
  },
];

// get all replies for a comment
exports.reply_list_get = (req, res, next) => {
  Reply.find({
    comment: req.params.commentId,
  })
    .populate('user', 'firstName lastName')
    .populate('originalUser', 'firstName lastName')
    .limit(10)
    .exec((err, replies) => {
      if (err) {
        return next(err);
      }
      console.log(replies);
      res.json({ replies });
    });
};

// Handle reply delete on DELETE.
exports.reply_delete_delete = [
  passport.authenticate('jwt', { session: false }),
  (req, res, next) => {
    Reply.findById(req.params.id, (err, reply) => {
      if (err) {
        return next(err);
      }
      if (!reply) {
        return res.status(404).send({
          message: 'Reply not found.',
        });
      }
      if (reply.user.toString() !== req.user._id.toString()) {
        return res.status(401).send({
          message: 'You are not authorized to delete this reply.',
        });
      }
      reply.remove((err) => {
        if (err) {
          return next(err);
        }
        // delete the reply from the comment
        Comment.findById(reply.comment, (err, comment) => {
          if (err) {
            return next(err);
          }
          comment.replies.pull(reply);
          comment.save((err) => {
            if (err) {
              return next(err);
            }
            debug(`Reply removed from comment: ${comment}`);
          });
        });

        debug(`Reply deleted: ${reply}`);
        res.status(204).json({
          deleted: true,
        });
      });
    });
  },
];
