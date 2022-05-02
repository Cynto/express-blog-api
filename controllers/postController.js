const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');

// Handle post create on POST.
exports.post_create_post = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post create POST');
};

// Display list of all posts.
exports.post_list_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post list GET');
};

// Display single post page.
exports.post_detail_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post detail GET');
};

// Handle post update on POST.
exports.post_update_put = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post update POST');
};

// Handle post delete on POST.
exports.post_delete_post = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Post delete POST');
};
