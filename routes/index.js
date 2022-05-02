const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');

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

module.exports = router;
