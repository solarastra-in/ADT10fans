import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  FileText, 
  DollarSign, 
  Globe, 
  Presentation, 
  TrendingUp, 
  CheckCircle2, 
  Copy, 
  Printer, 
  Sparkles, 
  Trophy, 
  Users, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Flame, 
  Share2, 
  Gift, 
  MessageSquare, 
  Sliders, 
  ExternalLink, 
  ChevronRight,
  ChevronLeft,
  Download,
  Info,
  Settings
} from 'lucide-react';

interface LeagueProposalViewProps {
  onNavigateToForum?: () => void;
  onNavigateToContests?: () => void;
  onNavigateToSocial?: () => void;
  onNavigateToDraws?: () => void;
  onNavigateToFanSpaces?: () => void;
  onNavigateToGrowth?: () => void;
  onOpenAdmin?: () => void;
  isAdmin?: boolean;
}

// Exchange rate fixed peg: 1 USD = 3.6725 AED
const USD_TO_AED = 3.6725;

interface ActivityItem {
  id: string;
  number: number;
  title: string;
  tag: string;
  need: string;
  relevance: string;
  what: string;
  usdCost: number;
  aedCost: number;
  capexUsd: number;
  opexUsd: number;
  timeline: string;
  outcome: string;
  kpis: string[];
  franchiseBenefit: string;
  leagueBenefit: string;
}

