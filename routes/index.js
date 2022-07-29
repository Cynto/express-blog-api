const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const postController = require('../controllers/postController');
const commentController = require('../controllers/commentController');
const replyController = require('../controllers/replyController');

/// USER ROUTES ///

// GET user data.
router.get('/user', userController.user_get);

// POST request for creating User.
router.post('/users', userController.user_create_post);

// POST request to login.
router.post('/users/login', userController.user_login_post);

// GET request to logout.
router.get('/users/logout', userController.user_logout_get);

/// POST ROUTES ///

// POST request for creating Post.
router.post('/posts', postController.post_create_post);

// GET request for list of all posts.
router.get('/posts', postController.post_list_get);

// GET request for one post.
router.get('/posts/:url', postController.post_detail_get);

// PUT request to update post.
router.put('/posts/:id', postController.post_update_put);

// DELETE request to delete post.
router.delete('/posts/:id', postController.post_delete_post);

/// COMMENT ROUTES ///

// POST request for creating Comment.
router.post('/posts/:postId/comments', commentController.comment_create_post);

// GET request for list of all comments.
router.get('/posts/:postId/comments', commentController.comment_list_get);

// GET request for one comment.
router.get('/posts/:postId/comments/:id', commentController.comment_detail_get);

// DELETE request to delete comment.
router.delete(
  '/posts/:postId/comments/:id',
  commentController.comment_delete_delete
);

/// REPLY ROUTES ///

// POST request for creating Reply.
router.post(
  '/posts/:postId/comments/:commentId/replies',
  replyController.reply_create_post
);

// GET request for list of all replies.
router.get(
  '/posts/:postId/comments/:commentId/replies',
  replyController.reply_list_get
);

// DELETE request to delete reply.
router.delete(
  '/posts/:postId/comments/:commentId/replies/:id',
  replyController.reply_delete_delete
);

module.exports = router;
