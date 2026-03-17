-- CreateEnum
CREATE TYPE "FounderPriority" AS ENUM ('FUNDRAISING', 'COFOUNDER', 'HIRING', 'MARKETING', 'SALES_BD', 'VENTURE_PARTNER_HIRE');

-- CreateEnum
CREATE TYPE "TalentTargetRole" AS ENUM ('FOUNDING_ENGINEER', 'FOUNDING_GTM', 'CHIEF_OF_STAFF', 'GROWTH_CONTENT', 'OPEN_APPLICATION', 'COFOUNDER');

-- AlterEnum
ALTER TYPE "PersonaType" ADD VALUE 'TALENT';
ALTER TYPE "PersonaType" ADD VALUE 'DEAL_PARTNER';
ALTER TYPE "PersonaType" ADD VALUE 'VENTURE_PARTNER';
ALTER TYPE "PersonaType" ADD VALUE 'EVENT_PARTICIPANT';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "accreditedInvestor" BOOLEAN,
ADD COLUMN     "amountRaisedToDate" TEXT,
ADD COLUMN     "businessDescription" TEXT,
ADD COLUMN     "channelSource" TEXT,
ADD COLUMN     "channelType" TEXT,
ADD COLUMN     "cityBased" TEXT,
ADD COLUMN     "exampleInvestment" TEXT,
ADD COLUMN     "founderAccessPitch" TEXT,
ADD COLUMN     "fundName" TEXT,
ADD COLUMN     "fundSize" TEXT,
ADD COLUMN     "industryFocus" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "investmentAmount" TEXT,
ADD COLUMN     "investmentRange" TEXT,
ADD COLUMN     "investmentThesis" TEXT,
ADD COLUMN     "investorType" TEXT,
ADD COLUMN     "keyTractionPoints" TEXT,
ADD COLUMN     "outreachMethod" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "priority" "FounderPriority",
ADD COLUMN     "raiseAmount" TEXT,
ADD COLUMN     "roundCloseDate" TEXT,
ADD COLUMN     "targetRole" "TalentTargetRole",
ADD COLUMN     "trackedCompanies" TEXT;
