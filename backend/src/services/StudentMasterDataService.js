const StudentRepository = require('../repositories/StudentRepository');
const DepartmentRepository = require('../repositories/DepartmentRepository');
const { parseStudentExcel } = require('../utils/excelParser');

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

  async uploadStudents(fileBuffer) {
    // 1. Parse Excel file and validate data
    const parsedStudents = parseStudentExcel(fileBuffer);
    
    // 2. Replace all existing students with the new parsed data
    const insertedCount = await StudentRepository.replaceStudents(parsedStudents);
    
    // 3. Return outcome message
    return {
      insertedCount,
      message: `Successfully replaced Master Data with ${insertedCount} students.`
    };
  }
}

module.exports = new StudentMasterDataService();
