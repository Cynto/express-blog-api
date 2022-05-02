const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');

// Handle user create on POST.
exports.user_create_post = (req, res, next) => {
  res.send('NOT IMPLEMENTED: User create POST');
};

// Display list of all users.
exports.user_list_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: User list GET');
};

// Display detail page for a specific user.
exports.user_detail_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: User detail GET');
};

// Handle user login on POST.
exports.user_login_post = (req, res, next) => {
  res.send('NOT IMPLEMENTED: User login POST');
};

// Display user logout on GET.
exports.user_logout_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: User logout GET');
};
