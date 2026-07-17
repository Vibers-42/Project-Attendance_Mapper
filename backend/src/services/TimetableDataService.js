const TimetableRepository = require('../repositories/TimetableRepository');

class TimetableDataService {
  async getTimetableEntries(filters = {}, page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const entries = await TimetableRepository.findAll(filters, skip, limit);
    const total = await TimetableRepository.count(filters);

    return {
      entries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async getFacultySchedule(facultyId, dayOfWeek) {
    if (!facultyId) {
      throw new Error('Faculty ID is required');
    }
    return await TimetableRepository.findByFaculty(facultyId, dayOfWeek);
  }

  async getSectionSchedule(sectionId, dayOfWeek) {
    if (!sectionId) {
      throw new Error('Section ID is required');
    }
    return await TimetableRepository.findBySection(sectionId, dayOfWeek);
  }
}

module.exports = new TimetableDataService();
