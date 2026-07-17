const prisma = require('../config/prisma');

class DepartmentRepository {
  async findAll() {
    return prisma.department.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findById(id) {
    return prisma.department.findUnique({ where: { id } });
  }
}

module.exports = new DepartmentRepository();
