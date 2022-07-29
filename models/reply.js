const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReplySchema = new Schema({
  content: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 240,
  },
  comment: {
    type: Schema.Types.ObjectId,
    ref: 'Comment',
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  originalUser: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Reply', ReplySchema);
