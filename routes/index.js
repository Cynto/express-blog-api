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
router.get('/posts/:postId/comments', commentController.comment_get);

// DELETE request to delete comment.
router.delete(
  '/posts/:postId/comments/:commentId',
  commentController.comment_delete_delete
);

/// REPLY ROUTES ///

// POST request for creating Reply.
router.post('/comments/:commentId/replies', replyController.reply_create_post);

// GET request for list of all replies.
router.get('/comments/:commentId/replies', replyController.reply_list_get);

// DELETE request to delete reply.
router.delete(
  '/comments/:commentId/replies/:replyId',
  replyController.reply_delete_delete
);

module.exports = router;
