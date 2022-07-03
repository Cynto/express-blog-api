const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema({
  title: {
    type: String,
    required: true,
    minlength: 35,
    maxlength: 50,
  },
  url: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
    minlength: 80,
    maxlength: 2500,
  },
  image: {
    type: String,
    required: false,
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
  comments: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
    },
  ],

  published: {
    type: Boolean,
    default: false,
  },

  featured: {
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
