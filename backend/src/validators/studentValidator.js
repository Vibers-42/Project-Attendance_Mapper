const Joi = require('joi');

const importStudentSchema = Joi.object({
  rollNumber: Joi.string().required(),
  name: Joi.string().required(),
  barcode: Joi.string().required(),
  year: Joi.string().required(),
  section: Joi.string().required(),
});

module.exports = {
  importStudentSchema
};
