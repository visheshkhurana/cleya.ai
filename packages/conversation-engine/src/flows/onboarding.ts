import { ConversationFlow } from '@cleya/types';

export const onboardingFlow: ConversationFlow = {
  id: 'onboarding_v1',
  name: 'Cleya.ai Onboarding',
  description: 'Multi-persona onboarding flow — 6 persona types with tailored forms',
  startNode: 'welcome',
  nodes: {
    // ─── Welcome ───
    welcome: {
      id: 'welcome',
      type: 'message',
      content:
        "Hey! I'm Cleya, an AI Superconnector! I match founders, investors, talent, and dealmakers with the right people.\n\nLet me learn a bit about you so I can find your best matches.",
      next: 'persona_select',
    },

    // ─── Persona Selection (6 buttons) ───
    persona_select: {
      id: 'persona_select',
      type: 'choices',
      content: "Which best describes you?",
      choices: [
        { label: "🚀 I'm a Founder / Business Owner", value: 'FOUNDER', next: 'founder_details' },
        { label: "🎯 I want to join a Startup", value: 'TALENT', next: 'talent_details' },
        { label: "💰 I'm an Investor", value: 'INVESTOR', next: 'investor_details' },
        { label: "🏆 Interested in The Pitch by Deel", value: 'EVENT_PARTICIPANT', next: 'event_details' },
        { label: "🤝 I want to be a Deal Partner", value: 'DEAL_PARTNER', next: 'deal_partner_details' },
        { label: "💬 Other", value: 'OTHER', next: 'other_details' },
      ],
      next: 'founder_details',
    },

    // ═══════════════════════════════════════════
    // (A) FOUNDER FLOW
    // ═══════════════════════════════════════════

    founder_details: {
      id: 'founder_details',
      type: 'form',
      content: "Great! Let's get your founder profile set up.",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Company Name', required: true, placeholder: 'e.g. Acme Inc.' },
        {
          name: 'companyStage',
          type: 'select',
          label: 'Company Stage',
          required: true,
          options: [
            { label: 'Pre-Seed / Idea', value: 'PRE_SEED' },
            { label: 'Seed', value: 'SEED' },
            { label: 'Series A', value: 'SERIES_A' },
            { label: 'Series B', value: 'SERIES_B' },
            { label: 'Series C+', value: 'SERIES_C_PLUS' },
            { label: 'Growth', value: 'GROWTH' },
            { label: 'Bootstrapped', value: 'BOOTSTRAPPED' },
          ],
        },
        { name: 'currentRole', type: 'text', label: 'Your Title', required: true, placeholder: 'e.g. CEO & Co-Founder' },
        { name: 'headline', type: 'text', label: 'One-liner about your company', required: true, placeholder: 'e.g. AI-powered logistics for last-mile delivery' },
        { name: 'businessDescription', type: 'textarea', label: 'Describe your business', placeholder: 'What does your company do? Who are your customers?', validation: { max: 500 } },
        { name: 'keyTractionPoints', type: 'textarea', label: 'Key traction points', placeholder: 'e.g. $500K ARR, 10K users, YC W24', validation: { max: 300 } },
      ],
      next: 'founder_priority',
    },

    founder_priority: {
      id: 'founder_priority',
      type: 'choices',
      content: "What's your #1 priority right now?",
      choices: [
        { label: '💰 Fundraising', value: 'FUNDRAISING', next: 'founder_fundraising' },
        { label: '🤝 Finding a Co-Founder', value: 'COFOUNDER', next: 'common_details' },
        { label: '👥 Hiring', value: 'HIRING', next: 'common_details' },
        { label: '📢 Marketing / Growth', value: 'MARKETING', next: 'common_details' },
        { label: '🤝 Sales / BD', value: 'SALES_BD', next: 'common_details' },
        { label: '💼 Hiring a Venture Partner', value: 'VENTURE_PARTNER_HIRE', next: 'common_details' },
      ],
    },

    founder_fundraising: {
      id: 'founder_fundraising',
      type: 'form',
      content: "Tell me about your fundraising goals so I can match you with the right investors.",
      formSchema: [
        { name: 'raiseAmount', type: 'text', label: 'How much are you raising?', required: true, placeholder: 'e.g. $2M' },
        { name: 'amountRaisedToDate', type: 'text', label: 'Amount raised to date', placeholder: 'e.g. $500K pre-seed' },
        { name: 'roundCloseDate', type: 'text', label: 'When do you want to close?', placeholder: 'e.g. Q2 2026' },
      ],
      next: 'common_details',
    },

    // ═══════════════════════════════════════════
    // (B) TALENT / JOIN A STARTUP
    // ═══════════════════════════════════════════

    talent_details: {
      id: 'talent_details',
      type: 'form',
      content: "Awesome, let's get you matched with the right startup!",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Current / Most Recent Role', required: true, placeholder: 'e.g. Senior Engineer at Google' },
        { name: 'headline', type: 'text', label: 'What are you looking for?', required: true, placeholder: 'e.g. Founding engineer role at an AI startup' },
        { name: 'yearsExperience', type: 'number', label: 'Years of experience', validation: { min: 0, max: 50 } },
        { name: 'linkedinUrl', type: 'url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
      ],
      next: 'talent_target_role',
    },

    talent_target_role: {
      id: 'talent_target_role',
      type: 'choices',
      content: "What type of role are you targeting?",
      choices: [
        { label: '👩‍💻 Founding Engineer', value: 'FOUNDING_ENGINEER', next: 'common_details' },
        { label: '📈 Founding GTM / Sales', value: 'FOUNDING_GTM', next: 'common_details' },
        { label: '🎯 Chief of Staff', value: 'CHIEF_OF_STAFF', next: 'common_details' },
        { label: '📢 Growth / Content', value: 'GROWTH_CONTENT', next: 'common_details' },
        { label: '📝 Open Application', value: 'OPEN_APPLICATION', next: 'common_details' },
        { label: '🤝 Co-Founder', value: 'COFOUNDER', next: 'common_details' },
      ],
    },

    // ═══════════════════════════════════════════
    // (C) INVESTOR
    // ═══════════════════════════════════════════

    investor_details: {
      id: 'investor_details',
      type: 'form',
      content: "Welcome! Let's set up your investor profile.",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Fund / Firm Name', required: true, placeholder: 'e.g. Sequoia Capital' },
        { name: 'currentRole', type: 'text', label: 'Your Title', required: true, placeholder: 'e.g. Partner' },
        { name: 'headline', type: 'text', label: 'Investment focus', required: true, placeholder: 'e.g. Early-stage B2B SaaS' },
        {
          name: 'investorType',
          type: 'select',
          label: 'Investor Type',
          required: true,
          options: [
            { label: 'Angel Investor', value: 'angel' },
            { label: 'VC Fund', value: 'vc' },
            { label: 'Family Office', value: 'family_office' },
            { label: 'Corporate VC', value: 'corporate_vc' },
            { label: 'Syndicate Lead', value: 'syndicate' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'companyStage',
          type: 'select',
          label: 'Stages you invest in',
          required: true,
          options: [
            { label: 'Pre-Seed', value: 'PRE_SEED' },
            { label: 'Seed', value: 'SEED' },
            { label: 'Series A', value: 'SERIES_A' },
            { label: 'Series B', value: 'SERIES_B' },
            { label: 'Growth / Late', value: 'SERIES_C_PLUS' },
          ],
        },
        { name: 'investmentAmount', type: 'text', label: 'Typical check size', placeholder: 'e.g. $100K - $500K' },
      ],
      next: 'common_details',
    },

    // ═══════════════════════════════════════════
    // (D) THE PITCH BY DEEL (EVENT PARTICIPANT)
    // ═══════════════════════════════════════════

    event_details: {
      id: 'event_details',
      type: 'form',
      content: "The Pitch by Deel — exciting! Let's get you set up.",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Company Name', required: true, placeholder: 'e.g. Acme Inc.' },
        { name: 'currentRole', type: 'text', label: 'Your Role', required: true, placeholder: 'e.g. CEO & Founder' },
        { name: 'headline', type: 'text', label: 'One-liner about your company', required: true, placeholder: 'e.g. AI-powered hiring platform' },
        {
          name: 'companyStage',
          type: 'select',
          label: 'Company Stage',
          required: true,
          options: [
            { label: 'Pre-Seed', value: 'PRE_SEED' },
            { label: 'Seed', value: 'SEED' },
            { label: 'Series A', value: 'SERIES_A' },
            { label: 'Series B+', value: 'SERIES_B' },
          ],
        },
        { name: 'businessDescription', type: 'textarea', label: 'Describe your business (for pitch prep)', required: true, placeholder: 'What problem do you solve? What makes you unique?', validation: { max: 500 } },
      ],
      next: 'common_details',
    },

    // ═══════════════════════════════════════════
    // (E) DEAL PARTNER / SCOUT
    // ═══════════════════════════════════════════

    deal_partner_details: {
      id: 'deal_partner_details',
      type: 'form',
      content: "Great — let's get your deal partner profile set up.",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Your Current Role', required: true, placeholder: 'e.g. BD Lead at TechStars' },
        { name: 'headline', type: 'text', label: 'What kind of deals do you source?', required: true, placeholder: 'e.g. Pre-seed AI/ML startups in LATAM' },
        { name: 'cityBased', type: 'text', label: 'City you are based in', required: true, placeholder: 'e.g. Miami, FL' },
        { name: 'exampleInvestment', type: 'text', label: 'Example deal you sourced', placeholder: 'e.g. Led intro for $2M seed round at XYZ Co' },
        { name: 'outreachMethod', type: 'text', label: 'How do you find founders?', placeholder: 'e.g. Twitter DMs, events, warm intros' },
        { name: 'trackedCompanies', type: 'textarea', label: 'Companies you are currently tracking', placeholder: 'List startups you have your eye on', validation: { max: 300 } },
        { name: 'founderAccessPitch', type: 'textarea', label: 'Why should founders work with you?', placeholder: 'Your value prop to founders', validation: { max: 300 } },
      ],
      next: 'common_details',
    },

    // ═══════════════════════════════════════════
    // (F) OTHER
    // ═══════════════════════════════════════════

    other_details: {
      id: 'other_details',
      type: 'form',
      content: "No problem! Tell me a bit about yourself.",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Your Current Role', required: true, placeholder: 'e.g. VP Engineering at BigCorp' },
        { name: 'headline', type: 'text', label: 'What brings you here?', required: true, placeholder: 'e.g. Looking to connect with founders in fintech' },
        { name: 'companyName', type: 'text', label: 'Company (if any)', placeholder: 'e.g. Independent' },
      ],
      next: 'common_details',
    },

    // ═══════════════════════════════════════════
    // COMMON DETAILS (all personas)
    // ═══════════════════════════════════════════

    common_details: {
      id: 'common_details',
      type: 'form',
      content: "Almost there! A few more details to help with matching.",
      formSchema: [
        {
          name: 'industries',
          type: 'multiselect',
          label: 'Industries you work in',
          required: true,
          options: [
            { label: 'AI / ML', value: 'ai_ml' },
            { label: 'SaaS', value: 'saas' },
            { label: 'Fintech', value: 'fintech' },
            { label: 'Healthcare', value: 'healthcare' },
            { label: 'E-commerce', value: 'ecommerce' },
            { label: 'Education', value: 'education' },
            { label: 'Climate / Energy', value: 'climate' },
            { label: 'Web3 / Crypto', value: 'web3' },
            { label: 'Consumer', value: 'consumer' },
            { label: 'Enterprise', value: 'enterprise' },
            { label: 'Other', value: 'other' },
          ],
        },
        { name: 'location', type: 'text', label: 'Where are you based?', required: true, placeholder: 'e.g. Bangalore, India' },
        { name: 'phoneNumber', type: 'phone', label: 'Phone Number', placeholder: '98765 43210' },
        { name: 'linkedinUrl', type: 'url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
        { name: 'bio', type: 'textarea', label: 'Tell us more about yourself (optional)', placeholder: 'A brief bio helps us find better matches...', validation: { max: 500 } },
      ],
      next: 'attribution',
    },

    // ─── Attribution / Channel Source ───
    attribution: {
      id: 'attribution',
      type: 'choices',
      content: "How did you hear about Cleya.ai?",
      choices: [
        { label: '💼 LinkedIn', value: 'linkedin', next: 'completion' },
        { label: '🐦 Twitter / X', value: 'twitter', next: 'completion' },
        { label: '💬 WhatsApp Group', value: 'whatsapp_group', next: 'completion' },
        { label: '👥 Friend Referral', value: 'friend_referral', next: 'completion' },
        { label: '🎤 Event (The Pitch)', value: 'event_the_pitch', next: 'completion' },
        { label: '😇 Angel Network', value: 'angel_network', next: 'completion' },
        { label: '📧 VC Newsletter', value: 'vc_newsletter', next: 'completion' },
        { label: '🔍 Google Search', value: 'google_search', next: 'completion' },
        { label: '🔗 Other', value: 'other', next: 'completion' },
      ],
    },

    // ─── Completion ───
    completion: {
      id: 'completion',
      type: 'message',
      content:
        "You're all set! ✅\n\nI'm now working on finding your best matches. I'll notify you as soon as I find people worth connecting with.\n\nYou can come back anytime to update your profile or check your matches. See you soon!",
      next: null,
      metadata: { action: 'complete_onboarding' },
    },
  },
};
