"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileStrengthService = exports.ProfileStrengthService = void 0;
const db_1 = require("@cleya/db");
const notificationService_1 = require("./notification/notificationService");
class ProfileStrengthService {
    computeFromProfile(user, profile) {
        const items = [
            { key: 'photo', label: 'Profile photo', done: !!profile?.avatarUrl, weight: 10 },
            { key: 'bio', label: 'Bio (60+ chars)', done: !!profile?.bio && profile.bio.length >= 60, weight: 15 },
            { key: 'company', label: 'Company / role', done: !!(profile?.companyName || profile?.currentRole), weight: 10 },
            { key: 'linkedin', label: 'LinkedIn URL', done: !!profile?.linkedinUrl, weight: 15 },
            { key: 'emailVerified', label: 'Email verified', done: !!user?.emailVerified, weight: 10 },
            { key: 'phoneVerified', label: 'Phone verified', done: !!user?.phoneVerified, weight: 10 },
            { key: 'workExperience', label: 'Work experience', done: typeof profile?.yearsExperience === 'number' && profile.yearsExperience > 0, weight: 10 },
            { key: 'education', label: 'Education / headline', done: !!profile?.headline && profile.headline.length >= 10, weight: 10 },
            { key: 'industries', label: 'Industries selected', done: Array.isArray(profile?.industries) && profile.industries.length > 0, weight: 5 },
            { key: 'skills', label: 'Skills selected', done: Array.isArray(profile?.skills) && profile.skills.length > 0, weight: 5 },
        ];
        const total = items.reduce((s, i) => s + i.weight, 0);
        const earned = items.reduce((s, i) => (i.done ? s + i.weight : s), 0);
        const score = Math.min(100, Math.round((earned / total) * 100));
        return { score, checklist: items, isComplete: score >= 100 };
    }
    async recompute(userId) {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { emailVerified: true, phoneVerified: true, profile: true },
        });
        if (!user)
            return null;
        const result = this.computeFromProfile({ emailVerified: user.emailVerified, phoneVerified: user.phoneVerified }, user.profile);
        const previous = await db_1.prisma.profile.findUnique({
            where: { userId },
            select: { profileScore: true, profileCompleteBadgeAt: true },
        });
        const data = {
            profileScore: result.score,
            profileScoreDetails: result,
        };
        const justCompleted = result.isComplete && !previous?.profileCompleteBadgeAt;
        if (justCompleted) {
            data.profileCompleteBadgeAt = new Date();
        }
        await db_1.prisma.profile.update({ where: { userId }, data }).catch(() => null);
        if (justCompleted) {
            await notificationService_1.notificationService
                .send({
                userId,
                channel: 'IN_APP',
                event: 'PROFILE_COMPLETE',
                title: 'Profile Complete! 🏆',
                body: 'Your profile is at 100%. You\'ll show up in more matches now.',
            })
                .catch(() => null);
        }
        return result;
    }
    async getStrength(userId) {
        const user = await db_1.prisma.user.findUnique({
            where: { id: userId },
            select: { emailVerified: true, phoneVerified: true, profile: true },
        });
        if (!user)
            return null;
        return this.computeFromProfile({ emailVerified: user.emailVerified, phoneVerified: user.phoneVerified }, user.profile);
    }
}
exports.ProfileStrengthService = ProfileStrengthService;
exports.profileStrengthService = new ProfileStrengthService();
//# sourceMappingURL=profileStrengthService.js.map