const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema({
  title: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 100,
  },
  content: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 1500,
  },
  tags: {
    type: [String],
    required: true,
    minlength: 1,
    maxlength: 20,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  published: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Post', PostSchema);