const ACTIVITIES: ActivityItem[] = [
  {
    id: 'activity-web',
    number: 1,
    title: 'Centralized League & Franchise Fan Web Platform & PWA',
    tag: 'Digital Core',
    need: 'Current league and franchise web presence is fragmented across temporary event micro-sites, leading to an 87% fan drop-off between annual 2-week tournament cycles. Fans have no single persistent home for live scores, squads, tickets, and team engagement.',
    relevance: 'T10’s 90-minute format is the most fast-paced, digital-native spectacle in sports. Digital-first Gen-Z audiences expect instant load times, live ball-by-ball simulated telemetry, mobile responsiveness, and continuous 365-day access.',
    what: 'Build and deploy a unified official Abu Dhabi T10 League & 6-Franchise web ecosystem as a Progressive Web App (PWA). Includes automated match schedules, real-time ball-by-ball live tickers, dynamic player & squad dossiers, unified ticketing portal, and automated multilingual content feeds.',
    usdCost: 165000,
    aedCost: Math.round(165000 * USD_TO_AED),
    capexUsd: 110000,
    opexUsd: 55000,
    timeline: 'Months 1-3 (Launch before Season Opener)',
    outcome: 'A world-class digital flagship delivering sub-second load times globally, capturing 750,000+ registered fan accounts in Year 1, and establishing a unified first-party fan data pipeline (CDP).',
    kpis: ['750K+ Registered Users', '4.2M Monthly Page Views', '4.8m Avg Session Duration', 'Sub-800ms Global PWA Latency'],
    franchiseBenefit: 'Direct branded digital home for Arabian Aces and all 8 partner franchises with dedicated sponsor inventory.',
    leagueBenefit: 'Full ownership of first-party fan customer data, increasing media rights valuation by 25%.'
  },
  {
    id: 'activity-forum',
    number: 2,
    title: 'Community Discussion Forum & Real-Time Discourse Engine',
    tag: 'Fan Community',
    need: 'Cricket fans express their passion through passionate tactical debate, match reviews, and player rivalries. In the absence of an official moderated league forum, discussions scatter across Reddit, generic social media, or vanish entirely.',
    relevance: 'Fostering fan community discourse transforms passive broadcast viewers into emotionally invested league brand advocates. Fans build friendships, rivalries, and community identity around franchises.',
    what: 'Deploy an integrated, high-performance community forum where fans can open new discussion threads, post comments, upvote analysis, debate tactical lineups, tag specific franchises, and earn fan points and badges for insightful contributions.',
    usdCost: 45000,
    aedCost: Math.round(45000 * USD_TO_AED),
    capexUsd: 25000,
    opexUsd: 20000,
    timeline: 'Months 2-4 (Pre-Season Buzz & Tourney Active)',
    outcome: 'An active 24/7 fan dialogue hub generating over 65,000 organic discussion threads and 250,000 fan comments per season, driving peer-to-peer viral engagement.',
    kpis: ['65K+ Discussion Threads', '250K+ Community Comments', '38% Monthly Retention Uplift', 'Zero Toxicity via AI Auto-Moderation'],
    franchiseBenefit: 'Exclusive franchise-only fan sub-forums enabling direct team-to-fan Q&As with coaches and players.',
    leagueBenefit: 'Continuous real-time fan sentiment intelligence informing tournament rules and match timings.'
  },
  {
    id: 'activity-competitions',
    number: 3,
    title: 'Gamification Suite: Match Predictors, Trivia & Daily Streaks',
    tag: 'Engagement & Retention',
    need: 'Broadcast sports face a critical battle against short attention spans. Without gamified incentives, fans multi-task on competing entertainment apps during overs and innings breaks.',
    relevance: 'The T10 format generates boundaries on average every 3.2 deliveries, creating frequent high-intensity micro-events ideal for second-screen prediction challenges and boundary betting contests.',
    what: 'A dynamic gamification engine featuring ball-by-ball & match prediction contests, boundary over/under challenges, historical T10 trivia battles, daily check-in streak multipliers (up to 5x), and seasonal fan leaderboards.',
    usdCost: 55000,
    aedCost: Math.round(55000 * USD_TO_AED),
    capexUsd: 35000,
    opexUsd: 20000,
    timeline: 'Months 2-3 (Pre-Season Launch)',
    outcome: 'Triple daily active usage (DAU) across match days, with 60%+ of active users making at least 3 predictions per match, generating 3.5M prediction interactions per tournament.',
    kpis: ['62% Matchday Participation Rate', '3.5M Total Predictions Logged', '45% 7-Day Daily Streak Retention', 'Sponsored Predictor Partner Packages'],
    franchiseBenefit: 'Franchise Fan Wars leaderboard where fan contest points directly elevate their supported team ranking.',
    leagueBenefit: 'Premium commercial inventory: Title sponsorship of Predictor Challenge sold to fintech/telecom partners.'
  },
  {
    id: 'activity-dreamteam',
    number: 4,
    title: '“Dream Team” (Fantasy 10) Squad Architect & Private Leagues',
    tag: 'Fantasy Sports',
    need: 'Fantasy cricket is the #1 driver of deep player familiarity and match viewership worldwide. Traditional fantasy formats take hours; T10 requires a fast, 90-minute optimized 6-player draft.',
    relevance: 'Fans who play fantasy cricket watch 2.4x more overs on television and OTT platforms to monitor their fantasy captain and drafted bowlers in real time.',
    what: 'Build a proprietary "Fantasy 10" squad builder: fans draft a 6-player squad under a strict 55-credit cap, assign a captain (2x multiplier), compete in private friends leagues, and win official franchise rewards.',
    usdCost: 65000,
    aedCost: Math.round(65000 * USD_TO_AED),
    capexUsd: 45000,
    opexUsd: 20000,
    timeline: 'Months 2-4 (Integrated with Live Data Feed)',
    outcome: '300,000+ created Fantasy 10 lineups per season, driving measurable 40%+ increases in linear and digital broadcast watch-time per registered fan.',
    kpis: ['300K+ Fantasy Lineups Created', '12K+ Private Fan Leagues Formed', '2.4x Increase in Broadcast Watch Time', 'Monetized Co-Branded Fantasy Title Sponsor'],
    franchiseBenefit: 'Heightened fan loyalty to individual franchise players (e.g. Moeen Ali, Alex Hales, Nicholas Pooran).',
    leagueBenefit: 'Direct commercial partnership opportunity with global gaming, telecom, or payment partners.'
  },
  {
    id: 'activity-giveaways',
    number: 5,
    title: 'Provably Fair VIP Giveaways & Enclosure Hospitality Passes',
    tag: 'VIP Rewards',
    need: 'Traditional sports sweepstakes are often perceived by fans as non-transparent, untrustworthy, or rigged for influencers, dampening contest participation.',
    relevance: 'Abu Dhabi is globally renowned for luxury, hospitality, and cutting-edge tech. Demonstrating transparent, provably fair mechanics builds profound credibility and aspiration.',
    what: 'A cryptographic SHA-256 verifiable prize draw system offering once-in-a-lifetime experiences: President Box VIP hospitality tickets at Zayed Cricket Stadium, player dugout walks, signed bats, and official team merchandise.',
    usdCost: 120000,
    aedCost: Math.round(120000 * USD_TO_AED),
    capexUsd: 20000,
    opexUsd: 100000, // Hospitality allocation, tickets, flights & authentic signed merchandise
    timeline: 'Throughout Season & Pre-Tournament',
    outcome: 'Unrivaled fan excitement and viral social sharing, capturing 150,000+ verified giveaway entries and cultivating deep emotional loyalty to Abu Dhabi as the destination of cricket.',
    kpis: ['150K+ Verified Draw Entrants', '100% Cryptographic Audit Trail', '50+ VIP Hospitality Winners Hosted', 'Over 80K User Generated Social Shares'],
    franchiseBenefit: 'Franchises receive allocated VIP dugout guest slots for their top community Superfans.',
    leagueBenefit: 'Positions Abu Dhabi T10 as the most generous and transparent fan-centric league in international sports.'
  },
  {
    id: 'activity-livecenter',
    number: 6,
    title: 'Unified Multi-Team Live Center, Telemetry & Watch Aggregator',
    tag: 'Broadcast Hub',
    need: 'Fans cannot always access linear television feeds across different international broadcast jurisdictions, leading to frustration and pirated illicit streams.',
    relevance: 'Providing a verified centralized hub for ball-by-ball simulated telemetry, official YouTube live press conferences, and synchronized watch parties bridges the broadcast gap.',
    what: 'A centralized multi-match live center embedding official YouTube live streams, pre-match press conferences, player dugout cams, real-time ball-by-ball radar charts, wagon wheels, and live match simulation triggers.',
    usdCost: 60000,
    aedCost: Math.round(60000 * USD_TO_AED),
    capexUsd: 35000,
    opexUsd: 25000,
    timeline: 'Months 2-3 (Live for all 34 tournament fixtures)',
    outcome: '12M+ live telemetry impressions, keeping international fans tethered to the match state even when on mobile or without a TV screen.',
    kpis: ['12M+ Live Scorecard Interactions', '99.98% Telemetry Uptime', 'Over 1.8M YouTube Watch Party Embed Views', 'Real-time Sub-Second Latency'],
    franchiseBenefit: 'Franchises can broadcast team training and behind-the-scenes warmups directly to their fans.',
    leagueBenefit: 'Increases official digital video consumption metrics for OTT and broadcast pitch decks.'
  },
  {
    id: 'activity-socialcurator',
    number: 7,
    title: 'Consolidated Team Social Wall & Cross-Franchise Curator',
    tag: 'Media Aggregator',
    need: 'Fans currently must follow 9 separate Twitter/X accounts, 9 Instagram pages, and 9 YouTube channels, causing fragmented information discovery.',
    relevance: 'Aggregating verified official posts into a singular, high-octane social wall creates a unified "league energy" and lets fans compare teams side-by-side.',
    what: 'Deploy a Curator.io-style multi-platform social aggregator crawling verified team handles across X, Instagram, TikTok, YouTube, Threads, and RSS feeds with auto-curation and admin verification safeguards.',
    usdCost: 35000,
    aedCost: Math.round(35000 * USD_TO_AED),
    capexUsd: 15000,
    opexUsd: 20000,
    timeline: 'Month 1 (Immediate Deployment)',
    outcome: 'One-stop social destination delivering 25,000+ curated multimedia impressions daily, boosting cross-pollination across franchise fanbases.',
    kpis: ['Top 5 Verified Posts / Platform / Team', 'Real-Time Synchronized Feed Updates', '15K Daily Social Wall Views', 'Brand Safety Filter Enforced'],
    franchiseBenefit: 'Smaller or newer franchises gain direct exposure to the collective league fanbase.',
    leagueBenefit: 'Reinforces the ADT10 brand identity as a cohesive international powerhouse.'
  },
  {
    id: 'activity-fanspaces',
    number: 8,
    title: 'Global Physical Fan Spaces & Experiential Clubhouses',
    tag: 'Physical Experiential',
    need: 'Over 80% of ADT10 fans live outside Abu Dhabi (in India, UK, Pakistan, Canada, and the GCC). A tournament restricted solely to the stadium pitch in Abu Dhabi misses the massive global diaspora craving communal match experiences.',
    relevance: 'Sports entertainment brands like the NBA, Premier League, and Formula 1 thrive by building physical experiential lounges in premier metropolitan hubs, creating physical touchpoints that drive merchandise and lifelong fan loyalty.',
    what: 'Design, launch, and operate 5 flagship & pop-up physical "ADT10 Global Fan Clubhouses" in key cricket capital cities: 1) Abu Dhabi (Yas Island / Zayed Stadium precinct), 2) Dubai (Marina / Downtown), 3) London (Regent St / Lord’s precinct pop-up), 4) Mumbai (Bandra Kurla Complex), and 5) Toronto (Brampton / Mississauga). Features include: 360-degree high-definition LED match watch arena, VR Batting Simulator cages against 140km/h T10 bowling, official franchise pop-up merchandise retail, Arabic hospitality barista lounge, and live meetups with team ambassadors & cricket legends.',
    usdCost: 480000,
    aedCost: Math.round(480000 * USD_TO_AED),
    capexUsd: 320000, // AV hardware, LED screens, VR equipment, fit-out, branding
    opexUsd: 160000, // Venue leasing, event staffing, security, logistics, F&B
    timeline: 'Phased: Abu Dhabi & Dubai (Season 1), London, Mumbai & Toronto (Season 1 Finals & Year 2)',
    outcome: '45,000+ in-person visitors during the tournament cycle, generating $320,000 in official merchandise & F&B sales, and commanding massive local media coverage in the UK, India, UAE, and North America.',
    kpis: ['45K+ In-Person Attendees Across 5 Cities', '15K+ VR Batting Cages Experiences', '$320K+ Direct Retail Merchandise Revenue', 'Over 120 Local Media News Features'],
    franchiseBenefit: 'Direct physical merchandise sales booths for Arabian Aces and all franchise teams in London and Mumbai.',
    leagueBenefit: 'Elevates ADT10 into a physical global lifestyle and sports brand competing directly with F1 and NBA global lounges.'
  },
  {
    id: 'activity-nextgen',
    number: 9,
    title: 'Next-Gen Growth Catalysts: Grassroots Youth Cup & Creator Studio',
    tag: 'Future Growth',
    need: 'Building sustainable multi-generational fan bases requires reaching younger demographics (ages 12-24) through school participation and digital native influencers.',
    relevance: 'Cricket fandom is passed down through youth play and creator culture. Twitch, YouTube, and TikTok content creators drive 60%+ of youth sports discovery.',
    what: 'Launch two high-impact growth programs: 1) "ADT10 School & Grassroots Cup" in UAE and UK schools with 10-over tape-ball tournaments awarding youth cricket equipment and stadium tickets. 2) "ADT10 Global Creator Studio", partnering with 50 top cricket YouTubers & streamers for live watch-along broadcasts and viral trick-shot challenges.',
    usdCost: 140000,
    aedCost: Math.round(140000 * USD_TO_AED),
    capexUsd: 40000,
    opexUsd: 100000,
    timeline: 'Months 3-6 (Rolling Campaign)',
    outcome: 'Direct engagement of 120+ schools, 25,000+ student participants, and 45M+ cross-platform views via creator watch-alongs.',
    kpis: ['120+ Participating Schools & Academies', '50+ Creator Studio Influencers', '45M+ Creator Watch-Along Views', '15K+ New Youth Fan Registrations'],
    franchiseBenefit: 'Scouting pipeline of emerging local UAE and international youth talent for developmental squad slots.',
    leagueBenefit: 'Establishes authentic goodwill, CSR community impact, and deep brand resonance with future generations.'
  }
];

