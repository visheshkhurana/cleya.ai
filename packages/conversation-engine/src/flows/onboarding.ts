import { ConversationFlow } from '@cleya/types';

export const onboardingFlow: ConversationFlow = {
  id: 'onboarding_v1',
  name: 'Cleya.ai Onboarding',
  description: 'Conversational onboarding — warm, one-question-at-a-time flow with persona-specific paths',
  startNode: 'welcome',
  nodes: {
    welcome: {
      id: 'welcome',
      type: 'message',
      content:
        "hey! i'm cleya 👋\n\nthink of me as that friend who somehow knows everyone worth knowing — founders, investors, operators, the whole crew.\n\ni'd love to learn a bit about you so i can start making some really good intros. takes about 3 minutes, and it's just a casual chat — no pressure.",
      next: 'persona_select',
    },

    persona_select: {
      id: 'persona_select',
      type: 'choices',
      content: "so first things first — what brings you here?",
      choices: [
        { label: "🚀 I'm building something", value: 'FOUNDER', next: 'founder_open' },
        { label: "💰 I invest in startups", value: 'INVESTOR', next: 'investor_open' },
        { label: "🎯 I'm exploring new roles", value: 'TALENT', next: 'talent_open' },
        { label: "🏆 Here for The Pitch by Deel", value: 'EVENT_PARTICIPANT', next: 'event_name' },
        { label: "🤝 I want to source deals", value: 'DEAL_PARTNER', next: 'deal_partner_role' },
        { label: "💬 Something else", value: 'OTHER', next: 'other_role' },
      ],
      next: 'founder_open',
    },

    // ═══════════════════════════════════════════
    // FOUNDER FLOW — one question at a time
    // ═══════════════════════════════════════════

    founder_open: {
      id: 'founder_open',
      type: 'message',
      content: "love that! building something is the hardest and most exciting thing you can do.\n\nlet me learn about what you're working on — one thing at a time.",
      next: 'founder_company_name',
    },

    founder_company_name: {
      id: 'founder_company_name',
      type: 'form',
      content: "what's your company called?",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Company name', required: true, placeholder: 'e.g. Acme Inc.' },
      ],
      next: 'founder_headline',
    },

    founder_headline: {
      id: 'founder_headline',
      type: 'form',
      content: "nice! and in one line — what does it do?",
      formSchema: [
        { name: 'headline', type: 'text', label: 'One-liner', required: true, placeholder: 'e.g. AI-powered logistics for last-mile delivery' },
      ],
      next: 'founder_role',
    },

    founder_role: {
      id: 'founder_role',
      type: 'form',
      content: "what's your title?",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Your title', required: true, placeholder: 'e.g. CEO & Co-Founder' },
      ],
      next: 'founder_stage',
    },

    founder_stage: {
      id: 'founder_stage',
      type: 'choices',
      content: "where are you at stage-wise?",
      choices: [
        { label: 'Pre-Seed / Idea stage', value: 'PRE_SEED', next: 'founder_deep_dive' },
        { label: 'Seed', value: 'SEED', next: 'founder_deep_dive' },
        { label: 'Series A', value: 'SERIES_A', next: 'founder_deep_dive' },
        { label: 'Series B', value: 'SERIES_B', next: 'founder_deep_dive' },
        { label: 'Series C+', value: 'SERIES_C_PLUS', next: 'founder_deep_dive' },
        { label: 'Growth', value: 'GROWTH', next: 'founder_deep_dive' },
        { label: 'Bootstrapped & profitable', value: 'BOOTSTRAPPED', next: 'founder_deep_dive' },
      ],
    },

    founder_deep_dive: {
      id: 'founder_deep_dive',
      type: 'form',
      content: "tell me more — the more specific you are, the better intros i can make.",
      formSchema: [
        { name: 'businessDescription', type: 'textarea', label: 'What problem do you solve? Who are your customers?', placeholder: 'The more detail, the better matches you\'ll get...', validation: { max: 500 } },
      ],
      next: 'founder_traction',
    },

    founder_traction: {
      id: 'founder_traction',
      type: 'form',
      content: "any traction to share? this helps me match you with the right people.",
      formSchema: [
        { name: 'keyTractionPoints', type: 'textarea', label: 'Revenue, users, notable milestones — anything you\'re proud of', placeholder: 'e.g. $500K ARR, 10K users, YC W24', validation: { max: 300 } },
      ],
      next: 'founder_priority',
    },

    founder_priority: {
      id: 'founder_priority',
      type: 'choices',
      content: "okay i'm getting a picture here. what's the #1 thing you need right now? this helps me prioritize who to connect you with.",
      choices: [
        { label: '💰 Raising a round', value: 'FUNDRAISING', next: 'founder_raise_amount' },
        { label: '🤝 Finding a co-founder', value: 'COFOUNDER', next: 'founder_industries' },
        { label: '👥 Hiring key people', value: 'HIRING', next: 'founder_industries' },
        { label: '📢 Growth / marketing help', value: 'MARKETING', next: 'founder_industries' },
        { label: '🤝 Sales & partnerships', value: 'SALES_BD', next: 'founder_industries' },
      ],
    },

    founder_raise_amount: {
      id: 'founder_raise_amount',
      type: 'form',
      content: "got it — fundraising mode. how much are you raising?",
      formSchema: [
        { name: 'raiseAmount', type: 'text', label: 'Target raise', required: true, placeholder: 'e.g. $2M' },
      ],
      next: 'founder_raised_so_far',
    },

    founder_raised_so_far: {
      id: 'founder_raised_so_far',
      type: 'form',
      content: "how much have you raised so far?",
      formSchema: [
        { name: 'amountRaisedToDate', type: 'text', label: 'Raised to date', placeholder: 'e.g. $500K pre-seed' },
      ],
      next: 'founder_close_date',
    },

    founder_close_date: {
      id: 'founder_close_date',
      type: 'form',
      content: "when are you looking to close?",
      formSchema: [
        { name: 'roundCloseDate', type: 'text', label: 'Target timeline', placeholder: 'e.g. Q2 2026' },
      ],
      next: 'founder_industries',
    },

    founder_industries: {
      id: 'founder_industries',
      type: 'form',
      content: "almost there — what space are you in?",
      formSchema: [
        {
          name: 'industries',
          type: 'multiselect',
          label: 'Pick all that apply',
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
      ],
      next: 'founder_location',
    },

    founder_location: {
      id: 'founder_location',
      type: 'form',
      content: "where are you based?",
      formSchema: [
        { name: 'location', type: 'text', label: 'City / region', required: true, placeholder: 'e.g. Bangalore, India' },
      ],
      next: 'founder_linkedin',
    },

    founder_linkedin: {
      id: 'founder_linkedin',
      type: 'form',
      content: "last thing before we wrap up your profile — got a linkedin? (helps me verify and find you better matches)",
      formSchema: [
        { name: 'linkedinUrl', type: 'url', label: 'LinkedIn URL (optional)', placeholder: 'https://linkedin.com/in/...' },
      ],
      next: 'attribution',
    },

    // ═══════════════════════════════════════════
    // INVESTOR / VC FLOW — one question at a time
    // ═══════════════════════════════════════════

    investor_open: {
      id: 'investor_open',
      type: 'message',
      content: "great — always good to have more investors in the network.\n\ni'll match you with founders you'd actually want to meet, not just anyone with a pitch deck. let me learn your taste.",
      next: 'investor_fund_name',
    },

    investor_fund_name: {
      id: 'investor_fund_name',
      type: 'form',
      content: "what's your fund or firm called?",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Fund / firm name', required: true, placeholder: 'e.g. Sequoia Capital' },
      ],
      next: 'investor_role',
    },

    investor_role: {
      id: 'investor_role',
      type: 'form',
      content: "and your title there?",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Your title', required: true, placeholder: 'e.g. Partner' },
      ],
      next: 'investor_focus',
    },

    investor_focus: {
      id: 'investor_focus',
      type: 'form',
      content: "in one line — what's your investment focus?",
      formSchema: [
        { name: 'headline', type: 'text', label: 'Investment focus', required: true, placeholder: 'e.g. Early-stage B2B SaaS in India' },
      ],
      next: 'investor_type',
    },

    investor_type: {
      id: 'investor_type',
      type: 'choices',
      content: "what type of investor are you?",
      choices: [
        { label: 'Angel Investor', value: 'angel', next: 'investor_stage' },
        { label: 'VC Fund', value: 'vc', next: 'investor_stage' },
        { label: 'Family Office', value: 'family_office', next: 'investor_stage' },
        { label: 'Corporate VC', value: 'corporate_vc', next: 'investor_stage' },
        { label: 'Syndicate Lead', value: 'syndicate', next: 'investor_stage' },
        { label: 'Other', value: 'other', next: 'investor_stage' },
      ],
    },

    investor_stage: {
      id: 'investor_stage',
      type: 'choices',
      content: "what stages do you typically invest in?",
      choices: [
        { label: 'Pre-Seed', value: 'PRE_SEED', next: 'investor_check_size' },
        { label: 'Seed', value: 'SEED', next: 'investor_check_size' },
        { label: 'Series A', value: 'SERIES_A', next: 'investor_check_size' },
        { label: 'Series B', value: 'SERIES_B', next: 'investor_check_size' },
        { label: 'Growth / Late', value: 'SERIES_C_PLUS', next: 'investor_check_size' },
      ],
    },

    investor_check_size: {
      id: 'investor_check_size',
      type: 'form',
      content: "what's your typical check size?",
      formSchema: [
        { name: 'investmentAmount', type: 'text', label: 'Check size', placeholder: 'e.g. $100K - $500K' },
      ],
      next: 'investor_portfolio',
    },

    investor_portfolio: {
      id: 'investor_portfolio',
      type: 'form',
      content: "any notable portfolio companies? (helps me avoid sending you duplicate pitches)",
      formSchema: [
        { name: 'portfolioCompanies', type: 'textarea', label: 'Portfolio companies', placeholder: 'List a few names, comma-separated', validation: { max: 500 } },
      ],
      next: 'investor_industries',
    },

    investor_industries: {
      id: 'investor_industries',
      type: 'form',
      content: "which sectors are you most interested in?",
      formSchema: [
        {
          name: 'industries',
          type: 'multiselect',
          label: 'Pick all that apply',
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
      ],
      next: 'investor_location',
    },

    investor_location: {
      id: 'investor_location',
      type: 'form',
      content: "where are you based?",
      formSchema: [
        { name: 'location', type: 'text', label: 'City / region', required: true, placeholder: 'e.g. Mumbai, India' },
      ],
      next: 'investor_linkedin',
    },

    investor_linkedin: {
      id: 'investor_linkedin',
      type: 'form',
      content: "got a linkedin? (optional but helps)",
      formSchema: [
        { name: 'linkedinUrl', type: 'url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
      ],
      next: 'attribution',
    },

    // ═══════════════════════════════════════════
    // TALENT / JOB SEEKER FLOW — one question at a time
    // ═══════════════════════════════════════════

    talent_open: {
      id: 'talent_open',
      type: 'message',
      content: "exciting! there are some incredible startups looking for people right now.\n\nlet me learn about you so i can play matchmaker.",
      next: 'talent_current_role',
    },

    talent_current_role: {
      id: 'talent_current_role',
      type: 'form',
      content: "what's your current or most recent role?",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Current / recent role', required: true, placeholder: 'e.g. Senior Engineer at Google' },
      ],
      next: 'talent_looking_for',
    },

    talent_looking_for: {
      id: 'talent_looking_for',
      type: 'form',
      content: "and what kind of role are you looking for next?",
      formSchema: [
        { name: 'headline', type: 'text', label: 'What you\'re looking for', required: true, placeholder: 'e.g. Founding engineer role at an AI startup' },
      ],
      next: 'talent_experience',
    },

    talent_experience: {
      id: 'talent_experience',
      type: 'form',
      content: "how many years of experience do you have?",
      formSchema: [
        { name: 'yearsExperience', type: 'number', label: 'Years of experience', validation: { min: 0, max: 50 } },
      ],
      next: 'talent_target_role',
    },

    talent_target_role: {
      id: 'talent_target_role',
      type: 'choices',
      content: "what type of role gets you fired up?",
      choices: [
        { label: '👩‍💻 Founding Engineer', value: 'FOUNDING_ENGINEER', next: 'talent_stage_pref' },
        { label: '📈 Founding GTM / Sales', value: 'FOUNDING_GTM', next: 'talent_stage_pref' },
        { label: '🎯 Chief of Staff', value: 'CHIEF_OF_STAFF', next: 'talent_stage_pref' },
        { label: '📢 Growth / Content', value: 'GROWTH_CONTENT', next: 'talent_stage_pref' },
        { label: '📝 Open to anything exciting', value: 'OPEN_APPLICATION', next: 'talent_stage_pref' },
        { label: '🤝 Co-Founder', value: 'COFOUNDER', next: 'talent_stage_pref' },
      ],
    },

    talent_stage_pref: {
      id: 'talent_stage_pref',
      type: 'choices',
      content: "great taste. what company stage do you prefer?",
      choices: [
        { label: 'Pre-Seed / Idea', value: 'PRE_SEED', next: 'talent_work_style' },
        { label: 'Seed', value: 'SEED', next: 'talent_work_style' },
        { label: 'Series A', value: 'SERIES_A', next: 'talent_work_style' },
        { label: 'Series B', value: 'SERIES_B', next: 'talent_work_style' },
        { label: 'Series C+', value: 'SERIES_C_PLUS', next: 'talent_work_style' },
        { label: 'Growth', value: 'GROWTH', next: 'talent_work_style' },
      ],
    },

    talent_work_style: {
      id: 'talent_work_style',
      type: 'choices',
      content: "how do you like to work?",
      choices: [
        { label: '🏠 Remote', value: 'REMOTE', next: 'talent_industries' },
        { label: '🏢 In-Office', value: 'IN_OFFICE', next: 'talent_industries' },
        { label: '🔄 Hybrid', value: 'HYBRID', next: 'talent_industries' },
      ],
    },

    talent_industries: {
      id: 'talent_industries',
      type: 'form',
      content: "which industries excite you most?",
      formSchema: [
        {
          name: 'industries',
          type: 'multiselect',
          label: 'Pick all that apply',
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
      ],
      next: 'talent_location',
    },

    talent_location: {
      id: 'talent_location',
      type: 'form',
      content: "where are you based?",
      formSchema: [
        { name: 'location', type: 'text', label: 'City / region', required: true, placeholder: 'e.g. Bangalore, India' },
      ],
      next: 'talent_linkedin',
    },

    talent_linkedin: {
      id: 'talent_linkedin',
      type: 'form',
      content: "linkedin? (optional — but founders love seeing it)",
      formSchema: [
        { name: 'linkedinUrl', type: 'url', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/...' },
      ],
      next: 'attribution',
    },

    // ═══════════════════════════════════════════
    // EVENT PARTICIPANT FLOW
    // ═══════════════════════════════════════════

    event_name: {
      id: 'event_name',
      type: 'form',
      content: "the Pitch by Deel — exciting! what's your company called?",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Company name', required: true, placeholder: 'e.g. Acme Inc.' },
      ],
      next: 'event_role',
    },

    event_role: {
      id: 'event_role',
      type: 'form',
      content: "and your role?",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Your role', required: true, placeholder: 'e.g. CEO & Founder' },
      ],
      next: 'event_headline',
    },

    event_headline: {
      id: 'event_headline',
      type: 'form',
      content: "one-liner about what your company does?",
      formSchema: [
        { name: 'headline', type: 'text', label: 'One-liner', required: true, placeholder: 'e.g. AI-powered hiring platform' },
      ],
      next: 'event_stage',
    },

    event_stage: {
      id: 'event_stage',
      type: 'choices',
      content: "what stage are you at?",
      choices: [
        { label: 'Pre-Seed', value: 'PRE_SEED', next: 'event_description' },
        { label: 'Seed', value: 'SEED', next: 'event_description' },
        { label: 'Series A', value: 'SERIES_A', next: 'event_description' },
        { label: 'Series B+', value: 'SERIES_B', next: 'event_description' },
      ],
    },

    event_description: {
      id: 'event_description',
      type: 'form',
      content: "tell me about your business for pitch prep — what makes you unique?",
      formSchema: [
        { name: 'businessDescription', type: 'textarea', label: 'Your business', required: true, placeholder: 'What problem do you solve? What makes you stand out?', validation: { max: 500 } },
      ],
      next: 'event_location',
    },

    event_location: {
      id: 'event_location',
      type: 'form',
      content: "where are you based?",
      formSchema: [
        { name: 'location', type: 'text', label: 'City / region', required: true, placeholder: 'e.g. Delhi, India' },
        {
          name: 'industries',
          type: 'multiselect',
          label: 'Your space',
          required: true,
          options: [
            { label: 'AI / ML', value: 'ai_ml' },
            { label: 'SaaS', value: 'saas' },
            { label: 'Fintech', value: 'fintech' },
            { label: 'Healthcare', value: 'healthcare' },
            { label: 'E-commerce', value: 'ecommerce' },
            { label: 'Other', value: 'other' },
          ],
        },
      ],
      next: 'attribution',
    },

    // ═══════════════════════════════════════════
    // DEAL PARTNER FLOW
    // ═══════════════════════════════════════════

    deal_partner_role: {
      id: 'deal_partner_role',
      type: 'form',
      content: "deal partner — nice. what's your current role?",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Your role', required: true, placeholder: 'e.g. BD Lead at TechStars' },
      ],
      next: 'deal_partner_focus',
    },

    deal_partner_focus: {
      id: 'deal_partner_focus',
      type: 'form',
      content: "what kind of deals do you source?",
      formSchema: [
        { name: 'headline', type: 'text', label: 'Deal focus', required: true, placeholder: 'e.g. Pre-seed AI/ML startups in LATAM' },
      ],
      next: 'deal_partner_location',
    },

    deal_partner_location: {
      id: 'deal_partner_location',
      type: 'form',
      content: "where are you based?",
      formSchema: [
        { name: 'location', type: 'text', label: 'City', required: true, placeholder: 'e.g. Miami, FL' },
        { name: 'cityBased', type: 'text', label: 'City you operate in', required: true, placeholder: 'e.g. Miami, FL' },
      ],
      next: 'deal_partner_sectors',
    },

    deal_partner_sectors: {
      id: 'deal_partner_sectors',
      type: 'form',
      content: "what sectors do you focus on?",
      formSchema: [
        {
          name: 'industries',
          type: 'multiselect',
          label: 'Your sectors',
          required: true,
          options: [
            { label: 'AI / ML', value: 'ai_ml' },
            { label: 'SaaS', value: 'saas' },
            { label: 'Fintech', value: 'fintech' },
            { label: 'Healthcare', value: 'healthcare' },
            { label: 'E-commerce', value: 'ecommerce' },
            { label: 'Other', value: 'other' },
          ],
        },
      ],
      next: 'attribution',
    },

    // ═══════════════════════════════════════════
    // OTHER FLOW
    // ═══════════════════════════════════════════

    other_role: {
      id: 'other_role',
      type: 'form',
      content: "no problem! what do you do?",
      formSchema: [
        { name: 'currentRole', type: 'text', label: 'Your role', required: true, placeholder: 'e.g. VP Engineering at BigCorp' },
      ],
      next: 'other_headline',
    },

    other_headline: {
      id: 'other_headline',
      type: 'form',
      content: "and what brings you to cleya?",
      formSchema: [
        { name: 'headline', type: 'text', label: 'What you\'re looking for', required: true, placeholder: 'e.g. Looking to connect with founders in fintech' },
      ],
      next: 'other_company',
    },

    other_company: {
      id: 'other_company',
      type: 'form',
      content: "are you with a company?",
      formSchema: [
        { name: 'companyName', type: 'text', label: 'Company (if any)', placeholder: 'e.g. Independent' },
      ],
      next: 'other_industries',
    },

    other_industries: {
      id: 'other_industries',
      type: 'form',
      content: "which industries are you interested in?",
      formSchema: [
        {
          name: 'industries',
          type: 'multiselect',
          label: 'Pick all that apply',
          required: true,
          options: [
            { label: 'AI / ML', value: 'ai_ml' },
            { label: 'SaaS', value: 'saas' },
            { label: 'Fintech', value: 'fintech' },
            { label: 'Healthcare', value: 'healthcare' },
            { label: 'E-commerce', value: 'ecommerce' },
            { label: 'Other', value: 'other' },
          ],
        },
      ],
      next: 'other_location',
    },

    other_location: {
      id: 'other_location',
      type: 'form',
      content: "where are you based?",
      formSchema: [
        { name: 'location', type: 'text', label: 'City / region', required: true, placeholder: 'e.g. Bangalore, India' },
      ],
      next: 'attribution',
    },

    // ═══════════════════════════════════════════
    // ATTRIBUTION → PROFILE CONFIRMATION → COMPLETION
    // ═══════════════════════════════════════════

    attribution: {
      id: 'attribution',
      type: 'choices',
      content: "one last thing — how did you hear about cleya?",
      choices: [
        { label: '💼 LinkedIn', value: 'linkedin', next: 'profile_confirmation' },
        { label: '🐦 Twitter / X', value: 'twitter', next: 'profile_confirmation' },
        { label: '💬 WhatsApp Group', value: 'whatsapp_group', next: 'profile_confirmation' },
        { label: '👥 Friend Referral', value: 'friend_referral', next: 'profile_confirmation' },
        { label: '🎤 Event (The Pitch)', value: 'event_the_pitch', next: 'profile_confirmation' },
        { label: '😇 Angel Network', value: 'angel_network', next: 'profile_confirmation' },
        { label: '📧 VC Newsletter', value: 'vc_newsletter', next: 'profile_confirmation' },
        { label: '🔍 Google Search', value: 'google_search', next: 'profile_confirmation' },
        { label: '🔗 Other', value: 'other', next: 'profile_confirmation' },
      ],
    },

    profile_confirmation: {
      id: 'profile_confirmation',
      type: 'choices',
      content: "placeholder — will be replaced with narrative profile summary",
      choices: [
        { label: '✅ Looks good — let\'s go!', value: 'confirm', next: 'completion' },
        { label: '✏️ I\'ll tweak it later from my dashboard', value: 'edit_later', next: 'completion' },
      ],
    },

    completion: {
      id: 'completion',
      type: 'message',
      content:
        "you're all set! 🎉\n\ni'm already working on finding your best matches. i'll notify you as soon as i find people worth connecting with.\n\nlet's go! 🚀",
      next: null,
      metadata: { action: 'complete_onboarding' },
    },
  },
};
