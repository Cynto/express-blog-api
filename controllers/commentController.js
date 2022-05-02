const Comment = require('../models/comment');
const Post = require('../models/post');
const User = require('../models/user');

// Handle comment create on POST.
exports.comment_create_post = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Comment create POST');
};

// Display list of all comments.
exports.comment_list_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Comment list GET');
}

// Display detail page for a specific comment.
exports.comment_detail_get = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Comment detail GET');
}

// Handle comment update on PUT.
exports.comment_update_put = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Comment update PUT');
}
// Handle comment delete on DELETE.
exports.comment_delete_delete = (req, res, next) => {
  res.send('NOT IMPLEMENTED: Comment delete DELETE');
}