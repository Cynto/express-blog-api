const Comment = require('../models/comment');
const Post = require('../models/post');
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
      let post;
      try {
        post = await Post.findById(req.params.postId);
        if (!post) {
          return res.status(404).send({
            errors: [{ msg: 'Post not found.' }],
          });
        }
      } catch (err) {
        return next(err);
      }

      const comment = new Comment({
        content: req.body.content,
        post: req.body.post,
        user: req.user._id,
      });

      try {
        const savedComment = await comment.save();
        post.comments.push(comment);
        await post.save();
        return res.status(201).json({ comment: savedComment });
      } catch (err) {
        return next(err);
      }
    }
  },
];

// get all comments for a post
exports.comment_get = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).send({
        errors: [{ msg: 'Post not found.' }],
      });
    }
    const comments = await Comment.find({ post: req.params.postId })
      .populate('user')
      .sort({ createdAt: -1 });
    return res.status(200).json({ comments });
  } catch (err) {
    return next(err);
  }
};

// Handle comment delete on DELETE.
exports.comment_delete_delete = [
  passport.authenticate('jwt', { session: false }),
  async (req, res, next) => {
    let comment;
    try {
      comment = await Comment.findById(req.params.commentId);
      if (!comment) {
        return res.status(404).send({
          errors: [{ msg: 'Comment not found.' }],
        });
      }
      if (comment.user.toString() !== req.user._id.toString()) {
        return res.status(403).send({
          errors: [{ msg: 'Not authorized.' }],
        });
      }
      const post = await Post.findById(comment.post);
      if (!post) {
        return res.status(404).send({
          errors: [{ msg: 'Post not found.' }],
        });
      }
      post.comments = post.comments.filter(
        (comment) => comment.toString() !== req.params.commentId
      );
      await post.save();
      await comment.remove();
      debug(`Comment deleted. ${comment.title}`);
      return res.status(200).json({ msg: 'Comment deleted.' });
    } catch (err) {
      return next(err);
    }
  },
];
