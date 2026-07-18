const FacultyRepository = require('../repositories/FacultyRepository');
const { parseFacultyExcel } = require('../utils/excelParser');
const { hashPassword } = require('../utils/passwordUtils');
const { ConflictError, NotFoundError, BadRequestError } = require('../utils/AppError');
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

    // Unify roles: if a faculty is an original Super Admin in the SuperAdmin table,
    // ensure their role is reported as SUPER_ADMIN to the frontend.
    const activeSuperAdmins = await prisma.superAdmin.findMany({
      where: { isActive: true },
      select: { employeeId: true },
    });
    const superAdminIds = new Set(activeSuperAdmins.map((s) => s.employeeId));

    const unifiedFaculty = faculty.map((f) => ({
      ...f,
      role: superAdminIds.has(f.facultyId) ? 'SUPER_ADMIN' : f.role,
    }));

    return {
      faculty: unifiedFaculty,
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
   * Promote one or more faculty members to SUPER_ADMIN role.
   * Idempotent: already-promoted faculty are silently included in count.
   * This only updates Faculty.role — the SuperAdmin website table is separate.
   * @param {string[]} ids — internal UUIDs of Faculty rows
   */
  async promoteToSuperAdmin(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError('At least one faculty ID is required.');
    }
    const { count } = await prisma.faculty.updateMany({
      where: { id: { in: ids } },
      data:  { role: 'SUPER_ADMIN' },
    });
    return {
      updatedCount: count,
      message: `${count} faculty member(s) promoted to Super Admin.`,
    };
  }

  /**
   * Revoke SUPER_ADMIN back to FACULTY for one or more members.
   * Idempotent: already-FACULTY members are silently included in count.
   * @param {string[]} ids — internal UUIDs of Faculty rows
   */
  async revokeSuperAdmin(ids) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestError('At least one faculty ID is required.');
    }

    // First find the facultyIds for these UUIDs so we can remove them from the legacy SuperAdmin table
    const targetFaculty = await prisma.faculty.findMany({
      where: { id: { in: ids } },
      select: { facultyId: true },
    });
    const facultyIds = targetFaculty.map((f) => f.facultyId);

    // Delete from original SuperAdmin table to completely revoke website access
    if (facultyIds.length > 0) {
      await prisma.superAdmin.deleteMany({
        where: { employeeId: { in: facultyIds } },
      }).catch(() => {}); // ignore if they were never in this table
    }

    // Update Faculty role back to FACULTY
    const { count } = await prisma.faculty.updateMany({
      where: { id: { in: ids } },
      data:  { role: 'FACULTY' },
    });
    
    return {
      updatedCount: count,
      message: `${count} faculty member(s) reverted to Faculty role.`,
    };
  }

  /**
   * Additive upload from Excel — keeps existing faculty accounts unchanged.
   * New faculty get default password 'webcap'. Returns credentials for the admin.
   */
  async uploadFaculty(fileBuffer) {
    const parsedFaculty = parseFacultyExcel(fileBuffer);
    const passwordHash  = await hashPassword(DEFAULT_PASSWORD);

    const facultyWithPasswords = parsedFaculty.map((f) => ({
      ...f,
      password: passwordHash,
    }));

    const { count, newFaculty } = await FacultyRepository.upsertFaculty(facultyWithPasswords);
    const skippedCount = parsedFaculty.length - count;

    return {
      insertedCount: count,
      skippedCount,
      newFaculty: newFaculty.map((f) => ({
        facultyId: f.facultyId,
        name:      f.name,
        password:  DEFAULT_PASSWORD,
      })),
      message: count > 0
        ? `${count} new faculty added. ${skippedCount} already existed and were skipped.`
        : `All ${skippedCount} faculty already exist — no new accounts created.`,
    };
  }
}

module.exports = new FacultyMasterDataService();
