// ============================================
// Cleo.ai — Shared Type Definitions
// ============================================

// --- User & Profile ---
export type UserRole = 'user' | 'admin';

export type PersonaType =
  | 'founder'
  | 'investor'
  | 'talent'
  | 'deal_partner'
  | 'venture_partner'
  | 'event_participant'
  | 'advisor'
  | 'operator'
  | 'job_seeker'
  | 'recruiter'
  | 'freelancer'
  | 'other';

export type CompanyStage =
  | 'pre_seed'
  | 'seed'
  | 'series_a'
  | 'series_b'
  | 'series_c_plus'
  | 'growth'
  | 'public'
  | 'bootstrapped';

export type FounderPriority =
  | 'FUNDRAISING'
  | 'COFOUNDER'
  | 'HIRING'
  | 'MARKETING'
  | 'SALES_BD'
  | 'VENTURE_PARTNER_HIRE';

export type TalentTargetRole =
  | 'FOUNDING_ENGINEER'
  | 'FOUNDING_GTM'
  | 'CHIEF_OF_STAFF'
  | 'GROWTH_CONTENT'
  | 'OPEN_APPLICATION'
  | 'COFOUNDER';

export interface ProfileData {
  persona: PersonaType;
  headline?: string;
  bio?: string;
  companyName?: string;
  companyStage?: CompanyStage;
  role?: string;
  industry?: string[];
  skills?: string[];
  interests?: string[];
  lookingFor?: string[];
  location?: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  phoneNumber?: string;
  yearsExperience?: number;
  priority?: FounderPriority;
  raiseAmount?: string;
  roundCloseDate?: string;
  amountRaisedToDate?: string;
  businessDescription?: string;
  keyTractionPoints?: string;
  investorType?: string;
  investmentAmount?: string;
  accreditedInvestor?: boolean;
  targetRole?: TalentTargetRole;
  fundName?: string;
  fundSize?: string;
  investmentRange?: string;
  industryFocus?: string[];
  investmentThesis?: string;
  cityBased?: string;
  exampleInvestment?: string;
  outreachMethod?: string;
  trackedCompanies?: string;
  founderAccessPitch?: string;
  channelSource?: string;
  channelType?: string;
  [key: string]: any;
}

// --- Conversation Engine ---
export type ConversationStatus = 'active' | 'completed' | 'abandoned' | 'paused';

export type NodeType = 'message' | 'choices' | 'form' | 'ai_response' | 'conditional';

export interface FlowNode {
  id: string;
  type: NodeType;
  content?: string;
  choices?: FlowChoice[];
  formSchema?: FormField[];
  condition?: FlowCondition;
  next?: string | null;
  metadata?: Record<string, any>;
}

export interface FlowChoice {
  label: string;
  value: string;
  next: string;
}

export interface FlowCondition {
  field: string;
  operator: 'eq' | 'neq' | 'in' | 'gt' | 'lt';
  value: any;
  trueBranch: string;
  falseBranch: string;
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'multiselect' | 'textarea' | 'number' | 'url';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
  conditional?: {
    field: string;
    value: any;
  };
}

export interface ConversationFlow {
  id: string;
  name: string;
  description?: string;
  startNode: string;
  nodes: Record<string, FlowNode>;
}

// --- Matching ---
export type MatchStatus = 'proposed' | 'pending_a' | 'pending_b' | 'accepted' | 'rejected' | 'expired';

export interface MatchScore {
  total: number;
  ruleScore: number;
  semanticScore: number;
  breakdown: {
    roleMatch: number;
    stageMatch: number;
    industryMatch: number;
    interestMatch: number;
    locationMatch: number;
    skillMatch: number;
    founderContextMatch: number;
    intentScore: number;
    semanticSimilarity: number;
    [key: string]: number;
  };
}

// --- Calls ---
export type CallStatus = 'scheduled' | 'in_progress' | 'completed' | 'failed' | 'no_answer';

export interface CallTranscript {
  segments: {
    speaker: 'ai' | 'user';
    text: string;
    timestamp: number;
  }[];
  extractedData?: Record<string, any>;
}

// --- Notifications ---
export type NotificationChannel = 'whatsapp' | 'email' | 'sms' | 'in_app';

export type NotificationEvent =
  | 'match_found'
  | 'intro_request'
  | 'intro_accepted'
  | 'intro_rejected'
  | 'profile_complete'
  | 'call_scheduled'
  | 'call_reminder';

// --- API Responses ---
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
  meta?: {
    page?: number;
    total?: number;
    limit?: number;
  };
}

// --- WebSocket Messages ---
export interface WsMessage {
  type: string;
  payload: any;
}

export type WsChatMessage = {
  type: 'chat:message';
  payload: {
    conversationId: string;
    content: string;
    nodeId?: string;
    formData?: Record<string, any>;
    choiceValue?: string;
  };
};

export type WsChatResponse = {
  type: 'chat:response';
  payload: {
    conversationId: string;
    node: FlowNode;
    message?: string;
  };
};
