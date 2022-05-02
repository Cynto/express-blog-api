const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const postController = require('../controllers/postController');

/// USER ROUTES ///

// POST request for creating User.
router.post('/users', userController.user_create_post);

// GET request for list of all users.
router.get('/users', userController.user_list_get);

// GET request for one user.
router.get('/users/:id', userController.user_detail_get);

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
router.get('/posts/:id', postController.post_detail_get);

// PUT request to update post.
router.put('/posts/:id', postController.post_update_post);

// DELETE request to delete post.
router.delete('/posts/:id', postController.post_delete_post);


module.exports = router;
