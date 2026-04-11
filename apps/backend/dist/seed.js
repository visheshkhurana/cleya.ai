"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDatabase = seedDatabase;
const db_1 = require("@cleya/db");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("./config/env");
async function seedDatabase() {
    try {
        if (env_1.env.ADMIN_EMAIL && env_1.env.ADMIN_PASSWORD) {
            const existingAdmin = await db_1.prisma.user.findUnique({ where: { email: env_1.env.ADMIN_EMAIL } });
            if (existingAdmin) {
                const hash = await bcryptjs_1.default.hash(env_1.env.ADMIN_PASSWORD, 12);
                await db_1.prisma.user.update({ where: { email: env_1.env.ADMIN_EMAIL }, data: { passwordHash: hash, role: 'ADMIN' } });
                console.log(`Admin password synced for ${env_1.env.ADMIN_EMAIL}`);
            }
        }
        const userCount = await db_1.prisma.user.count();
        if (userCount > 0) {
            console.log(`Database already has ${userCount} users, skipping seed`);
            return;
        }
        if (!env_1.env.ADMIN_EMAIL || !env_1.env.ADMIN_PASSWORD) {
            console.log('No ADMIN_EMAIL/ADMIN_PASSWORD set — skipping admin seed');
            return;
        }
        console.log('Seeding database with admin user...');
        const adminPassword = await bcryptjs_1.default.hash(env_1.env.ADMIN_PASSWORD, 12);
        const admin = await db_1.prisma.user.create({
            data: {
                email: env_1.env.ADMIN_EMAIL,
                passwordHash: adminPassword,
                role: 'ADMIN',
                emailVerified: true,
                profile: {
                    create: {
                        persona: 'OPERATOR',
                        headline: 'Cleya.ai Platform Admin',
                        currentRole: 'Admin',
                        companyName: 'Cleya.ai',
                        location: 'San Francisco, CA',
                        isComplete: true,
                        completenessScore: 1.0,
                    },
                },
            },
        });
        console.log(`  Seeded admin: ${admin.email}`);
        console.log('Database seeding complete!');
    }
    catch (error) {
        console.error('Seed error (non-fatal):', error);
    }
}
//# sourceMappingURL=seed.js.map