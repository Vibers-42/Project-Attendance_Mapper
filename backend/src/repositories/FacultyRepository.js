const prisma = require('../config/prisma');

class FacultyRepository {
  async findById(id) {
    return prisma.faculty.findUnique({ where: { id } });
  }

  async findByFacultyId(facultyId) {
    return prisma.faculty.findUnique({ where: { facultyId } });
  }

  async update(id, data) {
    return prisma.faculty.update({ where: { id }, data });
  }
}

module.exports = new FacultyRepository();
