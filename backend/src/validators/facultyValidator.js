const Joi = require('joi');

const loginSchema = Joi.object({
  facultyId: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

const importSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('SUPER_ADMIN', 'FACULTY').default('FACULTY'),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

module.exports = {
  loginSchema,
  importSchema,
  changePasswordSchema
};
