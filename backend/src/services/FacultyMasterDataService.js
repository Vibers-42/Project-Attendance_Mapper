const FacultyRepository = require('../repositories/FacultyRepository');
const { parseFacultyExcel } = require('../utils/excelParser');
const { hashPassword } = require('../utils/passwordUtils');

class FacultyMasterDataService {
  async getFaculty(filters = {}, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const faculty = await FacultyRepository.findAll(filters, skip, limit);
    const total = await FacultyRepository.count(filters);

    return {
      faculty,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async searchFaculty(query, limit = 10) {
    if (!query || query.length < 2) {
      return [];
    }
    return await FacultyRepository.search(query, limit);
  }

  async uploadFaculty(fileBuffer) {
    // 1. Parse Excel file and validate data
    const parsedFaculty = parseFacultyExcel(fileBuffer);
    
    // 2. Hash the default password once
    const defaultPasswordHash = await hashPassword('webcap');
    
    // 3. Map the password hash to all parsed records
    const facultyWithPasswords = parsedFaculty.map(faculty => ({
      ...faculty,
      password: defaultPasswordHash
    }));

    // 4. Replace all existing faculty with the new parsed data
    const insertedCount = await FacultyRepository.replaceFaculty(facultyWithPasswords);
    
    return {
      insertedCount,
      message: `Successfully replaced Master Data with ${insertedCount} faculty members.`
    };
  }
}

module.exports = new FacultyMasterDataService();
