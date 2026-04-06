'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PublicNav from '@/components/PublicNav';
import AppShell from '@/components/AppShell';

const blogPosts: Record<string, {
  title: string;
  author: string;
  authorRole: string;
  date: string;
  category: string;
  readTime: string;
  content: string[];
  relatedLinks: { href: string; label: string }[];
}> = {
  'how-to-raise-seed-funding-india-2026': {
    title: 'How to Raise Seed Funding in India: Complete Guide 2026',
    author: 'Rahul Sharma',
    authorRole: 'Founder & CEO, Cleya.ai',
    date: '2026-03-20',
    category: 'Fundraising',
    readTime: '12 min read',
    content: [
      'Raising seed funding in India has evolved dramatically. In 2026, the Indian startup ecosystem is more mature, more competitive, and more rewarding than ever. This guide covers everything you need to know as a first-time founder.',
      '## 1. Define Your Funding Stage\n\nBefore approaching investors, be crystal clear about your stage. Pre-seed (idea to early traction, typically ₹25L - ₹2Cr) is different from Seed (product-market fit signals, typically ₹2Cr - ₹15Cr). Most founders make the mistake of approaching the wrong stage of investors.',
      '## 2. Build Your Deck\n\nYour pitch deck should be 10-12 slides max. Cover: Problem, Solution, Market Size (TAM/SAM/SOM), Business Model, Traction, Team, Competition, Go-to-Market, Financial Projections, and Ask. Indian investors particularly value traction metrics and unit economics.',
      '## 3. Warm Intros Over Cold Outreach\n\nCold emails to investors have a ~2% response rate. Warm introductions through mutual connections have a ~40% response rate. This is exactly why platforms like Cleya.ai exist — to create warm, contextual introductions between founders and the right investors. Learn more in our [warm intro guide](/blog/founder-investor-warm-intro-guide).',
      '## 4. Know Your Investors\n\nResearch each investor thoroughly. Know their thesis, portfolio, check size, and what stage they invest at. In India, key seed-stage investors include Sequoia Surge, Accel, Blume Ventures, and dozens of active angel investors. See our [top angel investors in Indian fintech](/blog/top-angel-investors-india-fintech) for a curated list.',
      '## 5. Prepare for Due Diligence\n\nHave your incorporation documents, cap table, financial statements, and key contracts ready. Indian investors are increasingly sophisticated and will ask for comprehensive documentation.',
      '## 6. Pick the Right City\n\nYour location matters for fundraising. [Bangalore](/cities/bangalore) has the highest concentration of early-stage investors, while [Mumbai](/cities/mumbai) is strong for fintech and consumer brands. [Delhi NCR](/cities/delhi) leads in logistics, edtech, and B2B commerce.',
      '## Key Takeaways\n\n- Start networking 3-6 months before you need to raise\n- Target 50-100 investors for a typical seed round\n- Warm intros dramatically increase your success rate\n- Have your data room ready before first meetings\n- India\'s seed ecosystem is thriving — the right capital is out there',
    ],
    relatedLinks: [
      { href: '/blog/founder-investor-warm-intro-guide', label: 'The Art of the Warm Intro' },
      { href: '/blog/top-angel-investors-india-fintech', label: 'Top 50 Angel Investors in Indian Fintech' },
      { href: '/blog/bangalore-startup-ecosystem-guide', label: "Guide to Bangalore's Startup Ecosystem" },
      { href: '/features', label: 'See How Cleya Matching Works' },
    ],
  },
  'top-angel-investors-india-fintech': {
    title: 'Top 50 Angel Investors in Indian Fintech',
    author: 'Priya Patel',
    authorRole: 'Head of Investor Relations',
    date: '2026-03-15',
    category: 'Investors',
    readTime: '8 min read',
    content: [
      'India\'s fintech sector has attracted over $20 billion in funding, and angel investors play a crucial role in the early-stage ecosystem. Here are the most active angels in Indian fintech right now.',
      '## What Makes a Great Fintech Angel?\n\nThe best fintech angels bring more than capital. They bring regulatory expertise (critical in India\'s evolving fintech landscape), network access to banks and NBFCs, and product insights from building or scaling fintech companies.',
      '## Top Categories\n\nWe\'ve organized our list by specialization:\n- **Payments & UPI**: Angels with deep expertise in India\'s payments revolution\n- **Lending & Credit**: Focused on digital lending, BNPL, and credit scoring\n- **Insurance**: InsurTech-focused angels\n- **WealthTech**: Investment and wealth management focused\n- **Crypto/Web3 Finance**: Blockchain and DeFi focused',
      '## How to Connect\n\nThe best way to connect with angel investors is through warm introductions. Platforms like [Cleya.ai](/) match founders with the most relevant investors based on sector, stage, and mutual interests — so your first conversation already has context. Read our [warm intro guide](/blog/founder-investor-warm-intro-guide) for strategies that work.',
      '## City-Specific Investor Hubs\n\n- [Bangalore](/cities/bangalore) — Home to Sequoia India, Accel, Blume Ventures, and the densest angel network\n- [Mumbai](/cities/mumbai) — Matrix Partners, Tiger Global, and strong fintech-specific angels\n- [Delhi NCR](/cities/delhi) — Peak XV, Nexus, and India\'s largest angel networks\n- [Hyderabad](/cities/hyderabad) — Emerging hub with Endiya Partners and Pegasus',
      '## Final Thoughts\n\nAngel investing in Indian fintech is at an all-time high. The key is finding the right angel whose expertise aligns with your specific vertical and stage. Quality of connection matters more than quantity of introductions.',
    ],
    relatedLinks: [
      { href: '/blog/how-to-raise-seed-funding-india-2026', label: 'How to Raise Seed Funding in India' },
      { href: '/blog/founder-investor-warm-intro-guide', label: 'The Art of the Warm Intro' },
      { href: '/cities/bangalore', label: 'Bangalore Startup Ecosystem' },
      { href: '/pricing', label: 'Cleya Pricing Plans' },
    ],
  },
  'ai-matching-future-networking': {
    title: 'Why AI-Powered Matching Is the Future of Professional Networking',
    author: 'Cleya Team',
    authorRole: 'Product Team',
    date: '2026-03-10',
    category: 'Product',
    readTime: '6 min read',
    content: [
      'Traditional networking is broken. Events cost thousands, LinkedIn connections are superficial, and cold outreach has abysmal response rates. AI-powered matching is changing everything.',
      '## The Problem with Traditional Networking\n\nProfessionals spend an average of 6-8 hours per week on networking activities, but only 10% of those interactions lead to meaningful outcomes. The signal-to-noise ratio is terrible.',
      '## How AI Changes the Game\n\nAI matching analyzes dozens of dimensions — sector expertise, stage alignment, geographic proximity, complementary skills, investment thesis alignment, and even communication style compatibility — to surface the most relevant connections.',
      '## The Cleya Approach\n\nAt [Cleya.ai](/), we use conversational AI to build rich professional profiles, then apply our matching engine to find high-compatibility connections. Every match comes with a compatibility score and explanation, and both sides must opt in before any contact information is shared. See all our [features](/features) in detail.',
      '## Results So Far\n\nOur platform achieves a 94% match relevance score (based on user feedback), and matched pairs are 5x more likely to have a productive conversation compared to random networking.',
      '## Getting Started\n\nWhether you\'re [raising a round](/blog/how-to-raise-seed-funding-india-2026), looking for [angel investors](/blog/top-angel-investors-india-fintech), or building your network in [Bangalore](/cities/bangalore), [Mumbai](/cities/mumbai), or [Delhi](/cities/delhi) — Cleya\'s AI matching can find your next meaningful connection.',
    ],
    relatedLinks: [
      { href: '/features', label: 'Cleya Features' },
      { href: '/blog/founder-investor-warm-intro-guide', label: 'The Art of the Warm Intro' },
      { href: '/blog/how-to-raise-seed-funding-india-2026', label: 'How to Raise Seed Funding' },
      { href: '/about', label: 'About Cleya.ai' },
    ],
  },
  'bangalore-startup-ecosystem-guide': {
    title: "The Definitive Guide to Bangalore's Startup Ecosystem",
    author: 'Arjun Mehta',
    authorRole: 'Community Manager, South India',
    date: '2026-03-05',
    category: 'Ecosystem',
    readTime: '15 min read',
    content: [
      'Bangalore is India\'s undisputed startup capital, home to 35+ unicorns and over 12,000 startups. This comprehensive guide covers everything you need to know about building in Bangalore.',
      '## Why Bangalore?\n\nBangalore offers a unique combination of deep tech talent (thanks to IISc, IIMs, and dozens of engineering colleges), established VC presence, and a culture that celebrates entrepreneurship. The city produces more startups per capita than any other Indian city.',
      '## Key Ecosystems Within Bangalore\n\n- **Koramangala**: The OG startup hub — Flipkart, Swiggy, and dozens of other unicorns started here\n- **HSR Layout**: The new hotspot for early-stage startups\n- **Indiranagar**: Where founders meet for coffee and close deals\n- **Whitefield/Marathahalli**: Tech parks and corporate innovation labs',
      '## Top Accelerators\n\nBangalore is home to several world-class accelerators including Antler India, Entrepreneur First, and numerous industry-specific programs. These programs offer capital, mentorship, and network access.',
      '## Fundraising in Bangalore\n\nBangalore has the highest density of VCs and angel investors in India. For seed funding tips, read our [complete fundraising guide](/blog/how-to-raise-seed-funding-india-2026). To find active angel investors in fintech, check our [top 50 list](/blog/top-angel-investors-india-fintech).',
      '## Connecting in Bangalore\n\nThe best way to tap into Bangalore\'s startup ecosystem is through curated introductions. [Cleya.ai](/cities/bangalore) has a strong presence in Bangalore, matching founders with investors, co-founders, and talent across the city. Also explore [Mumbai](/cities/mumbai), [Delhi](/cities/delhi), [Hyderabad](/cities/hyderabad), [Pune](/cities/pune), and [Chennai](/cities/chennai) ecosystems.',
    ],
    relatedLinks: [
      { href: '/cities/bangalore', label: 'Bangalore on Cleya.ai' },
      { href: '/blog/how-to-raise-seed-funding-india-2026', label: 'How to Raise Seed Funding' },
      { href: '/blog/top-angel-investors-india-fintech', label: 'Top Angel Investors in Fintech' },
      { href: '/cities/mumbai', label: 'Mumbai Startup Ecosystem' },
    ],
  },
  'founder-investor-warm-intro-guide': {
    title: 'The Art of the Warm Intro: How Founders Should Approach Investors',
    author: 'Meera Iyer',
    authorRole: 'Partner, Early Stage VC',
    date: '2026-02-28',
    category: 'Fundraising',
    readTime: '10 min read',
    content: [
      'As a VC, I receive 50+ cold emails per week. I respond to maybe 2. But when a trusted connection introduces me to a founder? I take that meeting 90% of the time. Here\'s how founders can maximize their warm intro strategy.',
      '## Why Warm Intros Work\n\nA warm introduction carries implicit social proof. When someone I trust vouches for a founder, it tells me three things: the founder is credible, the opportunity is relevant to my thesis, and the person is worth my time.',
      '## Finding the Right Connector\n\nNot all warm intros are equal. The best connectors are people who know both you and the investor well, can articulate why the introduction makes sense, and are respected in the ecosystem.',
      '## How to Ask for an Intro\n\nAlways make it easy for your connector. Send them a forwardable email that includes: a one-line ask, why this specific investor is relevant, your traction highlights, and what stage/amount you\'re raising. For more on preparing your raise, see our [seed funding guide](/blog/how-to-raise-seed-funding-india-2026).',
      '## Where to Find Connectors\n\nYour existing network is a starting point, but purpose-built platforms dramatically accelerate the process. City-specific communities like [Bangalore](/cities/bangalore), [Mumbai](/cities/mumbai), and [Delhi](/cities/delhi) have active connector networks through Cleya.',
      '## The Cleya Advantage\n\nPlatforms like [Cleya.ai](/) automate the warm intro process. Instead of spending weeks finding mutual connections, Cleya\'s [AI matching engine](/features) identifies the best matches and facilitates introductions with context for both sides. It\'s like having a super-connector working for you 24/7.',
    ],
    relatedLinks: [
      { href: '/blog/how-to-raise-seed-funding-india-2026', label: 'How to Raise Seed Funding in India' },
      { href: '/blog/top-angel-investors-india-fintech', label: 'Top 50 Angel Investors in Fintech' },
      { href: '/features', label: 'Cleya AI Matching Features' },
      { href: '/blog/ai-matching-future-networking', label: 'Why AI Matching Is the Future' },
    ],
  },

  'india-startup-funding-guide-2026': {
    title: 'India Startup Funding in 2026: Complete Ecosystem Guide',
    author: 'Cleya Research Team',
    authorRole: 'Cleya.ai Research',
    date: '2026-04-01',
    category: 'Ecosystem',
    readTime: '14 min read',
    content: [
      'India startup funding in 2026 has entered a new era of quality over quantity. After the frothy peak of 2021, the market has matured significantly — and that is actually great news for founders who are building with discipline. Indian startups raised approximately $11 billion in 2025, according to [TechCrunch](https://techcrunch.com/2025/12/27/india-startup-funding-hits-11b-in-2025-as-investors-grow-more-selective/), and the momentum has continued into 2026 with $2.57 billion raised in January and February alone, per [Statista](https://www.statista.com/chart/35856/startups-funding-trend-in-india-and-leading-investors/). Funding rounds fell 39% in 2025 versus the 2021 peak, but the total capital deployed held up — meaning each deal is larger and each investor is being more deliberate. For founders who understand this shift, the landscape is more navigable than ever.',
      '## The State of Indian Startup Funding in 2026\n\nThe post-2021 correction reshaped India\'s startup ecosystem in lasting ways. After a flood of capital in 2020 and 2021 that pushed valuations to unsustainable levels, investors pulled back sharply in 2022 and 2023. By 2024, the market had recalibrated. 2025 saw a steady, disciplined recovery. Total startup funding reached $11 billion — not the $38 billion-equivalent peak of 2021, but a far healthier base built on companies with real unit economics, clear paths to profitability, and experienced founding teams.\n\nThe most important shift: the number of rounds fell more than the total capital. This tells you that investors are concentrating bets. They are writing larger cheques into fewer, higher-conviction companies. Spray-and-pray seed investing has largely given way to deep diligence at every stage. For founders, this means your first impression, your metrics, and your introductions matter more than ever. A warm introduction to the right investor is worth more in 2026 than it has ever been. Read our complete guide to [warm introductions for founders](/blog/founder-investor-warm-intro-guide) to understand how to leverage this dynamic.',
      '## Hot Sectors for Funding in 2026\n\nNot all sectors are equal in the eyes of Indian investors right now. Here are the verticals attracting the most capital and the most interest in 2026:\n\n- **Artificial Intelligence and Machine Learning**: AI is the dominant theme across every fund in India. Investors are funding AI-native applications in enterprise software, healthcare diagnostics, legal tech, financial services, and education. Infrastructure plays (GPUs, model training platforms) are also drawing interest from larger funds.\n- **Fintech**: India\'s fintech sector continues to attract significant capital, driven by UPI adoption, the rise of embedded finance, credit access for the underserved, and neo-banking. Regulatory clarity from RBI has actually helped serious fintech founders raise more easily, while weeding out weaker players.\n- **Climate Tech**: India\'s net-zero commitments and the global energy transition have put climate tech firmly on the radar of Indian VCs. Electric vehicles, solar manufacturing, agricultural tech for climate resilience, and carbon credits platforms are all receiving strong interest.\n- **D2C and Consumer Brands**: India\'s 400-million-strong aspirational middle class continues to drive D2C funding. Brands with strong unit economics, premium positioning, and high retention are drawing both VC capital and strategic interest from FMCG conglomerates.\n- **B2B SaaS**: India-built, globally-sold SaaS companies remain a consistent favourite. Investors love the recurring revenue model, predictable churn metrics, and India\'s natural cost advantage in building world-class software teams.\n- **Healthtech**: Post-pandemic, digital health has become a permanent fixture of the funding landscape. Telemedicine, diagnostics, hospital management software, and preventive health platforms have strong investor interest backed by India\'s massive underserved healthcare market.',
      '## Stage-by-Stage Funding Breakdown\n\nUnderstanding what investors expect at each stage will help you approach the right people at the right time with the right story.\n\n- **Pre-seed (Idea to Early Traction)**: Typical check sizes in India range from ₹25 lakh to ₹2 crore ($30,000–$240,000). At this stage, investors are primarily betting on the team and the market insight. Most pre-seed capital in India comes from angel investors, family and friends, government schemes like Startup India Seed Fund, and micro-VCs. You need a validated hypothesis, not a fully built product.\n- **Seed (Product-Market Fit Signals)**: Seed rounds in India typically range from ₹2 crore to ₹15 crore ($240,000–$1.8M). By this stage, investors want to see early traction — a working product, initial customers or users, and some evidence that the core problem is real and your solution is working. Seed investors include dedicated seed funds like Blume Ventures, Stellaris, and 100X.VC, alongside active angels.\n- **Series A (Growth Inflection)**: Series A rounds in India now typically range from ₹15 crore to ₹100 crore ($1.8M–$12M). Investors at this stage want proven unit economics, repeatable customer acquisition, and a clear expansion plan. The bar has risen significantly post-2021; Series A investors are looking for companies that could plausibly become market leaders in their category.\n- **Series B and Beyond**: Series B rounds start at ₹100 crore ($12M) and scale up rapidly. At this stage, institutional investors — both Indian and global — are looking for established market positions, strong retention, and a credible path to either profitability or a large eventual exit. The international capital flows into India heavily at Series B+, with Tiger Global, SoftBank Vision Fund, and DST Global all active participants.',
      '## Top 10 Most Active Investors in India 2026\n\nKnowing who is writing cheques — and at what stage — is essential for focused fundraising. Here are the ten most active investors in the Indian startup ecosystem in 2026:\n\n- **Peak XV Partners (formerly Sequoia India)**: The most storied VC franchise in India, Peak XV has backed Byju\'s, CRED, Meesho, Razorpay, and dozens of other category leaders. They invest from seed (through the Surge accelerator program) all the way to growth. Peak XV is particularly strong in consumer tech, B2B SaaS, and fintech.\n- **Sequoia Surge**: The dedicated early-stage program within the Peak XV family offers $1–2M in seed capital, a 16-week programme, and access to the broader Sequoia network. Surge is highly competitive but one of the best launchpads for founders with global ambitions.\n- **Accel India**: One of the most active seed and Series A investors in India, Accel has backed Freshworks, Flipkart (early), and BrowserStack. They are technology-focused and have a strong SaaS practice alongside consumer internet investments.\n- **Blume Ventures**: A homegrown seed fund that has backed Unacademy, Dunzo, and Purplle. Blume is known for deep SaaS and deep tech conviction, and for building long-term relationships with founders from the earliest stages.\n- **3one4 Capital**: One of the most respected domestic funds in India, 3one4 has a strong thesis around "Bharat" — building for India\'s mass market. Portfolio companies include DarwinBox, Licious, and Fasal. Known for founder-friendliness and rigorous thesis alignment.\n- **Elevation Capital**: Formerly SAIF Partners, Elevation has been one of the most active investors in Indian consumer internet and fintech. Portfolio includes Swiggy, Meesho, and Urban Company. Strong at Series A and B.\n- **Nexus Venture Partners**: A multi-stage fund with deep roots in enterprise software. Nexus has backed Uniphore, Druva, and Postman. Particularly strong for B2B SaaS and developer tools.\n- **Lightspeed India**: Part of the global Lightspeed family, Lightspeed India invests from seed to Series B across consumer and enterprise. Portfolio includes OYO, ShareChat, and Byju\'s. Strong networks in the US make them valuable for founders with global expansion plans.\n- **Kalaari Capital**: A women-led fund with strong conviction in healthcare, climate tech, and consumer brands. Kalaari was an early backer of Snapdeal and Myntra and has reinvented itself as a forward-looking early-stage fund.\n- **Matrix Partners India**: Focused on early-stage deals with a strong track record in fintech and logistics. Matrix has backed Razorpay, Ola, and Dailyhunt. They are known for patient capital and deep operational support for portfolio companies.',
      '## How to Position Your Startup for Funding in 2026\n\nIn a more selective market, the basics matter more than ever. Here is what Indian investors are scrutinising in 2026 that they might have overlooked in 2021:\n\n**Unit economics first**: Investors want to see Customer Acquisition Cost (CAC), Lifetime Value (LTV), gross margins, and payback period. If you cannot explain these clearly, you will not get past a first meeting. The golden metric in 2026 is LTV/CAC ratio — anything above 3x at seed stage is compelling.\n\n**Retention over growth**: Monthly active user growth with terrible retention is a red flag, not a green one. Investors have been burned by companies that grew fast but churned equally fast. Show strong cohort retention data — week 4 and week 12 retention especially.\n\n**Path to profitability**: You do not need to be profitable at seed stage. But you need a believable narrative for when and how profitability happens. "We will figure it out later" no longer works. Model your contribution margin trajectory explicitly.\n\n**Team completeness**: Solo founders face a higher bar in 2026. Having a strong co-founder — ideally with complementary skills — signals execution capability. Read our guide on [how to find a co-founder in India](/blog/how-to-find-cofounder-india) if you are still building your founding team.',
      '## The Role of Warm Introductions in 2026\n\nIf there is one tactical insight that matters more than any pitch advice, it is this: warm introductions are the single highest-leverage activity in fundraising. Cold emails to Indian VCs have an approximately 2% response rate. Warm introductions from trusted connectors convert at 40% or more — a 20x improvement.\n\nWhy? Because investors receive hundreds of cold pitches every week. A warm intro immediately signals credibility (someone they trust thought it was worth their time), relevance (the connector understands both sides), and quality (the connector has filtered on your behalf).\n\nPlatforms like [Cleya.ai](/features) are specifically designed to facilitate these high-signal introductions in the Indian startup ecosystem. Instead of spending months trying to find the right connector, Cleya\'s AI matching engine identifies the most compatible investors for your stage, sector, and location — and facilitates warm, contextual introductions to both sides. The result is a dramatically compressed fundraising timeline with higher meeting conversion rates.\n\nFor a step-by-step guide to executing warm intros effectively, read our [founder-investor warm intro guide](/blog/founder-investor-warm-intro-guide).',
      '## Key Takeaways for 2026\n\n- India raised $11B in startup funding in 2025, and the momentum is continuing into 2026 with $2.57B in the first two months alone\n- Investor selectivity has increased — fewer rounds, larger cheques, higher bar for metrics\n- The hottest sectors are AI/ML, fintech, climate tech, D2C, B2B SaaS, and healthtech\n- Know your stage and target investors who actually invest at that stage with the right thesis\n- Warm introductions convert at 20x the rate of cold outreach — prioritise them\n- For more on raising your first round, read our [complete seed funding guide for India 2026](/blog/how-to-raise-seed-funding-india-2026)',
    ],
    relatedLinks: [
      { href: '/blog/how-to-raise-seed-funding-india-2026', label: 'Complete Seed Funding Guide for India 2026' },
      { href: '/blog/top-angel-investors-india-fintech', label: 'Top 50 Angel Investors in Indian Fintech' },
      { href: '/blog/founder-investor-warm-intro-guide', label: 'The Art of the Warm Intro' },
      { href: '/cities/bangalore', label: 'Bangalore Startup Ecosystem' },
    ],
  },
  'how-to-find-cofounder-india': {
    title: 'How to Find a Co-Founder in India: The 2026 Playbook',
    author: 'Arjun Mehta',
    authorRole: 'Community Manager, Cleya.ai',
    date: '2026-04-02',
    category: 'Founders',
    readTime: '11 min read',
    content: [
      'If you ask any experienced investor what is the single most important factor in backing a startup at the early stage, nearly all of them will say the same thing: team. And within team, the co-founder relationship is the axis that everything else rotates around. Studies consistently show that 65% of high-growth startups have two or more co-founders — not because solo founders cannot succeed, but because the complementary skills, shared accountability, and emotional support of a co-founding team dramatically increases the probability of surviving the inevitable crises of building a company. This is the complete 2026 playbook for finding a co-founder in India\'s startup ecosystem.',
      '## What to Look For in a Co-Founder\n\nThe most common mistake founders make when looking for a co-founder is searching for someone who thinks exactly like them. What you actually need is someone who thinks differently — but shares the same values and vision.\n\nThink about fit across four dimensions:\n\n**Skills**: You want complementary capabilities, not overlapping ones. A technical founder (CTO-type) pairs well with a business founder (CEO-type). A product-focused founder pairs well with a sales and distribution expert. A finance and operations person pairs well with a creative and brand builder. The key question is: do your combined skills cover the core functions your business needs to survive the first two years?\n\n**Values**: Shared values are non-negotiable. How do you both feel about ethics, how you treat employees, how you handle money, and what kind of company you want to build? Misaligned values destroy co-founder relationships more reliably than any business challenge ever could.\n\n**Work style and risk tolerance**: Are you both willing to work at the same intensity? Do you have aligned views on how much risk to take and when to be conservative? Can you have hard conversations with each other without it becoming personal?\n\n**Vision alignment**: You do not need identical five-year visions, but you need to agree on what kind of company you are building. Are you building to sell, building to IPO, building to be independent and profitable? Misalignment here causes devastating splits at the worst possible moments.',
      '## Where to Find Co-Founders in India in 2026\n\nIndia\'s startup ecosystem has matured to the point where there are now specific, purpose-built venues for co-founder search. Here is where to look:\n\n- **YC Co-Founder Matching**: Y Combinator\'s matching platform is free and global, but has a strong presence of India-based founders. Filter by location, skills, and sector. It works best if you have a specific idea and can describe the profile of who you need precisely.\n- **LinkedIn**: Not ideal for co-founder search, but a useful research tool. You can identify potential co-founders at your target companies and warm-approach them through mutual connections. Read more about the limitations of LinkedIn for founder networking in our [LinkedIn vs Cleya comparison](/blog/linkedin-vs-cleya-startup-networking).\n- **Foundersbase**: An India-specific founder matching platform that has been gaining traction. Community-led and free to use.\n- **Headstart Network events**: Headstart runs startup meetups across Indian cities, which are excellent for meeting early-stage founders in person. The quality of people tends to be high because the community self-selects for serious builders.\n- **IIT and IIM alumni networks**: If you are an alumnus, these are your highest-quality co-founder pools. The trust foundation already exists, the calibre is high, and you have a shared reference point. Many successful Indian startups have co-founding teams from the same institution.\n- **T-Hub (Hyderabad) and NSRCEL (IIM Bangalore)**: These accelerators and incubators attract concentrated pools of serious founders. Even if you are not in their programmes, attending their events gives access to the ecosystem.\n- **Industry-specific Slack and WhatsApp groups**: Almost every vertical in India now has dedicated founder communities — fintech, climate tech, healthtech, SaaS. These private communities are where some of the best co-founder matches happen organically.\n- **Cleya.ai**: Cleya uses AI matching to connect founders with potential co-founders based on sector, stage, skill set, location, and working style. Instead of spending months searching, Cleya surfaces high-compatibility matches with context — making the initial conversation much more productive. See our [matching features](/features) for details.',
      '## How to Vet a Potential Co-Founder\n\nFinding someone promising is the beginning, not the end. Vetting a co-founder rigorously before committing is one of the most important processes you will run as a founder. Here is how:\n\n**The 3-month trial project**: Before signing any co-founder agreement, work together on a real, time-bound project. Build an MVP, launch a landing page, go talk to 50 customers together. How you work under pressure, how you handle disagreements, and how you divide and execute reveals everything that theoretical discussions cannot.\n\n**Check references**: This is almost universally skipped and almost universally should not be. Talk to people who have worked with your potential co-founder — colleagues, managers, direct reports. Ask specifically about how they handle pressure, how they communicate difficult truths, and what their biggest weaknesses are.\n\n**The co-founder interview**: Have six specific conversations before you commit:\n1. What does success look like to you in five years — and in ten?\n2. What is the most difficult professional situation you have faced, and how did you handle it?\n3. How do you want to handle major disagreements between us?\n4. What would make you leave this company?\n5. How do you feel about the equity split we are proposing, and is there anything you would want to change?\n6. What are three things you are genuinely not good at that we will need to cover somehow?\n\n**Red flags to take seriously**: Reluctance to check references. Vagueness about their actual role or contributions at previous companies. Unwillingness to work on a trial project before committing. Strong opinions about compensation and perks before the company has any revenue. These are warning signs worth heeding.',
      '## The Co-Founder Agreement\n\nOnce you have found the right person, do not skip the legal foundation. A proper co-founder agreement protects both of you and sets clear expectations from the start.\n\n**Equity split**: Resist the temptation of a 50/50 split if the contributions are genuinely unequal. The Slicing Pie model — which allocates equity dynamically based on real contributions of time and capital before funding — is increasingly popular among Indian early-stage founders for its fairness and transparency.\n\n**Vesting schedule**: Standard market practice in India is a four-year vesting schedule with a one-year cliff. This means one-quarter of equity vests at the one-year mark, and the remainder vests monthly over the following three years. This protects the company if a co-founder leaves early and aligns long-term incentives.\n\n**IP assignment**: Every co-founder must assign all intellectual property created in connection with the company to the company. This is non-negotiable for investors and must be locked down in writing from day one.\n\n**Roles and decision-making**: Define who is CEO (typically one person only), who controls what domains, and what decisions require joint agreement. Investor communications and major pivots usually require consensus; day-to-day execution should be clearly delegated.\n\n**Exit provisions**: What happens if one co-founder wants to leave? What are the buy-back provisions? What happens to unvested equity? Addressing these when everyone is aligned is far easier than addressing them in a moment of conflict.',
      '## City-Specific Co-Founder Hunting Tips\n\nWhere you look depends partly on what kind of co-founder you need:\n\n- [Bangalore](/cities/bangalore) is the best city for finding technical co-founders. The density of senior engineers, data scientists, and product builders is unmatched in India. If you need a CTO or a head of engineering who can eventually be elevated to co-founder, Bangalore is your starting point.\n- [Mumbai](/cities/mumbai) is the hub for finance, business development, and consumer brand expertise. If you are building in fintech, D2C, or media, Mumbai gives you access to co-founders with strong commercial instincts and established networks in traditional industries.\n- [Delhi and NCR](/cities/delhi) is strong for edtech, logistics, B2B commerce, and government-facing businesses. The density of IIT Delhi and IIM alumni networks is also exceptional, and the D2C founder community is particularly vibrant.\n- [Hyderabad](/cities/hyderabad) has become a genuine deep tech hub, driven by investments in aerospace, pharma, and biotech. If you need a co-founder with hard science credentials or deep manufacturing expertise, Hyderabad\'s ecosystem is increasingly strong.\n- [Pune](/cities/pune) has a growing manufacturing tech and automotive tech scene, alongside strong engineering talent from Pune University and adjacent colleges. If your startup sits at the intersection of hardware and software, Pune\'s founder pool is underrated.',
      '## The Bottom Line on Co-Founder Search\n\nFinding a co-founder in India in 2026 is a structured process, not a serendipitous one. The ecosystem has the tools, events, and platforms you need to search deliberately. Do the work: define clearly what you are looking for, use multiple channels, vet rigorously, and get the legal foundation right.\n\nThe right co-founder will not just make your company more fundable — they will make the entire journey more survivable. For more on raising your first round once you have built your founding team, read our [complete seed funding guide for India 2026](/blog/how-to-raise-seed-funding-india-2026). And when you are ready to start connecting with potential partners, explore [Cleya.ai\'s matching platform](/features) built specifically for the Indian startup ecosystem.',
    ],
    relatedLinks: [
      { href: '/blog/how-to-raise-seed-funding-india-2026', label: 'How to Raise Seed Funding in India 2026' },
      { href: '/blog/bangalore-startup-ecosystem-guide', label: "The Definitive Guide to Bangalore's Startup Ecosystem" },
      { href: '/features', label: 'Cleya AI Matching for Founders' },
      { href: '/cities/bangalore', label: 'Bangalore on Cleya.ai' },
    ],
  },
  'linkedin-vs-cleya-startup-networking': {
    title: 'LinkedIn vs Cleya.ai: Which Is Better for Startup Networking in India?',
    author: 'Cleya Team',
    authorRole: 'Product Team, Cleya.ai',
    date: '2026-04-03',
    category: 'Product',
    readTime: '8 min read',
    content: [
      'LinkedIn has 900 million users, a polished mobile app, and a decade of brand recognition as the home of professional networking. For Indian startup founders in 2026, it is also a platform with a 2% cold outreach response rate, an algorithm that rewards content creators over deal-makers, and no features specifically designed for fundraising, co-founder search, or high-signal introductions. This is an honest, side-by-side comparison of LinkedIn and Cleya.ai for the specific needs of Indian startup founders.',
      '## What LinkedIn Does Well\n\nLinkedIn is genuinely excellent at several things, and it would be a mistake to dismiss it entirely.\n\n**Massive reach and discoverability**: With 900 million users globally and over 100 million in India, LinkedIn gives you access to almost anyone in the professional world. If someone is a working professional, they almost certainly have a LinkedIn profile.\n\n**Thought leadership and personal brand building**: LinkedIn is the best platform in India for founders who want to build a public profile. Long-form posts about founder journeys, company milestones, and industry insights regularly reach tens of thousands of views. For brand awareness at the top of the funnel, LinkedIn is unmatched.\n\n**Job posting and talent sourcing**: Hiring? LinkedIn remains the dominant platform for attracting experienced professionals in India. Its job posting functionality, recruiter tools, and candidate database are far ahead of any competitor.\n\n**Alumni and company search**: The ability to filter by company, college, and role makes LinkedIn a powerful research tool for identifying potential investors, customers, or partners before reaching out.',
      '## Where LinkedIn Falls Short for Founders\n\nDespite its scale, LinkedIn has fundamental structural limitations that make it a poor tool for the high-signal networking that startup founders need most.\n\n**2% cold outreach response rate**: This is the defining problem. The vast majority of LinkedIn InMails and connection requests from strangers go unanswered. Investors receive hundreds of connection requests and cold messages from founders every week. Without context, without a mutual connection, and without a warm introduction, your message is noise.\n\n**No match quality scoring**: LinkedIn shows you who exists. It does not tell you who is relevant. A search for "early-stage fintech investor in Bangalore" returns hundreds of results with no indication of who is active, who is actually interested in your stage, or whose thesis aligns with your company.\n\n**Crowded feed algorithm**: LinkedIn\'s content algorithm optimises for engagement, which means controversial opinions, personal stories, and emotional content outperform genuinely useful deal flow and business posts. The feed has become increasingly content-creator-oriented, which is fine for awareness but unhelpful for transactions.\n\n**Pay-to-play InMail**: Reaching someone outside your network requires InMail credits, which are only available on paid plans. Even with credits, response rates on InMail are not meaningfully higher than connection request messages.\n\n**No India-specific or startup-specific features**: LinkedIn is a global, horizontal platform. It has no features for fundraising deal rooms, co-founder matching, investor thesis alignment, or the specific relationship types that matter in India\'s startup ecosystem.',
      '## What Cleya.ai Does Differently\n\nCleya.ai was built from the ground up for the specific networking needs of India\'s startup ecosystem. The fundamental design philosophy is different: instead of helping you broadcast to many people, Cleya helps you connect with the right few.\n\n**AI-powered matching with compatibility scores**: Cleya\'s matching engine analyses stage alignment, sector expertise, geographic focus, investment thesis, complementary skills, and communication style to generate match scores. Every introduction comes with a clear explanation of why the match was made — creating instant context and dramatically improving conversation quality.\n\n**Warm introductions with context**: Every connection on Cleya is a warm introduction. Both sides opt in, both sides receive context about why the match was made, and the first conversation starts from a place of mutual interest rather than cold outreach awkwardness.\n\n**India-specific and startup-specific**: Cleya is built for the Indian startup ecosystem. The investor database, the founder profiles, the matching parameters, and the community are all oriented around how deals actually happen in India — through networks, relationships, and curated access rather than mass outreach.\n\n**Members-only quality curation**: Because Cleya is a curated platform, the signal-to-noise ratio is fundamentally different from LinkedIn. You are not competing with millions of casual users for attention. Every person on the platform is there for a specific startup-ecosystem purpose.\n\n**Conversation-first design**: Cleya\'s interface is built around facilitating actual conversations rather than passive connection accumulation. The platform tracks conversation quality, follow-through, and relationship development — not just connection count.',
      '## Side-by-Side Comparison\n\nHere is how the two platforms compare on dimensions that matter to Indian startup founders:\n\n- **Audience quality**: LinkedIn — broad, general professional audience, highly variable quality; Cleya.ai — curated startup ecosystem members, high signal\n- **Match relevance**: LinkedIn — keyword search only, no compatibility scoring; Cleya.ai — AI-powered multi-dimensional matching with compatibility scores\n- **Intro mechanism**: LinkedIn — cold connection requests, InMail (paid); Cleya.ai — warm, opt-in introductions with mutual context\n- **India-specific features**: LinkedIn — none; Cleya.ai — city-specific communities, India investor database, INR-denominated deal parameters\n- **Privacy**: LinkedIn — public profiles by default, limited control; Cleya.ai — members-only, both sides must opt in before contact information is shared\n- **Ideal use case**: LinkedIn — thought leadership, hiring, brand awareness, top-of-funnel discovery; Cleya.ai — fundraising introductions, co-founder search, high-signal deal flow',
      '## When to Use LinkedIn vs Cleya\n\nThe most nuanced answer is that you need both — but for different purposes.\n\nUse LinkedIn when you want to build a public profile, share your company\'s story, attract inbound interest from customers and candidates, and research potential partners. LinkedIn is your broadcast channel and your digital business card.\n\nUse Cleya.ai when you need a specific, high-value introduction — to a thesis-aligned investor, a potential co-founder with complementary skills, or an operator who has solved the exact problem you are facing. Cleya is your curated deal network.\n\nThe founders who get the most out of both platforms use LinkedIn to build awareness (posting insights, sharing milestones, engaging with the ecosystem publicly) and Cleya to convert that awareness into meaningful relationships and transactions.\n\nFor more on the mechanics of high-conversion introductions, read our [founder-investor warm intro guide](/blog/founder-investor-warm-intro-guide). For a deeper look at AI-powered matching technology, read [why AI matching is the future of professional networking](/blog/ai-matching-future-networking).',
      '## The Verdict\n\nYou need both LinkedIn and Cleya.ai, but for genuinely different things. LinkedIn builds your audience. Cleya.ai builds your network. Audience and network are not the same thing — one is passive attention, the other is active relationship capital that drives fundraising, partnerships, and hires.\n\nIf you are an Indian startup founder who has optimised LinkedIn but is still struggling to convert connections into real investor meetings and business outcomes, Cleya.ai addresses exactly the gap that LinkedIn was never designed to fill. [Explore Cleya\'s features](/features) or [sign up to get started](/?action=signup) — your first match is waiting.',
    ],
    relatedLinks: [
      { href: '/features', label: 'Cleya.ai Features Overview' },
      { href: '/blog/ai-matching-future-networking', label: 'Why AI Matching Is the Future of Networking' },
      { href: '/blog/founder-investor-warm-intro-guide', label: 'The Art of the Warm Intro' },
      { href: '/pricing', label: 'Cleya Pricing Plans' },
    ],
  },
  'vc-fund-thesis-india-2026': {
    title: 'How to Read a VC Fund Thesis (And Use It to Get Funded)',
    author: 'Priya Patel',
    authorRole: 'Head of Investor Relations, Cleya.ai',
    date: '2026-04-04',
    category: 'Fundraising',
    readTime: '10 min read',
    content: [
      'The biggest fundraising mistake founders make is pitching the wrong investor. Not a bad pitch. Not weak traction. The wrong investor. Research consistently shows that approximately 80% of cold pitches are rejected not because of product quality or team calibre, but because of fundamental misalignment with the investor\'s fund thesis. A seed-stage SaaS company pitching a growth-stage consumer fund will get rejected no matter how good the product is. A climate tech startup pitching a fintech-specialist angel will not land a meeting regardless of the market size. Learning to read and align with a VC\'s thesis is the single highest-leverage skill in fundraising — and it is almost never taught.',
      '## What Is a Fund Thesis?\n\nA fund thesis is the investment philosophy and strategic framework that governs which companies a VC fund will invest in. It is not just a preference — it is a commitment. When a fund raises capital from limited partners (LPs), those LPs are investing based on the fund\'s stated strategy. A fund that described itself to LPs as an "early-stage B2B SaaS fund focused on India" cannot easily justify investing in a late-stage D2C consumer brand. The thesis is a constraint as much as it is a conviction.\n\nA complete fund thesis typically covers:\n- **Stage**: What stage of company does the fund invest in? Pre-seed, seed, Series A, Series B, growth?\n- **Sector or vertical**: Which industries or technology categories does the fund focus on?\n- **Geography**: Pan-India, metro-focused, Tier-2 India, India plus Southeast Asia?\n- **Business model**: SaaS, marketplace, D2C, deep tech, infrastructure, consumer?\n- **Return expectations**: Different fund sizes have different return requirements. A $50M fund needs to find companies that can return 3-5x the fund. A $500M fund needs unicorns. This shapes how they think about market size and exit scenarios.\n- **Ownership targets**: Many funds have minimum ownership requirements (typically 10-20%) that constrain the cheque sizes they can write at different valuations.',
      '## How to Find a VC\'s Thesis\n\nMost funds publish their thesis — but you have to know where to look and how to read it. Here are the most reliable sources:\n\n**Fund website investment page**: Start here. Most serious VCs have an "About" or "Investments" page that describes their focus areas. Read it carefully and note what they emphasise — the language they use reveals what they care most about.\n\n**Portfolio pattern analysis**: This is the most reliable signal. Look at the last 20 investments a fund has made. What stage are the companies? What sectors? What geographies? What business models? Portfolio construction reveals the real thesis more accurately than any written statement, because it shows what the fund actually did rather than what they said they would do.\n\n**Partner interviews, podcasts, and articles**: Most active VC partners in India do regular media appearances, podcast interviews, and LinkedIn posts. These are invaluable for understanding how a partner thinks — what problems they find exciting, what business models they are sceptical of, what metrics they prioritise. Follow every partner whose fund you are targeting.\n\n**Fund announcement press releases**: When a fund announces a new investment, the press release often includes a quote from the investing partner explaining why they backed the company. Reading 10-15 of these quotes from a given partner reveals their decision-making framework clearly.\n\n**Crunchbase and Tracxn**: These databases allow you to filter a fund\'s portfolio by stage, sector, and date. Using them systematically will reveal patterns that manual research misses.',
      '## 5 Elements of a Typical VC Thesis\n\nWhen you are analysing a fund\'s thesis, look for alignment across these five dimensions:\n\n- **Stage**: This is the most important filter and the most commonly violated. If a fund primarily invests at Series A with checks of $3-8M, approaching them with a pre-revenue idea is a waste of everyone\'s time. Match your stage to their stage first, before anything else.\n- **Sector and vertical**: Most funds have explicit sector preferences. Some are generalist (any sector, any business model), but the majority have at least 2-3 verticals where they have deep expertise and active deal flow. Being in their sweet spot dramatically increases engagement.\n- **Geography**: India is not one market. Some funds are Bangalore-centric; others have explicit Bharat (Tier-2 and Tier-3 India) theses. Some funds require companies to be headquartered in a specific city. Geography misalignment is often invisible until you are deep in diligence.\n- **Business model**: SaaS, marketplace, D2C, and deep tech require fundamentally different analytical frameworks, and most funds have developed conviction in specific models over time. A fund that has made 15 SaaS investments will apply a SaaS mental model to your marketplace pitch — and it will not fit cleanly.\n- **Return expectations and check size**: This is the often-overlooked structural dimension. A fund\'s check size range, ownership requirements, and return targets are all functions of the fund\'s overall size and LP commitments. Make sure your raise size and current valuation can accommodate the investor\'s ownership requirements.',
      '## Indian VC Thesis Examples\n\nLet\'s look at five specific Indian fund theses to illustrate how these elements work in practice:\n\n**Sequoia Surge**: Surge is Peak XV\'s early-stage accelerator-investment programme. Their thesis is: extraordinary founders with global ambition, at the pre-seed and seed stage, across any sector. The "global ambition" component is key — Surge is not primarily interested in India-only plays. If your company can become a global category leader, Surge is relevant regardless of sector.\n\n**Blume Ventures**: Blume\'s thesis has evolved but centres on deep tech, B2B SaaS, and India-specific consumer models at the seed stage. They are explicitly founder-focused and patient — they hold companies for longer than most Indian VCs and double down on breakouts. Their thesis emphasises technical moats and defensible technology advantages.\n\n**3one4 Capital**: 3one4 has one of the clearest and most distinctive theses in India — they invest in companies building category leadership in large Indian markets, with a particular focus on "Bharat" (the mass-market India opportunity beyond the top eight cities). Their portfolio reflects this: DarwinBox (HR SaaS for Indian enterprises), Licious (D2C protein brand for mass market), Fasal (agri-tech for Indian farmers).\n\n**Lightspeed India**: Lightspeed invests at seed through Series B across consumer internet and enterprise software. Their global network is a key differentiator — portfolio companies get access to Lightspeed\'s relationships in the US, Southeast Asia, and China. If your company has global expansion ambitions, Lightspeed\'s cross-border thesis is highly relevant.\n\n**Antler India**: Antler\'s thesis is unique — they invest at the pre-product stage, sometimes even pre-idea, in founders they believe are exceptional. They run cohort-based programmes where founders meet potential co-founders and develop their ideas together. If you are a strong individual looking for a co-founder and early capital simultaneously, Antler\'s model is specifically designed for that.',
      '## Aligning Your Pitch to the Thesis\n\nOnce you have mapped a fund\'s thesis clearly, the goal is not to reshape your company to fit their thesis — that is dishonest and usually transparent. The goal is to tell your story through the lens of what they care about.\n\n**Customise your narrative, not your company**: If you are pitching a B2B SaaS fund, lead with ARR, NRR, CAC payback, and gross margin. If you are pitching a consumer-focused fund, lead with MAU growth, retention cohorts, and brand NPS. The same underlying business can be presented through multiple lenses.\n\n**Map your market to their return model**: A $100M fund needs at least 3-5x returns, which means they need companies that can reach $500M+ exit values. Show explicitly why your market is large enough to justify that outcome.\n\n**The one-page thesis-alignment doc**: Before requesting any introduction to a specific investor, create a one-page document that maps your company explicitly to their thesis — stage, sector, geography, business model, and return potential. Include two or three of their portfolio companies that are adjacent (not directly competing) and explain why your company fits in the same portfolio. Connectors who agree to introduce you will often use this document directly.',
      '## When Thesis Does Not Match\n\nThis is the lesson most founders learn late and at high cost: do not try to convince a fund to invest outside their thesis. You will almost never succeed, and the process will cost you months of time and enormous emotional energy.\n\nIf a fund\'s thesis does not match your company at this moment, move on. It does not mean your company is bad — it means there is a structural mismatch. Thank them, stay in touch for future rounds when the fit might be better, and direct your energy toward investors whose thesis is genuinely aligned.\n\nThe single most effective way to find thesis-aligned investors efficiently is through warm introductions from people who know both you and the investor well. A warm intro from a portfolio founder to a GP is worth more than the best cold email you will ever write. Platforms like [Cleya.ai](/features) pre-filter by thesis alignment before making introductions, which means every conversation you have through Cleya starts from a place of genuine fit.',
      '## Using Warm Intros to Reach Thesis-Aligned Investors\n\nThe combination of thesis alignment research and warm introductions is the formula that closes rounds efficiently. Once you have identified the 15-20 investors whose thesis aligns with your company, your goal is to find a warm path to each of them.\n\nStart with your existing network: angels you have worked with, advisors, portfolio founders from relevant funds. Then expand through platforms and communities built for this purpose. [Cleya.ai](/features) is specifically designed to surface these warm paths — the AI matching engine identifies not just which investors are relevant to your stage and sector, but who in your extended network can make a credible introduction.\n\nFor more on executing warm intros effectively, read our [founder-investor warm intro guide](/blog/founder-investor-warm-intro-guide). For a curated list of active angel investors in Indian fintech, see our [top angel investors in Indian fintech](/blog/top-angel-investors-india-fintech) post.\n\nMastering VC thesis alignment is not glamorous, but it is one of the most reliable predictors of fundraising efficiency. Founders who do this work consistently reach funded rounds faster, with fewer rejection cycles, and with more investor-alignment post-investment. Start with the five funds whose thesis most closely matches your company today, build warm paths to each, and tailor your narrative to what each fund actually cares about. The round you need is accessible — the question is whether you are approaching it with the right map. [Start finding thesis-aligned connections on Cleya](/features) or read our complete guide on [how to raise seed funding in India in 2026](/blog/how-to-raise-seed-funding-india-2026).',
    ],
    relatedLinks: [
      { href: '/blog/how-to-raise-seed-funding-india-2026', label: 'How to Raise Seed Funding in India 2026' },
      { href: '/blog/top-angel-investors-india-fintech', label: 'Top 50 Angel Investors in Indian Fintech' },
      { href: '/blog/founder-investor-warm-intro-guide', label: 'The Art of the Warm Intro' },
      { href: '/features', label: 'Cleya AI Matching Features' },
    ],
  },
};

