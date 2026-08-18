const prisma = require('../config/prisma');

class PlacementStudentMasterRepository {
  async createOne(data) {
    return await prisma.placementStudentMaster.create({ data });
  }

  async findByRollNumber(rollNumber) {
    return await prisma.placementStudentMaster.findUnique({
      where: { rollNumber },
    });
  }

  async deleteById(id) {
    return await prisma.placementStudentMaster.delete({
      where: { id },
    });
  }

  async findManyByRollNumbers(rollNumbers) {
    return await prisma.placementStudentMaster.findMany({
      where: { rollNumber: { in: rollNumbers } },
      select: { rollNumber: true },
    });
  }

  async findAll(skip = 0, take = 50) {
    return await prisma.placementStudentMaster.findMany({
      skip,
      take,
      orderBy: { rollNumber: 'asc' },
    });
  }

  async count() {
    return await prisma.placementStudentMaster.count();
  }

  async searchPaginated(query, skip = 0, take = 50) {
    return await prisma.placementStudentMaster.findMany({
      where: {
        OR: [
          { rollNumber: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
      skip,
      take,
      orderBy: { rollNumber: 'asc' },
    });
  }

  async searchCount(query) {
    return await prisma.placementStudentMaster.count({
      where: {
        OR: [
          { rollNumber: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
        ],
      },
    });
  }

  async upsertStudents(parsedStudents) {
    let count = 0;
    let updateCount = 0;
    const errors = [];

    // Process students sequentially to prevent overlapping queries on the same rollNumber
    for (const student of parsedStudents) {
      try {
        const existing = await prisma.placementStudentMaster.findUnique({
          where: { rollNumber: student.rollNumber }
        });

        if (existing) {
          let hasChanges = false;
          if (student.timetable && existing.timetable !== student.timetable) {
            hasChanges = true;
          }
          if (student.name && existing.name !== student.name) {
            hasChanges = true;
          }

          if (hasChanges) {
            await prisma.placementStudentMaster.update({
              where: { rollNumber: student.rollNumber },
              data: {
                name: student.name,
                timetable: student.timetable,
              }
            });
            updateCount++;
          }
        } else {
          await prisma.placementStudentMaster.create({
            data: {
              rollNumber: student.rollNumber,
              name: student.name,
              timetable: student.timetable,
            }
          });
          count++;
        }
      } catch (err) {
        console.error(`Failed to upsert placement student ${student.rollNumber}:`, err.message);
        errors.push(`Failed for ${student.rollNumber}`);
      }
    }

    return { count, updateCount, newStudents: [] };
  }
}

module.exports = new PlacementStudentMasterRepository();
