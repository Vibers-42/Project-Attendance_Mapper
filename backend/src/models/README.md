# Domain Models

The technology stack has transitioned to **Prisma**.
Manual JavaScript model classes have been removed.

In future modules, all database models and relationships will be defined centrally in `prisma/schema.prisma`. 
Prisma will automatically generate the TypeScript/JavaScript types and the Prisma Client for interacting with the database.

No manual models are required in this directory.
