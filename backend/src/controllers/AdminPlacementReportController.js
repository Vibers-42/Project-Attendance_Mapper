const prisma = require('../config/prisma');
const { sendSuccess } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/AppError');
const placementService = require('../services/PlacementService');

class AdminPlacementReportController {
  /**
   * Retrieves paginated completed placement sessions for the admin dashboard.
   */
  async listReports(req, res) {
    const { page = 1, limit = 50, search, date } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    // Filter by active and completed sessions (exclude drafts).
    const where = { status: { in: ['ACTIVE', 'COMPLETED'] } };

    // Search by title if provided
    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    // Filter by exact date if provided
    if (date) {
      // Assuming date is in 'YYYY-MM-DD' format
      const startOfDay = new Date(`${date}T00:00:00.000Z`);
      const endOfDay = new Date(`${date}T23:59:59.999Z`);
      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const [total, sessions] = await Promise.all([
      prisma.placementSession.count({ where }),
      prisma.placementSession.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take,
        include: {
          _count: {
            select: {
              students: {
                where: { attendanceStatus: 'PRESENT' },
              },
            },
          },
        },
      }),
    ]);

    // Format to match what the frontend expects
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      title: session.title,
      date: session.date,
      time: session.date, // frontend can format it
      // description stores the app's attendanceMode ('OFFLINE' | 'VIRTUAL').
      mode: session.description === 'VIRTUAL' ? 'Virtual' : 'Offline',
      status: session.status,
      presentCount: session._count.students,
    }));

    return sendSuccess(res, {
      message: 'Placement reports retrieved successfully.',
      data: formattedSessions,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  }

  /**
   * Downloads the Placement Session Workbook using existing service logic.
   */
  async downloadReport(req, res) {
    const { id } = req.params;
    // Admin version of PlacementService.getSessionReport — skips the per-faculty
    // permission check and also allows sessions that are still ACTIVE.
    const session = await prisma.placementSession.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        date: true,
        venue: true,
        description: true,
        conductedById: true,
        createdBy: { select: { name: true, facultyId: true } },
      },
    });

    if (!session) throw new NotFoundError('Session not found.');

    const students = await prisma.placementStudent.findMany({
      where: { sessionId: id },
      select: {
        rollNumber: true,
        name: true,
        attendanceStatus: true,
        phoneNumber: true,
        markedAt: true,
      },
      orderBy: { rollNumber: 'asc' },
    });

    // For a still-live session, not-yet-marked (PENDING) students go on the
    // Absent sheet too — otherwise they'd appear on neither sheet.
    const presentStudents = students.filter((s) => s.attendanceStatus === 'PRESENT');
    const absentStudents = students.filter((s) => s.attendanceStatus !== 'PRESENT');

    const reportData = {
      session: {
        ...session,
        attendanceMode: session.description,
        createdByName: session.createdBy?.name ?? 'Admin',
      },
      eligible: students.length,
      present: presentStudents.length,
      absent: absentStudents.length,
      presentStudents,
      absentStudents,
    };

    // Reuse the exact same Excel generation logic from the service
    const buffer = await placementService.generateReportExcel(reportData);
    
    const safeName = reportData.session.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
    res.setHeader('Content-Disposition', `attachment; filename="placement_report_${safeName}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  }

  /**
   * Permanently deletes a placement session. Students and permissions are
   * removed by the schema's onDelete: Cascade.
   */
  async deleteReport(req, res) {
    const { id } = req.params;
    const session = await prisma.placementSession.findUnique({ where: { id }, select: { title: true } });
    if (!session) throw new NotFoundError('Session not found.');

    await prisma.placementSession.delete({ where: { id } });
    return sendSuccess(res, { message: `"${session.title}" deleted successfully.` });
  }
}

module.exports = new AdminPlacementReportController();
