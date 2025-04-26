const { PrismaClient } = require("@prisma/client");
const dotenv = require("dotenv");
dotenv.config();
console.log(process.env.DATABASE_URL);
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + "?pool_timeout=10&connection_limit=5", // ✅ Override connection settings
    },
  },
});

prisma
  .$connect()
  .then(() => {
    console.log("Prisma connected successfully with optimized pooling");
  })
  .catch((error) => {
    console.error("Error connecting to Prisma:", error);
  });

module.exports = prisma;