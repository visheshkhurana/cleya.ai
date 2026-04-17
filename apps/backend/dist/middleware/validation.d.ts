import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
export declare function validate(schema: ZodSchema): (req: Request, res: Response, next: NextFunction) => void;
export declare const profileUpdateSchema: z.ZodObject<{
    persona: z.ZodOptional<z.ZodEnum<["FOUNDER", "INVESTOR", "OPERATOR", "ADVISOR", "JOB_SEEKER", "TALENT", "DEAL_PARTNER", "EVENT_PARTICIPANT"]>>;
    headline: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    bio: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    companyName: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    companyStage: z.ZodNullable<z.ZodOptional<z.ZodEnum<["PRE_SEED", "SEED", "SERIES_A", "SERIES_B", "SERIES_C_PLUS", "GROWTH", "PUBLIC", "BOOTSTRAPPED"]>>>;
    currentRole: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    location: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    linkedinUrl: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    websiteUrl: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    phoneNumber: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    yearsExperience: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    industries: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    skills: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    interests: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    lookingFor: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    priority: z.ZodNullable<z.ZodOptional<z.ZodEnum<["FUNDRAISING", "COFOUNDER", "HIRING", "MARKETING", "SALES", "VP_HIRE", "GENERAL"]>>>;
    raiseAmount: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    roundCloseDate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    amountRaisedToDate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    businessDescription: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    keyTractionPoints: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investorType: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investmentAmount: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    accreditedInvestor: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
    targetRole: z.ZodNullable<z.ZodOptional<z.ZodEnum<["FOUNDING_ENGINEER", "FOUNDING_GTM", "CHIEF_OF_STAFF", "GROWTH_CONTENT", "OPEN_APPLICATION", "COFOUNDER"]>>>;
    fundName: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    fundSize: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investmentRange: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    industryFocus: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investmentThesis: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    cityBased: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    exampleInvestment: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    outreachMethod: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    trackedCompanies: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    founderAccessPitch: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    channelSource: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    channelType: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    monthlyRevenue: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    growthRate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    activeUsers: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    burnRate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    portfolioCompanies: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    dealsPerYear: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    leadsRounds: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
    introPreference: z.ZodNullable<z.ZodOptional<z.ZodEnum<["WARM_ONLY", "COLD_OK", "OPEN_TO_BOTH"]>>>;
    openToMeeting: z.ZodOptional<z.ZodBoolean>;
    maxIntrosPerWeek: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    equityExpectation: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    preferredStage: z.ZodNullable<z.ZodOptional<z.ZodEnum<["PRE_SEED", "SEED", "SERIES_A", "SERIES_B", "SERIES_C_PLUS", "GROWTH", "PUBLIC", "BOOTSTRAPPED"]>>>;
    workStyle: z.ZodNullable<z.ZodOptional<z.ZodEnum<["REMOTE", "IN_OFFICE", "HYBRID"]>>>;
    functionalArea: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    preferredStageRange: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    sectorFocus: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    checkSizeRange: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    persona: z.ZodOptional<z.ZodEnum<["FOUNDER", "INVESTOR", "OPERATOR", "ADVISOR", "JOB_SEEKER", "TALENT", "DEAL_PARTNER", "EVENT_PARTICIPANT"]>>;
    headline: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    bio: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    companyName: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    companyStage: z.ZodNullable<z.ZodOptional<z.ZodEnum<["PRE_SEED", "SEED", "SERIES_A", "SERIES_B", "SERIES_C_PLUS", "GROWTH", "PUBLIC", "BOOTSTRAPPED"]>>>;
    currentRole: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    location: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    linkedinUrl: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    websiteUrl: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    phoneNumber: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    yearsExperience: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    industries: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    skills: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    interests: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    lookingFor: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    priority: z.ZodNullable<z.ZodOptional<z.ZodEnum<["FUNDRAISING", "COFOUNDER", "HIRING", "MARKETING", "SALES", "VP_HIRE", "GENERAL"]>>>;
    raiseAmount: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    roundCloseDate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    amountRaisedToDate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    businessDescription: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    keyTractionPoints: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investorType: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investmentAmount: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    accreditedInvestor: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
    targetRole: z.ZodNullable<z.ZodOptional<z.ZodEnum<["FOUNDING_ENGINEER", "FOUNDING_GTM", "CHIEF_OF_STAFF", "GROWTH_CONTENT", "OPEN_APPLICATION", "COFOUNDER"]>>>;
    fundName: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    fundSize: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investmentRange: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    industryFocus: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investmentThesis: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    cityBased: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    exampleInvestment: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    outreachMethod: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    trackedCompanies: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    founderAccessPitch: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    channelSource: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    channelType: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    monthlyRevenue: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    growthRate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    activeUsers: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    burnRate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    portfolioCompanies: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    dealsPerYear: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    leadsRounds: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
    introPreference: z.ZodNullable<z.ZodOptional<z.ZodEnum<["WARM_ONLY", "COLD_OK", "OPEN_TO_BOTH"]>>>;
    openToMeeting: z.ZodOptional<z.ZodBoolean>;
    maxIntrosPerWeek: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    equityExpectation: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    preferredStage: z.ZodNullable<z.ZodOptional<z.ZodEnum<["PRE_SEED", "SEED", "SERIES_A", "SERIES_B", "SERIES_C_PLUS", "GROWTH", "PUBLIC", "BOOTSTRAPPED"]>>>;
    workStyle: z.ZodNullable<z.ZodOptional<z.ZodEnum<["REMOTE", "IN_OFFICE", "HYBRID"]>>>;
    functionalArea: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    preferredStageRange: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    sectorFocus: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    checkSizeRange: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    persona: z.ZodOptional<z.ZodEnum<["FOUNDER", "INVESTOR", "OPERATOR", "ADVISOR", "JOB_SEEKER", "TALENT", "DEAL_PARTNER", "EVENT_PARTICIPANT"]>>;
    headline: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    bio: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    companyName: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    companyStage: z.ZodNullable<z.ZodOptional<z.ZodEnum<["PRE_SEED", "SEED", "SERIES_A", "SERIES_B", "SERIES_C_PLUS", "GROWTH", "PUBLIC", "BOOTSTRAPPED"]>>>;
    currentRole: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    location: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    linkedinUrl: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    websiteUrl: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    phoneNumber: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>, z.ZodLiteral<"">]>, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    yearsExperience: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    industries: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    skills: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    interests: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    lookingFor: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    priority: z.ZodNullable<z.ZodOptional<z.ZodEnum<["FUNDRAISING", "COFOUNDER", "HIRING", "MARKETING", "SALES", "VP_HIRE", "GENERAL"]>>>;
    raiseAmount: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    roundCloseDate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    amountRaisedToDate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    businessDescription: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    keyTractionPoints: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investorType: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investmentAmount: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    accreditedInvestor: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
    targetRole: z.ZodNullable<z.ZodOptional<z.ZodEnum<["FOUNDING_ENGINEER", "FOUNDING_GTM", "CHIEF_OF_STAFF", "GROWTH_CONTENT", "OPEN_APPLICATION", "COFOUNDER"]>>>;
    fundName: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    fundSize: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investmentRange: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    industryFocus: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    investmentThesis: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    cityBased: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    exampleInvestment: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    outreachMethod: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    trackedCompanies: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    founderAccessPitch: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    channelSource: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    channelType: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    monthlyRevenue: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    growthRate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    activeUsers: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    burnRate: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    portfolioCompanies: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    dealsPerYear: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    leadsRounds: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
    introPreference: z.ZodNullable<z.ZodOptional<z.ZodEnum<["WARM_ONLY", "COLD_OK", "OPEN_TO_BOTH"]>>>;
    openToMeeting: z.ZodOptional<z.ZodBoolean>;
    maxIntrosPerWeek: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    equityExpectation: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    preferredStage: z.ZodNullable<z.ZodOptional<z.ZodEnum<["PRE_SEED", "SEED", "SERIES_A", "SERIES_B", "SERIES_C_PLUS", "GROWTH", "PUBLIC", "BOOTSTRAPPED"]>>>;
    workStyle: z.ZodNullable<z.ZodOptional<z.ZodEnum<["REMOTE", "IN_OFFICE", "HYBRID"]>>>;
    functionalArea: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    preferredStageRange: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    sectorFocus: z.ZodOptional<z.ZodUnion<[z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
    checkSizeRange: z.ZodOptional<z.ZodUnion<[z.ZodEffects<z.ZodString, string, string>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">, z.ZodEffects<z.ZodNull, undefined, null>]>>;
}, z.ZodTypeAny, "passthrough">>;
export declare const strongPasswordSchema: z.ZodString;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodString;
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    currentPassword: string;
    newPassword: string;
}, {
    currentPassword: string;
    newPassword: string;
}>;
export declare const setPasswordSchema: z.ZodObject<{
    newPassword: z.ZodString;
}, "strip", z.ZodTypeAny, {
    newPassword: string;
}, {
    newPassword: string;
}>;
export declare const matchResponseSchema: z.ZodObject<{
    response: z.ZodEnum<["ACCEPTED", "REJECTED"]>;
}, "strip", z.ZodTypeAny, {
    response: "ACCEPTED" | "REJECTED";
}, {
    response: "ACCEPTED" | "REJECTED";
}>;
export declare const matchFeedbackSchema: z.ZodObject<{
    rating: z.ZodNumber;
    feedback: z.ZodNullable<z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>>;
}, "strip", z.ZodTypeAny, {
    rating: number;
    feedback?: string | null | undefined;
}, {
    rating: number;
    feedback?: string | null | undefined;
}>;
export declare const matchProposeSchema: z.ZodObject<{
    userAId: z.ZodString;
    userBId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    userBId: string;
    userAId: string;
}, {
    userBId: string;
    userAId: string;
}>;
export declare const introductionStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["VIEWED", "RESPONDED", "MEETING_SCHEDULED"]>;
    scheduledAt: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
}, "strip", z.ZodTypeAny, {
    status: "VIEWED" | "RESPONDED" | "MEETING_SCHEDULED";
    scheduledAt?: string | undefined;
    notes?: string | undefined;
}, {
    status: "VIEWED" | "RESPONDED" | "MEETING_SCHEDULED";
    scheduledAt?: string | undefined;
    notes?: string | undefined;
}>;
//# sourceMappingURL=validation.d.ts.map