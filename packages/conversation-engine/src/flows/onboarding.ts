import { ConversationFlow } from '@boardy/types';

export const onboardingFlow: ConversationFlow = {
  id: 'onboarding_v1',
  name: 'Boardy Onboarding',
  description: 'Main onboarding flow — collects persona, goals, and profile data',
  startNode: 'welcome',
  nodes: {
    // ─── Welcome ───
    welcome: {
      id: 'welcome',
      type: 'message',
      content:
        "Hey there! 👋 I'm Boardy, your AI networking assistant. I'm going to help you connect with the right people in your industry.\n\nFirst, let me learn a bit about you so I can find your best matches.",
      next: 'persona_select',
    },

    // ─── Persona Selection ───
    persona_select: {
      id: 'persona_select',
      type: 'choices',
      content: "What best describes you right now?",
      choices: [
        { label: '🚀 Founder / CEO', value: 'FOUNDER', next: 'founder_details' },
        { label: '💰 Investor / VC', value: 'INVESTOR', next: 'investor_details' },
        { label: '🧠 Advisor / Mentor', value: 'ADVISOR', next: 'advisor_details' },
        { label: '⚙️ Operator / Executive', value: 'OPERATOR', next: 'operator_details' },
        { label: '🔍 Looking for a role', value: 'JOB_SEEKER', next: 'jobseeker_details' },
        { label: '🤝 Recruiter', value: 'RECRUITER', next: 'recruiter_details' },
        { label: '💻 Freelancer / Consultant', value: 'FREELANCER', next: 'freelancer_details' },
      ],
      next: 'founder_details', // fallback
    },

    // ─── Founder Flow ───
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
      ],
      next: 'founder_goals',
    },

    founder_goals: {
      id: 'founder_goals',
      type: 'choices',
      content: "What are you looking for right now? (Pick the most important)",
      choices: [
        { label: '💰 Fundraising', value: 'fundraising', next: 'common_details' },
        { label: '🤝 Co-founder', value: 'cofounder', next: 'common_details' },
        { label: '🧠 Advisors / Mentors', value: 'advisors', next: 'common_details' },
        { label: '👥 Hiring', value: 'hiring', next: 'common_details' },
        { label: '🤝 Partnerships', value: 'partnerships', next: 'common_details' },
        { label: '📈 Customers', value: 'customers', next: 'common_details' },
      ],
    },

    // ─── Investor Flow ───
    investor_details: {
      id: 'investor_details',
      type: 'form',
      content: "Welcome! Let's set up your investor profile.",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Fund / Firm Name', required: true, placeholder: 'e.g. Sequoia Capital' },
        { name: 'currentRole', type: 'text', label: 'Your Title', required: true, placeholder: 'e.g. Partner' },
        { name: 'headline', type: 'text', label: 'Investment focus', required: true, placeholder: 'e.g. Early-stage B2B SaaS in APAC' },
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
      ],
      next: 'common_details',
    },

    // ─── Advisor Flow ───
    advisor_details: {
      id: 'advisor_details',
      type: 'form',
      content: "Awesome! Let's capture your advisory profile.",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Your primary title', required: true, placeholder: 'e.g. Fractional CTO' },
        { name: 'headline', type: 'text', label: 'What you advise on', required: true, placeholder: 'e.g. Product strategy for B2B SaaS startups' },
        { name: 'companyName', type: 'text', label: 'Current company (if any)', placeholder: 'e.g. Independent' },
      ],
      next: 'common_details',
    },

    // ─── Operator Flow ───
    operator_details: {
      id: 'operator_details',
      type: 'form',
      content: "Perfect. Let's get your operator profile ready.",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Company', required: true },
        { name: 'currentRole', type: 'text', label: 'Your Role', required: true, placeholder: 'e.g. VP Engineering' },
        { name: 'headline', type: 'text', label: 'What you do in one line', required: true },
        {
          name: 'companyStage',
          type: 'select',
          label: 'Company Stage',
          required: true,
          options: [
            { label: 'Startup (< 50)', value: 'SEED' },
            { label: 'Scale-up (50-500)', value: 'SERIES_B' },
            { label: 'Enterprise (500+)', value: 'GROWTH' },
            { label: 'Public company', value: 'PUBLIC' },
          ],
        },
      ],
      next: 'common_details',
    },

    // ─── Job Seeker Flow ───
    jobseeker_details: {
      id: 'jobseeker_details',
      type: 'form',
      content: "Let's get your profile ready to match you with opportunities!",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Current / Most Recent Role', required: true },
        { name: 'headline', type: 'text', label: 'What role are you looking for?', required: true, placeholder: 'e.g. Senior Product Manager at a Series A startup' },
        { name: 'companyName', type: 'text', label: 'Current / Last Company', placeholder: 'e.g. Google' },
        { name: 'yearsExperience', type: 'number', label: 'Years of experience', validation: { min: 0, max: 50 } },
      ],
      next: 'common_details',
    },

    // ─── Recruiter Flow ───
    recruiter_details: {
      id: 'recruiter_details',
      type: 'form',
      content: "Let's set up your recruiting profile.",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Company / Agency', required: true },
        { name: 'currentRole', type: 'text', label: 'Your Title', required: true },
        { name: 'headline', type: 'text', label: 'What roles do you typically hire for?', required: true },
      ],
      next: 'common_details',
    },

    // ─── Freelancer Flow ───
    freelancer_details: {
      id: 'freelancer_details',
      type: 'form',
      content: "Let's build your freelancer profile.",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Your Specialty', required: true, placeholder: 'e.g. Full-Stack Developer' },
        { name: 'headline', type: 'text', label: 'Describe your services', required: true, placeholder: 'e.g. I build MVPs for early-stage startups' },
        { name: 'yearsExperience', type: 'number', label: 'Years of experience' },
      ],
      next: 'common_details',
    },

    // ─── Common Details (all personas) ───
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
        { name: 'location', type: 'text', label: 'Where are you based?', required: true, placeholder: 'e.g. San Francisco, CA' },
        { name: 'linkedinUrl', type: 'url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
        { name: 'bio', type: 'textarea', label: 'Tell us more about yourself (optional)', placeholder: 'A brief bio helps us find better matches...', validation: { max: 500 } },
      ],
      next: 'voice_offer',
    },

    // ─── Voice Call Offer ───
    voice_offer: {
      id: 'voice_offer',
      type: 'choices',
      content:
        "Great profile! 🎉\n\nWant to do a quick 5-minute AI voice call? It helps me understand you better and find even more relevant connections. Think of it as a casual intro chat.",
      choices: [
        { label: '📞 Yes, call me!', value: 'yes_call', next: 'phone_collect' },
        { label: '⏭️ Skip for now', value: 'skip_call', next: 'completion' },
      ],
    },

    phone_collect: {
      id: 'phone_collect',
      type: 'form',
      content: "What's the best number to reach you?",
      formSchema: [
        { name: 'phone', type: 'phone', label: 'Phone Number', required: true, placeholder: '+1 (555) 123-4567' },
      ],
      next: 'call_scheduled',
    },

    call_scheduled: {
      id: 'call_scheduled',
      type: 'message',
      content: "Perfect! 📞 I'll give you a call shortly. You'll hear from me within the next few minutes.\n\nIn the meantime, I'm already looking for great matches for you!",
      next: 'completion',
      metadata: { action: 'schedule_call' },
    },

    // ─── Completion ───
    completion: {
      id: 'completion',
      type: 'message',
      content:
        "You're all set! ✅\n\nI'm now working on finding your best matches. I'll notify you as soon as I find people worth connecting with.\n\nYou can come back anytime to update your profile or check your matches. See you soon! 🤝",
      next: null,
      metadata: { action: 'complete_onboarding' },
    },
  },
};
