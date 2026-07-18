const FacultyRepository = require('../repositories/FacultyRepository');
const { parseFacultyExcel } = require('../utils/excelParser');
const { hashPassword } = require('../utils/passwordUtils');
const { ConflictError, NotFoundError } = require('../utils/AppError');
const prisma = require('../config/prisma');

const DEFAULT_PASSWORD = 'webcap';

class FacultyMasterDataService {

  /**
   * Unified browse + search, both paginated.
   * When query is present, filters by employeeId or name.
   */
  async getFaculty(filters = {}, page = 1, limit = 50, query = '') {
    const skip = (page - 1) * limit;

    let faculty, total;

    if (query && query.trim().length > 0) {
      [faculty, total] = await Promise.all([
        FacultyRepository.searchPaginated(query.trim(), skip, limit),
        FacultyRepository.searchCount(query.trim()),
      ]);
    } else {
      [faculty, total] = await Promise.all([
        FacultyRepository.findAll(filters, skip, limit),
        FacultyRepository.count(filters),
      ]);
    }

    return {
      faculty,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Add a single faculty member.
   * - facultyId is normalised to UPPERCASE.
   * - Default password is 'webcap' (bcrypt-hashed).
   */
  async addFaculty({ facultyId, name }) {
    const normId = String(facultyId).toUpperCase().trim();

    // Guard: duplicate
    const existing = await FacultyRepository.findByFacultyId(normId);
    if (existing) {
      throw new ConflictError(`Faculty with Employee ID "${normId}" already exists.`);
    }

    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    return await FacultyRepository.createOne({
      facultyId: normId,
      name: String(name).trim(),
      password: passwordHash,
      role: 'FACULTY',
      isActive: true,
    });
  }

  /**
   * Hard-delete a faculty member by their internal UUID.
   * Cascade removes their sessions and timetable entries.
   */
  async deleteFaculty(id) {
    const faculty = await prisma.faculty.findUnique({ where: { id } });
    if (!faculty) throw new NotFoundError('Faculty member not found.');
    return await FacultyRepository.deleteById(id);
  }

  /**
   * Bulk-replace all faculty from an Excel file.
   * Each faculty gets password = bcrypt('webcap').
   */
  async uploadFaculty(fileBuffer) {
    const parsedFaculty = parseFacultyExcel(fileBuffer);
    const passwordHash = await hashPassword(DEFAULT_PASSWORD);

    const facultyWithPasswords = parsedFaculty.map((f) => ({
      ...f,
      password: passwordHash,
    }));

    const insertedCount = await FacultyRepository.replaceFaculty(facultyWithPasswords);

    return {
      insertedCount,
      message: `Successfully replaced Faculty Master Data with ${insertedCount} records.`,
    };
  }
}

module.exports = new FacultyMasterDataService();