export default function BlogPostClient() {
  const params = useParams();
  const slug = params.slug as string;
  const post = blogPosts[slug];

  if (!post) {
    return (
      <AppShell className="flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold gradient-text mb-4">Post Not Found</h1>
          <Link href="/blog" className="px-6 py-3 rounded-xl text-white font-medium text-sm cta-shimmer" style={{ background: '#3B82F6' }}>
            Back to Blog
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell className="font-sans">
      <PublicNav />

      <article className="max-w-3xl mx-auto px-6 lg:px-8 py-12">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
            <li><Link href="/" className="hover:text-white transition">Home</Link></li>
            <li>/</li>
            <li><Link href="/blog" className="hover:text-white transition">Blog</Link></li>
            <li>/</li>
            <li className="text-white/60 truncate max-w-[200px]">{post.title}</li>
          </ol>
        </nav>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
              style={{ background: '#3B82F6' }}>
              {post.category}
            </span>
            <span className="text-xs" style={{ color: '#64748B' }}>{post.readTime}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-6">{post.title}</h1>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: 'rgba(59,130,246,0.15)', color: '#93C5FD' }}>
              {post.author[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{post.author}</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                {post.authorRole} · {new Date(post.date).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-6">
          {post.content.map((block, i) => {
            if (block.startsWith('## ')) {
              const lines = block.split('\n');
              const heading = lines[0].replace('## ', '');
              const body = lines.slice(1).join('\n').trim();
              return (
                <div key={i}>
                  <h2 className="text-xl font-bold text-white mt-8 mb-3">{heading}</h2>
                  {body.split('\n').filter(Boolean).map((line, j) => {
                    // Parse inline links [text](/url)
                    const parts = line.split(/(\[[^\]]+\]\([^)]+\))/g);
                    const rendered = parts.map((part, k) => {
                      const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
                      if (linkMatch) {
                        return (
                          <Link key={k} href={linkMatch[2]} className="underline decoration-blue-400/40 hover:decoration-blue-400 transition" style={{ color: '#93C5FD' }}>
                            {linkMatch[1]}
                          </Link>
                        );
                      }
                      return <span key={k}>{part}</span>;
                    });

                    return (
                      <p key={j} className="text-sm leading-relaxed mb-3" style={{ color: '#CBD5E1' }}>
                        {line.startsWith('- ') ? (
                          <span className="flex items-start gap-2">
                            <span style={{ color: '#3B82F6' }}>•</span>
                            <span>{rendered}</span>
                          </span>
                        ) : rendered}
                      </p>
                    );
                  })}
                </div>
              );
            }
            // Parse inline links in regular paragraphs too
            const parts = block.split(/(\[[^\]]+\]\([^)]+\))/g);
            const rendered = parts.map((part, k) => {
              const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
              if (linkMatch) {
                return (
                  <Link key={k} href={linkMatch[2]} className="underline decoration-blue-400/40 hover:decoration-blue-400 transition" style={{ color: '#93C5FD' }}>
                    {linkMatch[1]}
                  </Link>
                );
              }
              return <span key={k}>{part}</span>;
            });
            return (
              <p key={i} className="text-sm leading-relaxed" style={{ color: '#CBD5E1' }}>{rendered}</p>
            );
          })}
        </div>

        {/* Related Articles */}
        {post.relatedLinks && post.relatedLinks.length > 0 && (
          <div className="mt-12 rounded-2xl border border-white/5 p-6" style={{ background: 'rgba(10,10,26,0.8)' }}>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4">Related Reading</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {post.relatedLinks.map((link, i) => (
                <Link key={i} href={link.href}
                  className="text-sm font-medium hover:text-blue-200 transition flex items-center gap-2"
                  style={{ color: '#93C5FD' }}>
                  <span>→</span> {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-blue-500/15 p-6" style={{ background: 'rgba(59,130,246,0.06)' }}>
          <h3 className="text-lg font-semibold text-white mb-2">Ready to put these insights into action?</h3>
          <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>
            Join Cleya.ai and connect with the right investors, founders, and operators for your startup.
          </p>
          <Link href="/?action=signup"
            className="inline-block px-6 py-3 rounded-xl text-white font-medium text-sm transition hover:scale-[1.02]"
            style={{ background: '#3B82F6' }}>
            Get Started Free →
          </Link>
        </div>
      </article>
    </AppShell>
  );
}
