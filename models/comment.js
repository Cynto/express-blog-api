const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CommentSchema = new Schema({
  content: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 240,
  },
  post: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Comment', CommentSchema);
