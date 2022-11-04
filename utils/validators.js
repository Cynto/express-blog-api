const { body } = require('express-validator');

exports.validatePost = [
  body('title')
    .isLength({ min: 5 })
    .withMessage('Title must include at least 5 characters.')
    .isLength({ max: 75 })
    .withMessage('Title must not include over 75 characters.')
    .trim(),

  body('content')
    .isLength({ min: 5 })
    .withMessage('Content must include at least 5 characters.')
    .isLength({ max: 10000 })
    .withMessage('Content must not include over 10000 characters.')
    .trim(),
  body('image', 'Image must be a valid URL.').isURL().trim(),
  body('tags')
    .isArray({})
    .custom((value) => {
      if (value.length > 20) {
        throw new Error('Tags must not include over 20 tags.');
      }
      if (value.length === 0) {
        throw new Error('Tags must include at least 1 tag.');
      }
      return true;
    })
    .withMessage('There must be between 1 and 20 tags.')
    .isLength({ min: 4, max: 20 })
    .withMessage('Each tag must include between 4 and 20 characters.'),
  body('published')
    .isBoolean()
    .withMessage('Published must be a boolean.')
    .trim(),
  body('featured')
    .isBoolean()
    .withMessage('Featured must be a boolean.')
    .trim(),
];
