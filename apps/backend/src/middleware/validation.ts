import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: {
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
        });
        return;
      }
      next(error);
    }
  };
}

function stripHtml(str: string): string {
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .trim();
}

const sanitizedString = (maxLength: number) =>
  z.string().max(maxLength).transform(val => stripHtml(val));

const optionalSanitizedString = (maxLength: number) =>
  z.string().max(maxLength).transform(val => stripHtml(val)).optional().or(z.literal('').transform(() => undefined));

const linkedinUrlSchema = z.string()
  .refine(
    val => !val || /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i.test(val),
    { message: 'Invalid LinkedIn URL. Must be in format: https://linkedin.com/in/your-name' }
  )
  .optional()
  .or(z.literal(''));

const websiteUrlSchema = z.string()
  .refine(
    val => !val || /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+([\/\w\-.~:?#[\]@!$&'()*+,;=]*)?$/i.test(val),
    { message: 'Invalid website URL. Must start with http:// or https://' }
  )
  .optional()
  .or(z.literal(''));

const phoneSchema = z.string()
  .refine(
    val => !val || /^[+]?[\d\s\-().]{7,20}$/.test(val),
    { message: 'Invalid phone number format' }
  )
  .optional()
  .or(z.literal(''));

const sanitizedArraySchema = (maxItems: number, maxItemLength: number) =>
  z.array(z.string().max(maxItemLength).transform(val => stripHtml(val)))
    .max(maxItems)
    .optional();

const personaEnum = z.enum([
  'FOUNDER', 'INVESTOR', 'OPERATOR', 'ADVISOR',
  'JOB_SEEKER', 'TALENT', 'DEAL_PARTNER', 'EVENT_PARTICIPANT',
]).optional();

const companyStageEnum = z.enum([
  'PRE_SEED', 'SEED', 'SERIES_A', 'SERIES_B', 'SERIES_C',
  'GROWTH', 'PUBLIC', 'BOOTSTRAPPED',
]).optional().nullable();

const priorityEnum = z.enum([
  'FUNDRAISING', 'COFOUNDER', 'HIRING', 'MARKETING',
  'SALES', 'VP_HIRE', 'GENERAL',
]).optional().nullable();

const targetRoleEnum = z.enum([
  'FOUNDING_ENGINEER', 'EXECUTIVE', 'PRODUCT', 'ENGINEERING',
  'DESIGN', 'MARKETING', 'SALES', 'OPERATIONS', 'OTHER',
]).optional().nullable();

export const profileUpdateSchema = z.object({
  persona: personaEnum,
  headline: optionalSanitizedString(150),
  bio: optionalSanitizedString(1000),
  companyName: optionalSanitizedString(100),
  companyStage: companyStageEnum,
  currentRole: optionalSanitizedString(100),
  location: optionalSanitizedString(100),
  linkedinUrl: linkedinUrlSchema,
  websiteUrl: websiteUrlSchema,
  phoneNumber: phoneSchema,
  yearsExperience: z.number().int().min(0).max(70).optional().nullable(),
  industries: sanitizedArraySchema(20, 100),
  skills: sanitizedArraySchema(30, 100),
  interests: sanitizedArraySchema(30, 100),
  lookingFor: sanitizedArraySchema(10, 100),
  priority: priorityEnum,
  raiseAmount: optionalSanitizedString(50),
  roundCloseDate: optionalSanitizedString(50),
  amountRaisedToDate: optionalSanitizedString(50),
  businessDescription: optionalSanitizedString(2000),
  keyTractionPoints: optionalSanitizedString(500),
  investorType: optionalSanitizedString(50),
  investmentAmount: optionalSanitizedString(50),
  accreditedInvestor: z.boolean().optional(),
  targetRole: targetRoleEnum,
  fundName: optionalSanitizedString(100),
  fundSize: optionalSanitizedString(50),
  investmentRange: optionalSanitizedString(50),
  industryFocus: sanitizedArraySchema(20, 100),
  investmentThesis: optionalSanitizedString(1000),
  cityBased: optionalSanitizedString(100),
  exampleInvestment: optionalSanitizedString(200),
  outreachMethod: optionalSanitizedString(200),
  trackedCompanies: optionalSanitizedString(500),
  founderAccessPitch: optionalSanitizedString(500),
  channelSource: optionalSanitizedString(50),
  channelType: optionalSanitizedString(50),
}).strict();

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const matchResponseSchema = z.object({
  response: z.enum(['ACCEPTED', 'REJECTED'], {
    errorMap: () => ({ message: 'Response must be ACCEPTED or REJECTED' }),
  }),
});

export const matchFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: sanitizedString(1000).optional().nullable(),
});

export const matchProposeSchema = z.object({
  userAId: z.string().cuid(),
  userBId: z.string().cuid(),
});

export const introductionStatusSchema = z.object({
  status: z.enum(['VIEWED', 'RESPONDED', 'MEETING_SCHEDULED']),
  scheduledAt: z.string().datetime().optional(),
  notes: sanitizedString(500).optional(),
});