export const LeagueProposalView: React.FC<LeagueProposalViewProps> = ({
  onNavigateToForum,
  onNavigateToContests,
  onNavigateToSocial,
  onNavigateToDraws,
  onNavigateToFanSpaces,
  onNavigateToGrowth,
  onOpenAdmin,
  isAdmin
}) => {
  const [activeProposalTab, setActiveProposalTab] = useState<'document' | 'budget' | 'fanspaces' | 'deck' | 'roi'>('document');
  const [currency, setCurrency] = useState<'USD' | 'AED'>('USD');
  const [copiedToast, setCopiedToast] = useState(false);
  const [activitiesList, setActivitiesList] = useState<ActivityItem[]>(ACTIVITIES);
  const [exchangeRate, setExchangeRate] = useState<number>(USD_TO_AED);
  const [revenueStreams, setRevenueStreams] = useState<any>({
    predictorSponsorshipUsd: 450000,
    fantasySponsorshipUsd: 350000,
    fanSpacesNamingRightsUsd: 650000,
    merchAndFbUsd: 370000,
    superfanPassportUsers: 38000,
    superfanPassportFeeUsd: 10
  });

  // Load dynamically configured proposal settings from Admin
  useEffect(() => {
    api.getProposalSettings().then(res => {
      if (res.proposalSettings) {
        if (res.proposalSettings.activities && res.proposalSettings.activities.length > 0) {
          setActivitiesList(res.proposalSettings.activities);
        }
        if (res.proposalSettings.exchangeRateUsdToAed) {
          setExchangeRate(res.proposalSettings.exchangeRateUsdToAed);
        }
        if (res.proposalSettings.revenueStreams) {
          setRevenueStreams(res.proposalSettings.revenueStreams);
        }
      }
    }).catch(err => {
      console.warn('Using baseline proposal settings:', err);
    });
  }, []);
  
  // Interactive Simulator variables
  const [simFanSpaces, setSimFanSpaces] = useState(5);
  const [simMarketingSpend, setSimMarketingSpend] = useState(140000);
  const [simPrizeBudget, setSimPrizeBudget] = useState(120000);

  // Calculate base total budget from dynamic activities list
  const baseTotalUsd = activitiesList.reduce((acc, act) => acc + act.usdCost, 0);
  const baseTotalAed = activitiesList.reduce((acc, act) => acc + (act.aedCost || Math.round(act.usdCost * exchangeRate)), 0);

  // Dynamic Simulator calculation
  const fanSpaceCostPerUnit = 96000; // ~$480k for 5 spaces = $96k avg per space
  const simTotalUsd = 
    (baseTotalUsd - 480000 - 140000 - 120000) + 
    (simFanSpaces * fanSpaceCostPerUnit) + 
    simMarketingSpend + 
    simPrizeBudget;
  const simTotalAed = Math.round(simTotalUsd * exchangeRate);

  // Projected Revenues from configured revenue streams
  const totalSponsorBaseline = (revenueStreams.predictorSponsorshipUsd || 450000) + (revenueStreams.fantasySponsorshipUsd || 350000) + (revenueStreams.fanSpacesNamingRightsUsd || 650000);
  const projSponsorRevUsd = totalSponsorBaseline + ((simFanSpaces - 5) * 80000);
  const projMerchRevUsd = (revenueStreams.merchAndFbUsd || 370000) * (simFanSpaces / 5);
  const projMembershipRevUsd = (revenueStreams.superfanPassportUsers || 38000) * (revenueStreams.superfanPassportFeeUsd || 10);
  const projTotalRevUsd = projSponsorRevUsd + projMerchRevUsd + projMembershipRevUsd;
  const projNetProfitUsd = projTotalRevUsd - simTotalUsd;
  const projRoiPercent = Math.round((projNetProfitUsd / simTotalUsd) * 100);

  // Deck slide navigation
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: 'Executive Vision: The 365-Day Global T10 Era',
      subtitle: 'From a 2-Week Tournament into a Multi-Million Fan Entertainment Empire',
      bullets: [
        'T10 has conquered the 90-minute cricket format; the next frontier is building year-round global fan equity.',
        'Current off-season attrition exceeds 87% due to the lack of an integrated digital ecosystem.',
        'This proposal presents a turnkey, 8-pillar strategy combining a unified digital fan portal, community forums, gamification, and physical fan clubhouses in key global diaspora cities.',
        'Total Investment: $1,150,000 USD (AED 4,223,000) generating projected Year 1 Gross Revenues of $2,400,000+ (+108% Net ROI).'
      ],
      tag: 'Strategic Summary'
    },
    {
      title: 'The Core Strategic Need & Attention Economy',
      subtitle: 'Why the League Must Unify its 6 Franchise Audiences Today',
      bullets: [
        'Attention Economy Competition: Gen-Z audiences demand micro-content, instant gamification, and second-screen interactivity.',
        'The Silo Dilemma: Disparate franchise social accounts create noise rather than collective gravity.',
        'The Geographic Void: 80%+ of viewers reside outside Abu Dhabi (India, UK, North America, Pakistan, GCC) with zero physical engagement touchpoints.',
        'Sponsorship Under-Monetization: Without a unified digital first-party audience (CDP), sponsors only buy static stadium hoardings rather than year-round digital activations.'
      ],
      tag: 'Market Analysis'
    },
    {
      title: 'Pillars 1 to 3: The Digital Fan Foundation',
      subtitle: 'Portal, Community Forums & Second-Screen Gamification',
      bullets: [
        'Activity 1: Official League & Franchise Web PWA with sub-second live scores, player profiles, and ticketing.',
        'Activity 2: Discussion Forum enabling fans to open threads, debate squad selection, and earn fan points (+15 / +5 pts).',
        'Activity 3: Second-Screen Predictor Suite with match predictions, boundary over/under, and daily check-in streaks.',
        'Target: 750,000+ registered fan accounts in Year 1 with 4.8-minute average session durations.'
      ],
      tag: 'Digital Core'
    },
    {
      title: 'Pillars 4 to 6: Fantasy, VIP Draws & Broadcast Center',
      subtitle: 'Dream Team, Cryptographic Hospitality & Unified Streams',
      bullets: [
        'Activity 4: "Fantasy 10" 6-player squad architect under 55 credits with private leagues driving 2.4x television watch-time.',
        'Activity 5: Provably Fair Giveaways using SHA-256 cryptographic seeds for President Box VIP passes and dugout walks.',
        'Activity 6: Unified Multi-Team Live Center with ball-by-ball simulated telemetry and YouTube stream integration.',
        'Outcome: High fan trust, viral word-of-mouth, and over 150,000 verified giveaway entrants.'
      ],
      tag: 'Engagement Engine'
    },
    {
      title: 'Pillar 7 & 8: Global Physical Fan Spaces',
      subtitle: 'Experiential Clubhouses in Abu Dhabi, Dubai, London, Mumbai & Toronto',
      bullets: [
        'Physical Experiential Network: Flagship Clubhouses in Abu Dhabi & Dubai + High-Impact Pop-ups in London, Mumbai, and Toronto.',
        'Venue Features: 360-degree LED screening arena, VR Batting Simulator cages against 140km/h bowling, official merchandise pop-up, Arabic hospitality lounge.',
        'Economic Impact: 45,000+ in-person visitors during the tournament cycle, generating $320,000 in official merchandise and F&B sales.',
        'Transforms ADT10 into a premium international lifestyle and entertainment franchise.'
      ],
      tag: 'Global Presence'
    },
    {
      title: 'Pillar 9: Next-Gen Growth Catalysts',
      subtitle: 'Grassroots School Cup, Creator Streamers & AI Audio',
      bullets: [
        'Grassroots Youth T10 Cup: Engaging 120+ UAE and UK schools with 10-over tournaments awarding stadium tickets and youth kits.',
        'Global Creator Studio: 50+ cricket & gaming YouTubers/streamers hosting live watch-along broadcasts reaching 45M+ views.',
        'Multi-Lingual AI Audio: Localized commentary feeds in Arabic, English, Hindi, Urdu, and Bengali.',
        'Superfan Passport: Tiered digital memberships offering ticket discounts, priority fan space entry, and collector badges.'
      ],
      tag: 'Innovation & Youth'
    },
    {
      title: 'Budget Allocation: Transparent Activity Breakdown',
      subtitle: 'Total Budget: $1,150,000 USD (AED 4,223,000) with Balanced CapEx & OpEx',
      bullets: [
        'Platform Engineering & PWA Infrastructure: $165,000 / AED 606,000',
        'Discussion Forum & Community Engine: $45,000 / AED 165,000',
        'Gamification & Dream Team Engine: $120,000 / AED 440,000',
        'VIP Giveaways & Hospitality Fulfillment: $120,000 / AED 440,000',
        'Live Center & Social Curator: $95,000 / AED 349,000',
        'Global Physical Fan Spaces (5 Hubs): $480,000 / AED 1,763,000',
        'Grassroots Cup & Creator Marketing: $140,000 / AED 514,000'
      ],
      tag: 'Financial Allocation'
    },
    {
      title: 'Financial Monetization & Projected Return on Investment',
      subtitle: 'How the Fan Base Investment Pays for Itself (+108% Year 1 ROI)',
      bullets: [
        'Projected Gross Revenue: $2,400,000 USD (AED 8,814,000) against $1,150,000 expenditure.',
        'Commercial Title & Digital Category Sponsors: $1,450,000 (Predictor title, Fantasy title, Fan Space naming rights).',
        'Physical Fan Spaces Merchandising & Hospitality F&B: $370,000.',
        'Superfan Digital Passports & Ticketing Commissions: $380,000.',
        'Estimated Net Profit Contribution to League: $1,250,000 USD (AED 4,591,000) in Year 1.'
      ],
      tag: 'Commercial ROI'
    },
    {
      title: 'Phased Execution Roadmap: 2026-2027',
      subtitle: 'Seamless 3-Stage Delivery Leading up to the Abu Dhabi T10 Season',
      bullets: [
        'Phase 1 (Months 1-3): Platform Launch, Discussion Forum, Social Curator, Predictor Suite, Abu Dhabi Flagship & Dubai Spaces.',
        'Phase 2 (Months 4-5): Tournament Execution, Live Watch Parties, London & Mumbai Pop-ups, Creator Streamer Studio.',
        'Phase 3 (Months 6-12): Year-round Fan Retention, Grassroots School Cup Finals, Expansion to Toronto & Melbourne, Sponsor Renewals.',
        'Governance: Bi-weekly League Oversight Committee reports with real-time analytics dashboard.'
      ],
      tag: 'Implementation'
    },
    {
      title: 'Recommendation & Next Steps for the ADT10 Board',
      subtitle: 'Immediate Approval to Secure First-Mover Advantage in Fast-Format Cricket',
      bullets: [
        'Adopt the 8-Pillar Fan Strategy as the official Abu Dhabi T10 League fan development mandate.',
        'Authorize Phase 1 CapEx release ($585,000 USD / AED 2,148,000) to commence digital build and UAE venue lease agreements.',
        'Empower the joint Arabian Aces & ADT10 Fan Taskforce to begin onboarding international commercial partners.',
        'Lock in dates for the Global Fan Clubhouse launches in Abu Dhabi, Dubai, London, and Mumbai.'
      ],
      tag: 'Action Required'
    }
  ];

  const handleCopySummary = () => {
    const summary = `
=====================================================
ABU DHABI T10 LEAGUE: STRATEGIC FAN EXPANSION PROPOSAL
365-Day Global Fan Ecosystem & Physical Experiential Network
Submitted to: ADT10 Governing Council & Franchise Board
=====================================================

1. THE NEED:
- Traditional cricket leagues suffer from an 87% off-season engagement drop.
- 6 franchises operate in silos without a centralized fan platform.
- 80%+ of viewers live outside Abu Dhabi (India, UK, North America, GCC) with zero physical engagement touchpoints.

2. STRATEGIC RELEVANCE:
- 90-minute fast action format is uniquely aligned with digital native attention spans.
- Boundary frequency (every 3.2 balls) provides continuous micro-engagement moments.
- Aligns directly with UAE Vision 2031 to establish Abu Dhabi as a global sports entertainment capital.

3. THE WHAT (8 CORE ACTIVITIES + NEXT-GEN):
- Activity 1: Official League & Franchise Web PWA ($165K / AED 606K)
- Activity 2: Community Discussion Forum & Real-Time Discourse Engine ($45K / AED 165K)
- Activity 3: Gamification Suite: Match Predictor, Trivia & Streaks ($55K / AED 202K)
- Activity 4: "Dream Team" (Fantasy 10) Squad Architect ($65K / AED 239K)
- Activity 5: Provably Fair VIP Giveaways & President Box Passes ($120K / AED 440K)
- Activity 6: Multi-Team Unified Live Center & YouTube Watch Hub ($60K / AED 220K)
- Activity 7: Consolidated Team Social Media Wall ($35K / AED 128K)
- Activity 8: Global Physical Fan Spaces in Abu Dhabi, Dubai, London, Mumbai & Toronto ($480K / AED 1,763K)
- Activity 9: Grassroots Youth T10 Cup & 50+ Creator Streamer Studio ($140K / AED 514K)

4. TOTAL BUDGET & FINANCIALS:
- Total Proposed Investment: $1,150,000 USD (AED 4,223,000)
- Projected Year 1 Commercial Revenue: $2,400,000 USD (AED 8,814,000)
- Net Positive Return on Investment: +108% Net ROI

5. OUTCOMES & KPIS:
- 750,000+ Registered Global Fan Accounts
- 45,000+ Physical Fan Space Visitors
- 300,000+ Fantasy 10 Lineups & 3.5M Predictions
- 65,000+ Forum Discussions
- 45M+ Video & Creator Watch-Along Views
=====================================================
`;
    navigator.clipboard.writeText(summary.trim());
    setCopiedToast(true);
    setTimeout(() => setCopiedToast(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 animate-fadeIn text-slate-100">
      {/* Toast */}
      {copiedToast && (
        <div className="fixed top-20 right-6 z-50 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black px-4 py-3 rounded-2xl shadow-2xl border border-amber-300 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-slate-950" />
          <span className="text-xs sm:text-sm">Executive Proposal Summary copied to clipboard!</span>
        </div>
      )}

      {/* Hero Header Section */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500/25 via-slate-900 to-slate-950 border border-amber-500/40 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 fill-amber-400" />
                <span>Confidential Official Dossier · ADT10 Expansion</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[11px] font-bold">
                Doc Ref: ADT10-FAN-EXP-2026-v1
              </span>
              <span className="px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[11px] font-black">
                Copyright by Azlir Sport
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              Strengthening the <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500">ADT10 Global Fan Base</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              A comprehensive strategic proposal submitted to the Abu Dhabi T10 League Governing Council and Franchise Board. Establishing an integrated 365-day digital portal, community discussion forum, gamification, fantasy dream team, transparent VIP giveaways, unified broadcast watch centers, cross-franchise social curation, and physical experiential Fan Spaces across Abu Dhabi, Dubai, London, Mumbai, and Toronto.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400 pt-1">
              <div><span className="text-slate-500">Target Body:</span> ADT10 League Governing Council</div>
              <div><span className="text-slate-500">Total Investment:</span> <span className="text-amber-400 font-mono font-bold">$1,150,000 USD (AED 4,223,000)</span></div>
              <div><span className="text-slate-500">Projected Year 1 ROI:</span> <span className="text-emerald-400 font-mono font-bold">+108%</span></div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              onClick={handlePrint}
              className="px-5 py-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Official Proposal</span>
            </button>

            <button
              onClick={handleCopySummary}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-amber-400" />
              <span>Copy Executive Summary</span>
            </button>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <span className="text-slate-400 font-semibold pl-1">Currency:</span>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => setCurrency('USD')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    currency === 'USD' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  $ USD
                </button>
                <button
                  onClick={() => setCurrency('AED')}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                    currency === 'AED' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  د.إ AED
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Nav Tabs */}
        <div className="relative z-10 flex items-center gap-2 overflow-x-auto pt-8 mt-6 border-t border-slate-800/80 scrollbar-thin">
          {[
            { id: 'document', label: 'Formal Proposal Dossier', icon: FileText },
            { id: 'budget', label: 'Activities & Budget Breakdown', icon: DollarSign },
            { id: 'fanspaces', label: 'Global Physical Fan Spaces', icon: MapPin },
            { id: 'deck', label: 'Executive Boardroom Pitch Deck', icon: Presentation },
            { id: 'roi', label: 'Commercial ROI & Simulator', icon: TrendingUp },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeProposalTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveProposalTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                    : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-slate-950' : 'text-amber-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= VIEW A: FORMAL PROPOSAL DOCUMENT ================= */}
      {activeProposalTab === 'document' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 space-y-10 shadow-xl print:bg-white print:text-slate-900 print:border-none print:shadow-none">
          {/* Document Letterhead */}
          <div className="border-b border-slate-800 pb-8 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 uppercase tracking-widest font-mono">
              <span>Abu Dhabi T10 League Governing Council</span>
              <span>Confidential Proposal Document</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center p-0.5">
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <span className="text-amber-400 font-black text-xl">T10</span>
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">STRATEGIC PROPOSAL: GLOBAL FAN BASE EXPANSION</h2>
                <p className="text-xs text-amber-400 font-medium">
                  Prepared by: Arabian Aces Strategy & Global Fan Development Committee
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              <div>
                <span className="text-slate-500 block">Recipient:</span>
                <span className="font-bold text-white">ADT10 Governing Council & Franchise Ownership Board</span>
              </div>
              <div>
                <span className="text-slate-500 block">Scope:</span>
                <span className="font-bold text-white">Digital Platform, Forums, Contests, Giveaways & Global Fan Spaces</span>
              </div>
              <div>
                <span className="text-slate-500 block">Investment Request:</span>
                <span className="font-bold text-amber-400 font-mono">
                  {currency === 'USD' ? '$1,150,000 USD' : '4,223,000 AED'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2 border-l-4 border-amber-400 pl-3">
              1. Executive Summary & Purpose
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              The Abu Dhabi T10 League has successfully pioneered the fastest and most explosive format in world cricket. With matches concluded in 90 electrifying minutes, the league holds the ideal structural foundation to capture digital-native sports audiences worldwide. However, to maximize enterprise franchise value, commercial sponsorship revenues, and broadcast rights, the league must evolve from a localized 2-week tournament into a <strong>365-day global fan entertainment ecosystem</strong>.
            </p>
            <p className="text-sm text-slate-300 leading-relaxed">
              This proposal outlines a synchronized, multi-pillar initiative encompassing: 
              <strong> 1) A centralized digital league platform & PWA</strong>; 
              <strong> 2) An interactive fan discussion forum</strong>; 
              <strong> 3) Gamification contests & match predictors</strong>; 
              <strong> 4) A 6-player “Dream Team” (Fantasy 10) engine</strong>; 
              <strong> 5) Provably fair VIP hospitality giveaways</strong>; 
              <strong> 6) Multi-team live match broadcast watch centers</strong>; 
              <strong> 7) Consolidated cross-franchise social media walls</strong>; 
              <strong> 8) Physical experiential Fan Spaces in Abu Dhabi, Dubai, London, Mumbai, and Toronto</strong>; and 
              <strong> 9) Next-gen growth catalysts including grassroots youth cups and 50+ content creator partnerships</strong>.
            </p>
          </div>

          {/* Section 2: The Need */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2 border-l-4 border-amber-400 pl-3">
              2. The Strategic Need: Solving Fandom Bottlenecks
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-amber-400 font-bold text-xs uppercase tracking-wider block">Gap 1</span>
                <h4 className="text-base font-bold text-white">Severe Off-Season Attrition</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Currently, over 87% of casual viewers lose contact with the league once the final ball is bowled at Zayed Cricket Stadium. Without persistent digital engagement channels (forums, fantasy, giveaways, streaks), the league incurs heavy re-acquisition costs every winter.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-amber-400 font-bold text-xs uppercase tracking-wider block">Gap 2</span>
                <h4 className="text-base font-bold text-white">Franchise Data Fragmentation</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Franchises currently operate in isolated communication silos across separate Twitter, Instagram, and YouTube accounts. The league lacks a unified first-party Customer Data Platform (CDP) to measure total unique fan reach and package high-value digital sponsor inventory.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-amber-400 font-bold text-xs uppercase tracking-wider block">Gap 3</span>
                <h4 className="text-base font-bold text-white">Geographic Physical Disconnect</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  More than 80% of T10 television and streaming viewers reside in international diaspora hubs—London, Mumbai, Delhi, Toronto, Karachi, and the GCC. Restricting physical experiences exclusively to Abu Dhabi deprives millions of passionate fans of communal watch parties and merchandise access.
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Strategic Relevance */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2 border-l-4 border-amber-400 pl-3">
              3. Strategic Relevance to Abu Dhabi & Global Cricket
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              The 90-minute format places Abu Dhabi T10 on exact temporal parity with world football (soccer) and European club basketball. Today's younger sports fans refuse to watch 8-hour ODIs or 4-hour T20s on linear TV; they consume fast-paced sports on second screens while actively participating in live chats, predictions, and fantasy drafting.
            </p>
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 space-y-1">
                <p className="font-bold text-amber-300">Alignment with Abu Dhabi Sports Vision 2031:</p>
                <p>
                  Deploying flagship physical Fan Spaces in London, Mumbai, and Toronto alongside Yas Island positions Abu Dhabi as the true global sports-tech and entertainment capital of the Middle East, converting international cricket fans into tourists and commercial partners for the UAE.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: What - The 8 Core Activities + Next-Gen */}
          <div className="space-y-6">
            <h3 className="text-xl font-black text-white flex items-center gap-2 border-l-4 border-amber-400 pl-3">
              4. "The What": 8 Core Strategic Activities & Deliverables
            </h3>
            
            <div className="space-y-4">
              {activitiesList.map((act) => (
                <div key={act.id} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center">
                        {act.number}
                      </span>
                      <h4 className="text-base font-bold text-white">{act.title}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-amber-300">
                        {act.tag}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono font-bold">
                      <span className="text-amber-400">
                        {currency === 'USD' ? `$${act.usdCost.toLocaleString()}` : `${(act.aedCost || Math.round(act.usdCost * exchangeRate)).toLocaleString()} AED`}
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="text-slate-400 font-sans text-[11px]">{act.timeline}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
                    <div>
                      <span className="text-slate-500 font-bold block mb-1">Scope & Implementation:</span>
                      <p className="leading-relaxed">{act.what}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 font-bold block mb-1">Measurable Expected Outcome:</span>
                      <p className="leading-relaxed">{act.outcome}</p>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400">Core KPIs:</span>
                    {act.kpis.map((kpi, kIdx) => (
                      <span key={kIdx} className="text-[10px] font-semibold bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-amber-300">
                        ✓ {kpi}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: The 4-Way Benefits Matrix */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2 border-l-4 border-amber-400 pl-3">
              5. The Quad-Win Benefits Matrix
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Trophy className="w-4 h-4" />
                  <span>For ADT10 League</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>365-day persistent fan retention</li>
                  <li>Unified 1st-party Customer Data Platform</li>
                  <li>+25% broadcast rights appreciation</li>
                  <li>Global brand prestige via city fan spaces</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Users className="w-4 h-4" />
                  <span>For 6 Franchises</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>Direct fan monetization & merchandise sales</li>
                  <li>Branded team sub-forums and fan clubs</li>
                  <li>Sponsor asset expansion in local markets</li>
                  <li>Deep player-fan emotional affinity</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Sparkles className="w-4 h-4" />
                  <span>For Commercial Sponsors</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>High-intent, targeted second-screen inventory</li>
                  <li>Branded predictor & fantasy titles</li>
                  <li>Experiential booths in London/Mumbai fan spaces</li>
                  <li>Transparent measurable digital attribution</li>
                </ul>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <Flame className="w-4 h-4" />
                  <span>For Global Fans</span>
                </div>
                <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                  <li>An authentic voice in official discussions</li>
                  <li>Daily gamification points & streak badges</li>
                  <li>Fair chances to win VIP hospitality passes</li>
                  <li>Communal watch spaces in their home cities</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 6: Budget & Financial Summary */}
          <div className="space-y-4">
            <h3 className="text-xl font-black text-white flex items-center gap-2 border-l-4 border-amber-400 pl-3">
              6. Comprehensive Budget & Return on Investment
            </h3>
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Proposed Investment</span>
                  <div className="text-3xl font-black font-mono text-amber-400">
                    {currency === 'USD' ? `$${baseTotalUsd.toLocaleString()}` : `${baseTotalAed.toLocaleString()} AED`}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Projected Year 1 Gross Revenue</span>
                  <div className="text-3xl font-black font-mono text-emerald-400">
                    {currency === 'USD' ? '$2,400,000' : '8,814,000 AED'}
                  </div>
                </div>

                <div>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Projected Net ROI</span>
                  <div className="text-3xl font-black font-mono text-white">
                    +108%
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                The budget reflects balanced capital expenditure (CapEx: 60%) in building reusable digital and hardware assets, and operational expenditure (OpEx: 40%) for venue leases, community moderation, hospitality fulfillment, and creator campaigns. Revenue streams from title predictor sponsors, digital superfan memberships, and physical merchandise pop-ups ensure the program becomes self-funding within 8 months.
              </p>
            </div>
          </div>

          {/* Call to action & navigation to live components */}
          <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-white">Experience the Live Ecosystem on This Platform</h4>
              <p className="text-xs text-slate-400">Test the Discussion Forum, Contests, Draws, and Social Hub functioning in real-time.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onNavigateToForum && (
                <button
                  onClick={onNavigateToForum}
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Test Discussion Forum</span>
                </button>
              )}
              {onNavigateToContests && (
                <button
                  onClick={onNavigateToContests}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Test Predictor & Fantasy</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW B: DETAILED BUDGET TABLE ================= */}
      {activeProposalTab === 'budget' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-6 rounded-3xl border border-slate-800">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">Line-Item Financials</span>
              <h2 className="text-2xl font-black text-white">Activity-by-Activity Budget & Deliverables</h2>
              <p className="text-xs text-slate-400 mt-1">
                Granular CapEx and OpEx breakdown across all 9 proposed fan growth activities.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block font-medium">Grand Total</span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  {currency === 'USD' ? `$${baseTotalUsd.toLocaleString()}` : `${baseTotalAed.toLocaleString()} AED`}
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900/90 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-4 px-4">#</th>
                  <th className="py-4 px-4">Activity Name & Category</th>
                  <th className="py-4 px-4 text-right">CapEx ({currency})</th>
                  <th className="py-4 px-4 text-right">OpEx ({currency})</th>
                  <th className="py-4 px-4 text-right">Total Cost ({currency})</th>
                  <th className="py-4 px-4">Timeline</th>
                  <th className="py-4 px-6">Expected Deliverable & Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {activitiesList.map((act) => {
                  const capex = currency === 'USD' ? act.capexUsd : Math.round(act.capexUsd * exchangeRate);
                  const opex = currency === 'USD' ? act.opexUsd : Math.round(act.opexUsd * exchangeRate);
                  const total = currency === 'USD' ? act.usdCost : (act.aedCost || Math.round(act.usdCost * exchangeRate));

                  return (
                    <tr key={act.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-amber-400">{act.number}</td>
                      <td className="py-4 px-4">
                        <div className="font-bold text-white text-sm">{act.title}</div>
                        <span className="text-[10px] text-amber-400/80 uppercase font-semibold">{act.tag}</span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-medium text-slate-300">
                        {capex.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-medium text-slate-300">
                        {opex.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-right font-mono font-black text-amber-300 text-sm">
                        {total.toLocaleString()}
                      </td>
                      <td className="py-4 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                        {act.timeline}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-300 leading-relaxed max-w-md">
                        {act.outcome}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-950 font-bold border-t-2 border-amber-500/40 text-slate-200">
                <tr>
                  <td colSpan={4} className="py-4 px-4 uppercase text-right tracking-wider text-xs">
                    Grand Total Investment:
                  </td>
                  <td className="py-4 px-4 text-right font-mono font-black text-amber-400 text-base">
                    {currency === 'USD' ? `$${baseTotalUsd.toLocaleString()}` : `${baseTotalAed.toLocaleString()} AED`}
                  </td>
                  <td colSpan={2} className="py-4 px-6 text-slate-400 text-xs">
                    Includes all digital software, global fan spaces, prizes & creator campaigns
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ================= VIEW C: GLOBAL PHYSICAL FAN SPACES ================= */}
      {activeProposalTab === 'fanspaces' && (
        <div className="space-y-8">
          <div className="bg-slate-900/80 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">Experiential Brick-and-Mortar</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Global Physical Fan Spaces & Clubhouses</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              To transform the Abu Dhabi T10 into an international cultural phenomenon, physical touchpoints must bridge the distance between Zayed Cricket Stadium and the 2.5 billion cricket fans across the globe.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Location 1: Abu Dhabi Flagship */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase">
                    Flagship HQ · Year-Round
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Cap: 1,500 Fans</span>
                </div>
                <h3 className="text-xl font-black text-white">Abu Dhabi Yas Island Lounge</h3>
                <p className="text-xs text-slate-400">Location: Yas Marina / Zayed Stadium Precinct, Abu Dhabi, UAE</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The epicenter of T10 cricket. Features a massive 360-degree LED cylindrical arena, official hall of fame, player press room access, full luxury Emirati coffee and dining lounge, and VR batting pods.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                <div><span className="font-bold text-slate-300">Target Attendance:</span> 18,000 visitors/season</div>
                <div><span className="font-bold text-slate-300">Key Features:</span> VR Pods, Trophy Room, Live DJ</div>
              </div>
            </div>

            {/* Location 2: Dubai Marina */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-400/40 transition-colors space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black uppercase">
                    GCC Hub · Seasonal
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Cap: 800 Fans</span>
                </div>
                <h3 className="text-xl font-black text-white">Dubai Marina Promenade Fan Arena</h3>
                <p className="text-xs text-slate-400">Location: Jumeirah Beach Residence / Dubai Marina, UAE</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Captures the vibrant tourist and expatriate population of Dubai. Giant open-air screens by the water, official pop-up merchandise boutique, and live watch-along broadcasts with cricket influencers.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                <div><span className="font-bold text-slate-300">Target Attendance:</span> 12,000 visitors/season</div>
                <div><span className="font-bold text-slate-300">Key Features:</span> Waterfront Screens, Merch Store</div>
              </div>
            </div>

            {/* Location 3: London */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-400/40 transition-colors space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black uppercase">
                    European Hub · Tournament Pop-Up
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Cap: 600 Fans</span>
                </div>
                <h3 className="text-xl font-black text-white">London Regent Street Clubhouse</h3>
                <p className="text-xs text-slate-400">Location: Central London / Lord’s Precinct, UK</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Brings the warmth of Abu Dhabi to winter in London. High-end indoor cricket bar, heated viewing booths, Arabic hospitality tea bar, and appearances by English T10 icons (Moeen Ali, Alex Hales, Chris Jordan).
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                <div><span className="font-bold text-slate-300">Target Attendance:</span> 6,500 visitors/season</div>
                <div><span className="font-bold text-slate-300">Key Features:</span> Heated Lounges, English Player Meets</div>
              </div>
            </div>

            {/* Location 4: Mumbai */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-400/40 transition-colors space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black uppercase">
                    South Asia Hub · Pop-Up
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Cap: 1,200 Fans</span>
                </div>
                <h3 className="text-xl font-black text-white">Mumbai BKC Cricket Pavilion</h3>
                <p className="text-xs text-slate-400">Location: Bandra Kurla Complex, Mumbai, India</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Located in the financial and entertainment heart of India. Stadium-grade surround sound, live Dhol drummers during boundary sixes, fast-paced batting simulators, and Bollywood-cricket crossover evenings.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                <div><span className="font-bold text-slate-300">Target Attendance:</span> 15,000 visitors/season</div>
                <div><span className="font-bold text-slate-300">Key Features:</span> Dhol Drummers, Stadium Sound</div>
              </div>
            </div>

            {/* Location 5: Toronto */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-amber-400/40 transition-colors space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-black uppercase">
                    North America Hub · Pop-Up
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">Cap: 500 Fans</span>
                </div>
                <h3 className="text-xl font-black text-white">Toronto Brampton Fan Dome</h3>
                <p className="text-xs text-slate-400">Location: Greater Toronto Area (GTA), Canada</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Engages the explosive South Asian and Caribbean cricket community in Ontario. Indoor sports dome screenings, authentic Caribbean & South Asian street food stalls, and junior youth clinics.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                <div><span className="font-bold text-slate-300">Target Attendance:</span> 4,500 visitors/season</div>
                <div><span className="font-bold text-slate-300">Key Features:</span> Street Food, Caribbean Music</div>
              </div>
            </div>

            {/* Location 6: Virtual Metaverse / Digital Twin */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 to-slate-900 border border-amber-500/30 space-y-4 shadow-xl flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase">
                    Digital Twin · Global Access
                  </span>
                  <span className="text-xs font-mono text-amber-400 font-bold">Unlimited</span>
                </div>
                <h3 className="text-xl font-black text-white">Virtual Zayed Stadium Lounge</h3>
                <p className="text-xs text-slate-400">Access: WebGL / Mobile / VR Headset</p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Allows fans from any continent who cannot travel to visit a 3D digital recreation of the stadium enclosure, chat with avatars of other fans, unlock digital badges, and watch live streams in 3D audio.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 space-y-1">
                <div><span className="font-bold text-slate-300">Target Attendance:</span> 250,000+ virtual visits</div>
                <div><span className="font-bold text-slate-300">Key Features:</span> 3D Avatars, Spatial Audio</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW D: EXECUTIVE PITCH DECK ================= */}
      {activeProposalTab === 'deck' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-slate-900/80 p-4 sm:p-6 rounded-2xl border border-slate-800">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">Boardroom Presentation Mode</span>
              <h3 className="text-xl font-black text-white">Abu Dhabi T10 Fan Strategy Deck</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-400">
                Slide {currentSlide + 1} of {slides.length}
              </span>
              <button
                onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                disabled={currentSlide === 0}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
                disabled={currentSlide === slides.length - 1}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Slide Container (16:9 Presentation Aspect Ratio feel) */}
          <div className="min-h-[420px] rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/30 p-8 sm:p-12 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

            <div className="relative z-10 space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-black uppercase tracking-wider border border-amber-400/30">
                  {slides[currentSlide].tag}
                </span>
                <span className="font-mono text-xs text-slate-500 font-bold">
                  ADT10 COUNCIL BRIEFING
                </span>
              </div>

              <div>
                <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                  {slides[currentSlide].title}
                </h2>
                <p className="text-sm sm:text-base text-amber-400 font-semibold mt-1">
                  {slides[currentSlide].subtitle}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5 pt-2">
                {slides[currentSlide].bullets.map((bullet, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 font-black text-xs">
                      {idx + 1}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                      {bullet}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Slide Footer */}
            <div className="relative z-10 pt-6 mt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold">ABU DHABI T10</span>
                <span>·</span>
                <span>Arabian Aces Strategic Expansion</span>
              </div>
              <div className="flex items-center gap-1">
                {slides.map((_, i) => (
                  <div
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      i === currentSlide ? 'w-6 bg-amber-400' : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW E: COMMERCIAL ROI & SIMULATOR ================= */}
      {activeProposalTab === 'roi' && (
        <div className="space-y-8">
          <div className="bg-slate-900/80 p-6 sm:p-8 rounded-3xl border border-slate-800 space-y-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-400">Financial Modeling</span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">Dynamic Budget & ROI Simulator</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
              Test and model different rollout parameters for the Abu Dhabi T10 League Board. Adjust the number of physical Fan Spaces, promotional marketing spend, and giveaway prizes to observe immediate impacts on revenue and net return.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Interactive Controls */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
              <h3 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-800 pb-3">
                <Sliders className="w-5 h-5 text-amber-400" />
                <span>Simulation Controls</span>
              </h3>

              {/* Slider 1: Fan Spaces */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Physical Fan Space Locations</span>
                  <span className="font-mono text-amber-400 text-sm">{simFanSpaces} Cities</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={simFanSpaces}
                  onChange={(e) => setSimFanSpaces(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>2 (UAE Only)</span>
                  <span>5 (Base Proposal)</span>
                  <span>8 (Global Max)</span>
                </div>
              </div>

              {/* Slider 2: Marketing & Creator Spend */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Growth Marketing & Influencer Studio</span>
                  <span className="font-mono text-amber-400 text-sm">${(simMarketingSpend / 1000).toFixed(0)}k</span>
                </div>
                <input
                  type="range"
                  min="60000"
                  max="300000"
                  step="10000"
                  value={simMarketingSpend}
                  onChange={(e) => setSimMarketingSpend(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>$60k (Lean)</span>
                  <span>$140k (Recommended)</span>
                  <span>$300k (Aggressive)</span>
                </div>
              </div>

              {/* Slider 3: VIP Hospitality & Giveaways */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">VIP Giveaways & Hospitality Pool</span>
                  <span className="font-mono text-amber-400 text-sm">${(simPrizeBudget / 1000).toFixed(0)}k</span>
                </div>
                <input
                  type="range"
                  min="50000"
                  max="250000"
                  step="10000"
                  value={simPrizeBudget}
                  onChange={(e) => setSimPrizeBudget(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>$50k</span>
                  <span>$120k (Recommended)</span>
                  <span>$250k</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-bold text-slate-300">Assumptions Grounded In:</p>
                <p>• Fixed digital platform CapEx ($360,000)</p>
                <p>• $96k avg blended cost per Fan Space</p>
                <p>• $120k incremental sponsor yield per city</p>
              </div>
            </div>

            {/* Right: Real-Time Results Matrix */}
            <div className="lg:col-span-2 p-6 sm:p-8 rounded-3xl bg-slate-900 border border-amber-500/30 space-y-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-black text-white border-b border-slate-800 pb-3 mb-6">
                  Projected Financial Outcomes (Year 1)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 font-bold block mb-1">Simulated Budget</span>
                    <span className="text-2xl font-black font-mono text-amber-400">
                      ${simTotalUsd.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      {simTotalAed.toLocaleString()} AED
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 font-bold block mb-1">Gross Commercial Inflow</span>
                    <span className="text-2xl font-black font-mono text-emerald-400">
                      ${projTotalRevUsd.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-1">
                      {Math.round(projTotalRevUsd * USD_TO_AED).toLocaleString()} AED
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 font-bold block mb-1">Estimated Net Return</span>
                    <span className={`text-2xl font-black font-mono ${projNetProfitUsd >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {projNetProfitUsd >= 0 ? '+' : ''}${projNetProfitUsd.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-bold text-amber-300 block mt-1">
                      {projRoiPercent}% Return on Invested Capital
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Projected Revenue Stream Breakdown</h4>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="font-semibold text-slate-200">1. Commercial Title & Second-Screen Digital Sponsorships</span>
                      <span className="font-mono font-bold text-white">${projSponsorRevUsd.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="font-semibold text-slate-200">2. Physical Fan Spaces Merchandising & Retail F&B Margins</span>
                      <span className="font-mono font-bold text-white">${projMerchRevUsd.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="font-semibold text-slate-200">3. Digital Superfan Passbooks & Priority Enclosure Access</span>
                      <span className="font-mono font-bold text-white">${projMembershipRevUsd.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold text-amber-400">Net Conclusion:</span>
                <span>Self-sustaining within Year 1 with significant commercial profit for league and franchises.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proposal Copyright & Attribution */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-amber-500/30 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-bold text-white">Abu Dhabi T10 League Fan Base & Experiential Spaces Proposal</span>
        </div>
        <div className="font-semibold text-amber-300">
          Copyright by Azlir Sport © 2026. All rights reserved.
        </div>
      </div>
    </div>
  );
};
