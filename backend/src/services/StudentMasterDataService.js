const StudentRepository = require('../repositories/StudentRepository');
const DepartmentRepository = require('../repositories/DepartmentRepository');

class StudentMasterDataService {
  async getStudents(filters = {}, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const students = await StudentRepository.findAll(filters, skip, limit);
    const total = await StudentRepository.count(filters);

    return {
      students,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getStudentProfile(rollNumber) {
    const student = await StudentRepository.findByRollNumber(rollNumber);
    if (!student) {
      const error = new Error('Student not found');
      error.statusCode = 404;
      throw error;
    }
    return student;
  }

  async searchStudents(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }
    return await StudentRepository.search(query, limit);
  }

  async getDepartments() {
    return await DepartmentRepository.findAll();
  }
}

module.exports = new StudentMasterDataService();
