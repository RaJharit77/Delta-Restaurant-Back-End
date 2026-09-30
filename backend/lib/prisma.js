import 'dotenv/config'
import { PrismaClient } from '../../generated/prisma/index.js'
import { withAccelerate } from '@prisma/extension-accelerate'

const globalForPrisma = globalThis

export const prisma =
    globalForPrisma.prisma ||
    new PrismaClient({
        accelerateUrl: process.env.DATABASE_URL,
    }).$extends(withAccelerate())

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma