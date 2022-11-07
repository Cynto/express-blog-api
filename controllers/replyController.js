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
  async (req, res, next) => {
    // Extract the validation errors from a request.
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      // There are errors. Render form again with sanitized values/error messages.
      res.status(400).send({
        errors: errors.array(),
      });
    } else {
      let comment;

      try {
        comment = await Comment.findById(req.params.commentId);
        if (!comment) {
          return res.status(404).send({
            errors: [{ msg: 'Comment not found.' }],
          });
        }
      } catch (err) {
        return next(err);
      }

      const reply = new Reply({
        content: req.body.content,
        comment: req.body.comment,
        user: req.user._id,
        originalUser: req.body.originalUser,
      });
      try {
        const savedReply = await reply.save();
        comment.replies.push(reply);
        comment.save();
        debug(`Reply added to comment: ${comment.title}`);

        return res.status(201).json({ reply: savedReply });
      } catch (err) {
        return next(err);
      }
    }
  },
];

// get all replies for a comment
exports.reply_list_get = async (req, res, next) => {
  try {
    const replies = await Reply.find({ comment: req.params.commentId })
      .populate('user', 'firstName lastName')
      .populate('originalUser', 'firstName lastName')
      .limit(10);
    if (replies.length === 0) {
      return res.status(404).send({
        errors: [{ msg: 'No replies found.' }],
      });
    }
    return res.status(200).json({ replies });
  } catch (err) {
    return next(err);
  }
};

// Handle reply delete on DELETE.
exports.reply_delete_delete = [
  passport.authenticate('jwt', { session: false }),
  async (req, res, next) => {
    let reply;
    try {
      reply = await Reply.findById(req.params.replyId);
      if (!reply) {
        return res.status(404).send({
          errors: [{ msg: 'Reply not found.' }],
        });
      }
      if (reply.user.toString() !== req.user._id.toString()) {
        return res.status(403).send({
          errors: [{ msg: 'Unauthorized.' }],
        });
      }
      const comment = await Comment.findById(req.params.commentId);
      if (!comment) {
        return res.status(404).send({
          errors: [{ msg: 'Comment not found.' }],
        });
      }

      comment.replies = comment.replies.filter(
        (reply) => reply.toString() !== req.params.replyId
      );
      await comment.save();
      await reply.remove();
      debug(`Reply deleted: ${reply}`);
      return res.status(200).send({ msg: 'Reply deleted.' });
    } catch (err) {
      return next(err);
    }
  },
];
