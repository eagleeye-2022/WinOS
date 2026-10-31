import { ProjectPhase, ProjectTemplate, SOPPhaseTemplate, SOPTaskSeed, TaskItem, TaskList } from "../types";

export const VERBATIM_T2T_7_PHASE_TEMPLATE: ProjectTemplate = {
  id: "template-t2t-7phase",
  name: "WinOS EED Project Template (17 Phases / 38 Tasks)",
  description: "Official WinOS 17-Phase, 38-Task SOP Project Template covering client onboarding, UX research, UI/UX design, development, testing, deployment, and MSO operations.",
  isDefault: true,
  category: "Client Delivery",
  phases: [
    {
      code: "1.1",
      name: "1.1 Client On Boarding",
      departmentAlias: "digitalproducts@",
      taskLists: [
        {
          name: "1.1 Client On Boarding",
          flag: "external",
          sequence: 1,
          defaultTasks: [
            {
              title: "WhatsApp Group Creation",
              duration: "1 day",
              priority: "High",
              departmentAlias: "digitalproducts@",
              description: "Create client WhatsApp communication channel and invite key project stakeholders.",
            },
            {
              title: "Project Meeting with Team",
              duration: "1 day",
              priority: "High",
              departmentAlias: "digitalproducts@",
              description: "Internal team kickoff meeting to align on client scope, timeline, and resource allocation.",
            },
            {
              title: "Project Requirement and Expectation Collection from Client",
              duration: "2 days",
              priority: "Urgent",
              departmentAlias: "digitalproducts@",
              description: "Collect client brand guidelines, asset credentials, and core project expectations.",
            },
            {
              title: "Roadmap & Deliverables Document",
              duration: "2 days",
              priority: "High",
              departmentAlias: "digitalproducts@",
              description: "Finalize milestone delivery roadmap and signoff schedule with client.",
            },
            {
              title: "Client Zoho Project Board Creation",
              duration: "1 day",
              priority: "Medium",
              departmentAlias: "digitalproducts@",
              description: "Setup client portal board and configure external visibility settings.",
            },
          ],
        },
      ],
    },
    {
      code: "1.2",
      name: "1.2 Requirement Collection & Documentation",
      departmentAlias: "digitalproducts@",
      taskLists: [
        {
          name: "1.2 Requirement Collection & Documentation",
          flag: "internal",
          sequence: 2,
          defaultTasks: [
            {
              title: "SRS: Client Onboarding Document Research and Creation",
              duration: "3 days",
              priority: "High",
              departmentAlias: "digitalproducts@",
              description: "Draft comprehensive Software Requirement Specification (SRS) document.",
            },
            {
              title: "Client Onboarding Document Share with the Client",
              duration: "1 day",
              priority: "High",
              departmentAlias: "digitalproducts@",
              description: "Share the onboarding and specification document with client for review.",
            },
            {
              title: "SRS: Client Onboarding Document Showcase Meeting with Client",
              duration: "1 day",
              priority: "Urgent",
              departmentAlias: "digitalproducts@",
              description: "Present SRS and client onboarding document in a live client showcase meeting.",
            },
            {
              title: "SRS: Final Data Collection Milestone from the Client",
              duration: "2 days",
              priority: "Urgent",
              departmentAlias: "digitalproducts@",
              description: "Gather final assets, data, and access credentials from the client.",
            },
            {
              title: "Project Planning & Setup",
              duration: "2 days",
              priority: "High",
              departmentAlias: "digitalproducts@",
              description: "Initialize project environment, repositories, and team task assignments.",
            },
          ],
        },
      ],
    },
    {
      code: "2.1",
      name: "2.1 UX Research & Discovery",
      departmentAlias: "design@",
      taskLists: [
        {
          name: "2.1 UX Research & Discovery",
          flag: "internal",
          sequence: 3,
          defaultTasks: [
            {
              title: "V1 Keyword Research by UI/UX",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "seo@",
              description: "Conduct initial keyword research to inform site navigation and URL structure.",
            },
            {
              title: "Competitor Analysis",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "design@",
              description: "Benchmark competitor websites, user flows, and conversion UX patterns.",
            },
            {
              title: "Stakeholder Interview & Surveys",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "design@",
              description: "Synthesize target user demographics and client stakeholder interviews.",
            },
          ],
        },
      ],
    },
    {
      code: "2.2",
      name: "2.2 Ideation & Conceptualization",
      departmentAlias: "design@",
      taskLists: [
        {
          name: "2.2 Ideation & Conceptualization",
          flag: "internal",
          sequence: 4,
          defaultTasks: [
            {
              title: "Information Architecture (IA) Preparation",
              duration: "2 days",
              priority: "High",
              departmentAlias: "design@",
              description: "Map complete sitemap and page hierarchy structure.",
            },
            {
              title: "Mood Board Creation",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "design@",
              description: "Curate visual mood boards, typography palettes, and design inspiration.",
            },
            {
              title: "Mind Mapping and Brainstorming of Features",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "design@",
              description: "Brainstorm feature concepts and interactive component ideas.",
            },
            {
              title: "Detailed Keyword Research by SEO Team",
              duration: "3 days",
              priority: "High",
              departmentAlias: "seo@",
              description: "Perform comprehensive search volume and keyword intent mapping.",
            },
            {
              title: "User Journey Map (UJM)",
              duration: "2 days",
              priority: "High",
              departmentAlias: "design@",
              description: "Detail end-to-end user navigation flows and call-to-action touchpoints.",
            },
          ],
        },
      ],
    },
    {
      code: "3.1",
      name: "3.1 UI/UX Designing",
      departmentAlias: "design@",
      taskLists: [
        {
          name: "3.1 UI/UX Designing",
          flag: "external",
          sequence: 5,
          defaultTasks: [
            {
              title: "Wireframe Design",
              duration: "3 days",
              priority: "Urgent",
              departmentAlias: "design@",
              description: "Design low-fidelity and high-fidelity wireframe layouts.",
            },
            {
              title: "Design System Creation",
              duration: "3 days",
              priority: "Urgent",
              departmentAlias: "design@",
              description: "Build reusable UI component library in Figma (buttons, inputs, cards, typography).",
            },
            {
              title: "Header Footer Design",
              duration: "2 days",
              priority: "High",
              departmentAlias: "design@",
              description: "Design responsive header navigation and footer component variations.",
            },
            {
              title: "Design Demo to Client",
              duration: "1 day",
              priority: "Urgent",
              departmentAlias: "design@",
              description: "Conduct live design presentation and walk client through Figma prototypes.",
            },
          ],
        },
      ],
    },
    {
      code: "3.2",
      name: "3.2 Graphic Designing",
      departmentAlias: "design@",
      taskLists: [
        {
          name: "3.2 Graphic Designing",
          flag: "external",
          sequence: 6,
          defaultTasks: [
            {
              title: "Logo Design",
              duration: "3 days",
              priority: "Medium",
              departmentAlias: "design@",
              description: "Design custom brand logo concepts and vector asset variations.",
            },
            {
              title: "Brand Guideline Design",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "design@",
              description: "Draft comprehensive brand identity guidelines document.",
            },
          ],
        },
      ],
    },
    {
      code: "3.3",
      name: "3.3 Content Writing",
      departmentAlias: "design@",
      taskLists: [
        {
          name: "3.3 Content Writing",
          flag: "internal",
          sequence: 7,
          defaultTasks: [
            {
              title: "Website Content",
              duration: "4 days",
              priority: "High",
              departmentAlias: "design@",
              description: "Write compelling SEO-optimized page content and call-to-action copy.",
            },
          ],
        },
      ],
    },
    {
      code: "4.1",
      name: "4.1 Development",
      departmentAlias: "dev@",
      taskLists: [
        {
          name: "4.1 Development",
          flag: "internal",
          sequence: 8,
          defaultTasks: [
            {
              title: "Website Initialisation & Setup",
              duration: "2 days",
              priority: "Urgent",
              departmentAlias: "dev@",
              description: "Initialize Next.js / React application repository and environment configuration.",
            },
            {
              title: "Development",
              duration: "7 days",
              priority: "Urgent",
              departmentAlias: "dev@",
              description: "Implement responsive frontend pages and backend database API routes.",
            },
            {
              title: "Github CI/CD",
              duration: "2 days",
              priority: "High",
              departmentAlias: "dev@",
              description: "Configure GitHub Actions CI/CD automated build and test pipeline.",
            },
            {
              title: "Deployment",
              duration: "1 day",
              priority: "Urgent",
              departmentAlias: "dev@",
              description: "Deploy staging and production application builds.",
            },
            {
              title: "Testing",
              duration: "3 days",
              priority: "High",
              departmentAlias: "qa@",
              description: "Conduct functional and integration testing across core modules.",
            },
            {
              title: "Documentation",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "dev@",
              description: "Write developer API documentation and system setup guides.",
            },
          ],
        },
      ],
    },
    {
      code: "5.1",
      name: "5.1 Testing",
      departmentAlias: "qa@",
      taskLists: [
        {
          name: "5.1 Testing",
          flag: "internal",
          sequence: 9,
          defaultTasks: [
            {
              title: "Black Box Testing",
              duration: "2 days",
              priority: "High",
              departmentAlias: "qa@",
              description: "Perform end-to-end black box testing on user interfaces and workflows.",
            },
            {
              title: "Departmental Testing",
              duration: "2 days",
              priority: "High",
              departmentAlias: "qa@",
              description: "Conduct departmental QA verification with team leads.",
            },
            {
              title: "UAT Feedback",
              duration: "2 days",
              priority: "Urgent",
              departmentAlias: "qa@",
              description: "Gather and resolve User Acceptance Testing (UAT) feedback items.",
            },
            {
              title: "Heatmaps & Analytics (CRO)",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "seo@",
              description: "Setup Hotjar / Microsoft Clarity heatmaps and event tracking.",
            },
            {
              title: "A/B Testing",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "seo@",
              description: "Configure A/B testing variations for key conversion funnels.",
            },
          ],
        },
      ],
    },
    {
      code: "6.1",
      name: "6.1 Deployment and SEO",
      departmentAlias: "seo@",
      taskLists: [
        {
          name: "6.1 Deployment and SEO",
          flag: "external",
          sequence: 10,
          defaultTasks: [
            {
              title: "Website Live",
              duration: "1 day",
              priority: "Urgent",
              departmentAlias: "dev@",
              description: "Point production domain DNS, enable SSL, and execute official site launch.",
            },
          ],
        },
      ],
    },
    {
      code: "7.1",
      name: "7.1 Maintenance & Support",
      departmentAlias: "dev@",
      taskLists: [
        {
          name: "7.1 Maintenance & Support",
          flag: "external",
          sequence: 11,
          defaultTasks: [
            {
              title: "Website & Server Maintanance",
              duration: "Ongoing",
              priority: "Medium",
              departmentAlias: "dev@",
              description: "Routine server updates, security monitoring, and database health maintenance.",
            },
          ],
        },
      ],
    },
    {
      code: "7.2",
      name: "7.2 MSO On-Page & Technical SEO",
      departmentAlias: "seo@",
      taskLists: [
        {
          name: "7.2 MSO On-Page & Technical SEO",
          flag: "internal",
          sequence: 12,
          defaultTasks: [],
        },
      ],
    },
    {
      code: "7.3",
      name: "7.3 MSO Off-Page",
      departmentAlias: "seo@",
      taskLists: [
        {
          name: "7.3 MSO Off-Page",
          flag: "internal",
          sequence: 13,
          defaultTasks: [],
        },
      ],
    },
    {
      code: "7.4",
      name: "7.4 MSO Content Marketing",
      departmentAlias: "design@",
      taskLists: [
        {
          name: "7.4 MSO Content Marketing",
          flag: "external",
          sequence: 14,
          defaultTasks: [],
        },
      ],
    },
    {
      code: "7.5",
      name: "7.5 MSO Main",
      departmentAlias: "digitalproducts@",
      taskLists: [
        {
          name: "7.5 MSO Main",
          flag: "internal",
          sequence: 15,
          defaultTasks: [],
        },
      ],
    },
    {
      code: "7.6",
      name: "7.6 MSO Local SEO",
      departmentAlias: "seo@",
      taskLists: [
        {
          name: "7.6 MSO Local SEO",
          flag: "internal",
          sequence: 16,
          defaultTasks: [],
        },
      ],
    },
    {
      code: "7.7",
      name: "7.7 MSO Performance Marketing",
      departmentAlias: "seo@",
      taskLists: [
        {
          name: "7.7 MSO Performance Marketing",
          flag: "external",
          sequence: 17,
          defaultTasks: [],
        },
      ],
    },
  ],
};

export const INTERNAL_PRODUCT_TEMPLATE: ProjectTemplate = {
  id: "template-internal-product",
  name: "Internal Product Flat Task SOP Template",
  description: "Agile single-list project scaffold designed for internal tools (e.g. NES HRMS, WinOS extensions).",
  category: "Internal Product",
  phases: [
    {
      code: "1.0",
      name: "1. Internal Backlog & Sprint Tasks",
      departmentAlias: "dev@",
      taskLists: [
        {
          name: "Sprint Backlog",
          flag: "internal",
          sequence: 1,
          defaultTasks: [
            {
              title: "Architecture & Data Model Definition",
              duration: "2 days",
              priority: "High",
              departmentAlias: "dev@",
              description: "Define core interfaces and database schema requirements.",
            },
            {
              title: "Core Feature Prototype Build",
              duration: "5 days",
              priority: "Urgent",
              departmentAlias: "dev@",
              description: "Develop MVP user interfaces and API routes.",
            },
            {
              title: "Internal Team Testing & Feedback",
              duration: "2 days",
              priority: "Medium",
              departmentAlias: "qa@",
              description: "Collect dogfooding feedback from internal department users.",
            },
          ],
        },
      ],
    },
  ],
};

// Phases 1.1 → 6.1 shared by the Digital Project templates (Ecommerce / Enterprise). They only
// differ in the 7.x Maintenance & Support phases, which are built per template below.
const DIGITAL_PRODUCT_DELIVERY_PHASES: SOPPhaseTemplate[] = [
  {
    code: "1.1",
    name: "1.1 Client On Boarding",
    departmentAlias: "digitalproducts@",
    taskLists: [
      {
        name: "1.1 Client On Boarding",
        flag: "external",
        sequence: 1,
        defaultTasks: [
          {
            title: "WhatsApp Group Creation",
            duration: "1 day",
            priority: "High",
            departmentAlias: "digitalproducts@",
            description: "Create client WhatsApp communication channel and invite key project stakeholders.",
          },
          {
            title: "KT: Project Meeting with Team",
            duration: "1 day",
            priority: "High",
            departmentAlias: "digitalproducts@",
            description: "Internal knowledge-transfer kickoff meeting to align on client scope, timeline, and resource allocation.",
          },
          {
            title: "Project Requirement and Expectation Collection from Client",
            duration: "2 days",
            priority: "Urgent",
            departmentAlias: "digitalproducts@",
            description: "Collect client brand guidelines, asset credentials, and core project expectations.",
          },
          {
            title: "Roadmap & Deliverables Document",
            duration: "2 days",
            priority: "High",
            departmentAlias: "digitalproducts@",
            description: "Finalize milestone delivery roadmap and signoff schedule with client.",
          },
          {
            title: "Client Zoho Project Board Creation",
            duration: "1 day",
            priority: "Medium",
            departmentAlias: "digitalproducts@",
            description: "Setup client portal board and configure external visibility settings.",
          },
        ],
      },
    ],
  },
  {
    code: "1.2",
    name: "1.2 Requirement Collection & Documentation",
    departmentAlias: "digitalproducts@",
    taskLists: [
      {
        name: "1.2 Requirement Collection & Documentation",
        flag: "internal",
        sequence: 2,
        defaultTasks: [
          {
            title: "SRS: Client Onboarding Document Research and Creation",
            duration: "3 days",
            priority: "High",
            departmentAlias: "digitalproducts@",
            description: "Draft comprehensive Software Requirement Specification (SRS) document.",
          },
          {
            title: "Client Onboarding Document Share with the Client",
            duration: "1 day",
            priority: "High",
            departmentAlias: "digitalproducts@",
            description: "Share the onboarding and specification document with client for review.",
          },
          {
            title: "SRS: Client Onboarding Document Showcase Meeting with Client",
            duration: "1 day",
            priority: "Urgent",
            departmentAlias: "digitalproducts@",
            description: "Present SRS and client onboarding document in a live client showcase meeting.",
          },
          {
            title: "SRS: Final Data Collection Milestone from the Client",
            duration: "2 days",
            priority: "Urgent",
            departmentAlias: "digitalproducts@",
            description: "Gather final assets, data, and access credentials from the client.",
          },
          {
            title: "Project Planning & Setup",
            duration: "2 days",
            priority: "High",
            departmentAlias: "digitalproducts@",
            description: "Initialize project environment, repositories, and team task assignments.",
          },
        ],
      },
    ],
  },
  {
    code: "2.1",
    name: "2.1 UX Research & Discovery",
    departmentAlias: "design@",
    taskLists: [
      {
        name: "2.1 UX Research & Discovery",
        flag: "internal",
        sequence: 3,
        defaultTasks: [
          {
            title: "V1 Keyword Research by UI/UX",
            duration: "2 days",
            priority: "Medium",
            departmentAlias: "seo@",
            description: "Conduct initial keyword research to inform site navigation and URL structure.",
          },
          {
            title: "Competitor Analysis",
            duration: "2 days",
            priority: "Medium",
            departmentAlias: "design@",
            description: "Benchmark competitor websites, user flows, and conversion UX patterns.",
          },
          {
            title: "Stakeholder Interview & Surveys",
            duration: "2 days",
            priority: "Medium",
            departmentAlias: "design@",
            description: "Synthesize target user demographics and client stakeholder interviews.",
          },
        ],
      },
    ],
  },
  {
    code: "2.2",
    name: "2.2 Ideation & Conceptualization",
    departmentAlias: "design@",
    taskLists: [
      {
        name: "2.2 Ideation & Conceptualization",
        flag: "internal",
        sequence: 4,
        defaultTasks: [
          {
            title: "Information Architecture (IA) Preparation",
            duration: "2 days",
            priority: "High",
            departmentAlias: "design@",
            description: "Map complete sitemap and page hierarchy structure.",
          },
          {
            title: "Mood Board Creation",
            duration: "2 days",
            priority: "Medium",
            departmentAlias: "design@",
            description: "Curate visual mood boards, typography palettes, and design inspiration.",
          },
          {
            title: "Mind Mapping and Brainstorming of Features",
            duration: "2 days",
            priority: "Medium",
            departmentAlias: "design@",
            description: "Brainstorm feature concepts and interactive component ideas.",
          },
          {
            title: "Detailed Keyword Research by SEO Team",
            duration: "3 days",
            priority: "High",
            departmentAlias: "seo@",
            description: "Perform comprehensive search volume and keyword intent mapping.",
          },
          {
            title: "User Journey Map (UJM)",
            duration: "2 days",
            priority: "High",
            departmentAlias: "design@",
            description: "Detail end-to-end user navigation flows and call-to-action touchpoints.",
          },
        ],
      },
    ],
  },
  {
    code: "3.1",
    name: "3.1 UI/UX Designing",
    departmentAlias: "design@",
    taskLists: [
      {
        name: "3.1 UI/UX Designing",
        flag: "external",
        sequence: 5,
        defaultTasks: [
          {
            title: "Wireframe & Web Design",
            duration: "3 days",
            priority: "Urgent",
            departmentAlias: "design@",
            description: "Design wireframe layouts and high-fidelity web page designs.",
          },
          {
            title: "Design System Creation",
            duration: "3 days",
            priority: "Urgent",
            departmentAlias: "design@",
            description: "Build reusable UI component library in Figma (buttons, inputs, cards, typography).",
          },
          {
            title: "Header Footer Design",
            duration: "2 days",
            priority: "High",
            departmentAlias: "design@",
            description: "Design responsive header navigation and footer component variations.",
          },
          {
            title: "Design Demo to Client",
            duration: "1 day",
            priority: "Urgent",
            departmentAlias: "design@",
            description: "Conduct live design presentation and walk client through Figma prototypes.",
          },
        ],
      },
    ],
  },
  {
    code: "3.2",
    name: "3.2 Graphic Designing",
    departmentAlias: "design@",
    taskLists: [
      {
        name: "3.2 Graphic Designing",
        flag: "external",
        sequence: 6,
        defaultTasks: [
          {
            title: "Brand Guideline Design",
            duration: "2 days",
            priority: "Medium",
            departmentAlias: "design@",
            description: "Draft comprehensive brand identity guidelines document.",
          },
          {
            title: "Logo Design",
            duration: "3 days",
            priority: "Medium",
            departmentAlias: "design@",
            description: "Design custom brand logo concepts and vector asset variations.",
          },
          {
            title: "Other Branding Material",
            duration: "2 days",
            priority: "Medium",
            departmentAlias: "design@",
            description: "Design supporting brand collateral such as social creatives, banners, and stationery.",
          },
        ],
      },
    ],
  },
  {
    code: "3.3",
    name: "3.3 Content Writing",
    departmentAlias: "design@",
    taskLists: [
      {
        name: "3.3 Content Writing",
        flag: "internal",
        sequence: 7,
        defaultTasks: [
          {
            title: "Content Writing",
            duration: "4 days",
            priority: "High",
            departmentAlias: "design@",
            description: "Write compelling SEO-optimized page content and call-to-action copy.",
          },
        ],
      },
    ],
  },
  {
    code: "4.1",
    name: "4.1 Product Development",
    departmentAlias: "dev@",
    taskLists: [
      {
        name: "4.1 Product Development",
        flag: "internal",
        sequence: 8,
        defaultTasks: [],
      },
    ],
  },
  {
    code: "5.1",
    name: "5.1 Testing",
    departmentAlias: "qa@",
    taskLists: [
      {
        name: "5.1 Testing",
        flag: "internal",
        sequence: 9,
        defaultTasks: [
          {
            title: "Black Box Testing",
            duration: "2 days",
            priority: "High",
            departmentAlias: "qa@",
            description: "Perform end-to-end black box testing on user interfaces and workflows.",
          },
          {
            title: "Departmental Testing",
            duration: "2 days",
            priority: "High",
            departmentAlias: "qa@",
            description: "Conduct departmental QA verification with team leads.",
          },
          {
            title: "UAT Feedback",
            duration: "2 days",
            priority: "Urgent",
            departmentAlias: "qa@",
            description: "Gather and resolve User Acceptance Testing (UAT) feedback items.",
          },
          {
            title: "Heatmaps & Analytics (CRO)",
            duration: "2 days",
            priority: "Medium",
            departmentAlias: "seo@",
            description: "Setup Hotjar / Microsoft Clarity heatmaps and event tracking.",
          },
          {
            title: "A/B Testing",
            duration: "2 days",
            priority: "Medium",
            departmentAlias: "seo@",
            description: "Configure A/B testing variations for key conversion funnels.",
          },
        ],
      },
    ],
  },
  {
    code: "6.1",
    name: "6.1 Deployment and SEO",
    departmentAlias: "seo@",
    taskLists: [
      {
        name: "6.1 Deployment and SEO",
        flag: "external",
        sequence: 10,
        defaultTasks: [
          {
            title: "Website Live",
            duration: "1 day",
            priority: "Urgent",
            departmentAlias: "dev@",
            description: "Point production domain DNS, enable SSL, and execute official site launch.",
          },
          {
            title: "On-Page & Technical SEO V1",
            duration: "3 days",
            priority: "High",
            departmentAlias: "seo@",
            description: "First pass of on-page optimisation and technical SEO fixes after go-live.",
          },
          {
            title: "UAT Feedback V2",
            duration: "2 days",
            priority: "High",
            departmentAlias: "qa@",
            description: "Collect and resolve the second round of client UAT feedback on the live site.",
          },
          {
            title: "On-Page & Technical SEO V2",
            duration: "3 days",
            priority: "High",
            departmentAlias: "seo@",
            description: "Second pass of on-page and technical SEO incorporating V2 feedback.",
          },
        ],
      },
    ],
  },
];

/**
 * Builds the 7.x Maintenance & Support phases. 7.1 is always Maintenance & Support; the given
 * phase names follow it in order and are numbered 7.2, 7.3, ... so dropping a phase from the
 * list (e.g. Enterprise has no Monthly Product Update) renumbers everything after it.
 */
function buildMaintenancePhases(
  followingPhases: { name: string; departmentAlias: string; flag: "internal" | "external" }[]
): SOPPhaseTemplate[] {
  const firstSequence = DIGITAL_PRODUCT_DELIVERY_PHASES.length + 1;

  const maintenance: SOPPhaseTemplate = {
    code: "7.1",
    name: "7.1 Maintenance & Support",
    departmentAlias: "dev@",
    taskLists: [
      {
        name: "7.1 Maintenance & Support",
        flag: "external",
        sequence: firstSequence,
        defaultTasks: [
          {
            title: "Website & Server Maintenance",
            duration: "Ongoing",
            priority: "Medium",
            departmentAlias: "dev@",
            description: "Routine server updates, security monitoring, and database health maintenance.",
          },
        ],
      },
      {
        name: "7.1.1 Done Maintenance & Support",
        flag: "external",
        sequence: firstSequence + 1,
        defaultTasks: [],
      },
    ],
  };

  const rest = followingPhases.map((p, idx): SOPPhaseTemplate => {
    const code = `7.${idx + 2}`;
    return {
      code,
      name: `${code} ${p.name}`,
      departmentAlias: p.departmentAlias,
      taskLists: [
        {
          name: `${code} ${p.name}`,
          flag: p.flag,
          sequence: firstSequence + 2 + idx,
          defaultTasks: [],
        },
      ],
    };
  });

  return [maintenance, ...rest];
}

const MSO_PHASES: { name: string; departmentAlias: string; flag: "internal" | "external" }[] = [
  { name: "MSO On-Page & Technical SEO", departmentAlias: "seo@", flag: "internal" },
  { name: "MSO Off-Page", departmentAlias: "seo@", flag: "internal" },
  { name: "MSO Content Marketing", departmentAlias: "design@", flag: "external" },
  { name: "MSO Main", departmentAlias: "digitalproducts@", flag: "internal" },
  { name: "MSO Local SEO", departmentAlias: "seo@", flag: "internal" },
  { name: "MSO Performance Marketing", departmentAlias: "seo@", flag: "external" },
  { name: "NAT Task Not Aligned", departmentAlias: "digitalproducts@", flag: "internal" },
];

export const ECOMMERCE_PROJECT_TEMPLATE: ProjectTemplate = {
  id: "template-digital-ecommerce",
  name: "Ecommerce",
  description: "Digital Project SOP template for ecommerce builds: onboarding, research, design, development, testing, launch & SEO, and maintenance (7.1 → 7.9, including Monthly Product Update).",
  category: "Client Delivery",
  phases: [
    ...DIGITAL_PRODUCT_DELIVERY_PHASES,
    ...buildMaintenancePhases([
      { name: "Monthly Product Update", departmentAlias: "dev@", flag: "external" },
      ...MSO_PHASES,
    ]),
  ],
};

export const ENTERPRISE_PROJECT_TEMPLATE: ProjectTemplate = {
  id: "template-digital-enterprise",
  name: "Enterprise",
  description: "Digital Project SOP template for enterprise builds: same as Ecommerce but without Monthly Product Update, so maintenance runs 7.1 → 7.8.",
  category: "Client Delivery",
  phases: [...DIGITAL_PRODUCT_DELIVERY_PHASES, ...buildMaintenancePhases(MSO_PHASES)],
};

/** In a template task title, replaced by the month the project is created in ("October"). */
export const TEMPLATE_MONTH_PLACEHOLDER = "{MONTH}";

/** Posts per month in the SMM template's Content Production / Scheduling & Publishing lists. */
const SMM_POSTS_PER_MONTH = 3;

const smmTask = (title: string, subtasks?: string[]): SOPTaskSeed => ({
  title,
  duration: "1 day",
  priority: "Medium",
  departmentAlias: "smm@",
  ...(subtasks ? { subtasks } : {}),
});

const smmPhase = (code: string, name: string, defaultTasks: SOPTaskSeed[]): SOPPhaseTemplate => ({
  code,
  name: `${code} ${name}`,
  departmentAlias: "smm@",
  taskLists: [{ name: `${code} ${name}`, flag: "external", sequence: parseInt(code, 10), defaultTasks }],
});

const smmPosts = (action: string) =>
  Array.from({ length: SMM_POSTS_PER_MONTH }, (_, i) => `Post ${String(i + 1).padStart(2, "0")} ${action}`);

const SMM_MONTH = `${TEMPLATE_MONTH_PLACEHOLDER} Month`;

/**
 * SMM projects: setup, then the monthly cycle. Each monthly list has one "<Month> Month" task
 * (the month the project is created in) whose steps are its subtasks.
 */
export const SMM_PROJECT_TEMPLATE: ProjectTemplate = {
  id: "template-smm",
  name: "SMM",
  description:
    "Social media management: project setup, then each month's content planning, shoot & assets, production, publishing and reporting.",
  category: "Client Delivery",
  phases: [
    smmPhase("1.1", "Project Setup & Deliverables", [
      smmTask("WhatsApp Group Creation"),
      smmTask("Scope & Deliverables Setup"),
      smmTask("Project Meeting"),
      smmTask("Account & Access Setup"),
    ]),
    smmPhase("2.1", "Monthly Content Planning", [
      smmTask(SMM_MONTH, [
        "Monthly Strategy Creation",
        "Content Calendar Creation",
        "Content Brief Preparation",
        "Calendar Review & Approval",
      ]),
    ]),
    smmPhase("3.1", "Content Shoot & Asset Collection", [
      smmTask(SMM_MONTH, ["Shoot Planning", "Content Shoot", "Client Asset Collection", "Asset Finalization"]),
    ]),
    smmPhase("4.1", "Content Production", [smmTask(SMM_MONTH, smmPosts("Design"))]),
    smmPhase("5.1", "Scheduling & Publishing", [smmTask(SMM_MONTH, smmPosts("Publishing"))]),
    smmPhase("6.1", "Reporting & Analysis", [
      smmTask(SMM_MONTH, [
        "Performance Analysis",
        "Deliverable Completion Review",
        "Monthly Performance Report",
        "Client Reporting",
      ]),
    ]),
  ],
};

/** Templates offered when the project category is "Digital Project" in the Add Project drawer. */
export const DIGITAL_PROJECT_TEMPLATES: ProjectTemplate[] = [
  ECOMMERCE_PROJECT_TEMPLATE,
  ENTERPRISE_PROJECT_TEMPLATE,
];

export const DEFAULT_PROJECT_TEMPLATES: ProjectTemplate[] = [
  VERBATIM_T2T_7_PHASE_TEMPLATE,
  INTERNAL_PRODUCT_TEMPLATE,
  ECOMMERCE_PROJECT_TEMPLATE,
  ENTERPRISE_PROJECT_TEMPLATE,
];

export function scaffoldPhasesFromTemplate(template: ProjectTemplate): ProjectPhase[] {
  const phases: ProjectPhase[] = [];

  template.phases.forEach((p, pIdx) => {
    phases.push({
      id: `phase-${p.code.replace(".", "_")}`,
      code: p.code,
      name: p.name,
      isCompleted: pIdx === 0,
    });
  });

  return phases;
}

export function scaffoldTaskListsFromTemplate(template: ProjectTemplate): TaskList[] {
  const lists: TaskList[] = [];

  template.phases.forEach((p) => {
    (p.taskLists || []).forEach((tl) => {
      lists.push({
        id: `tl-${tl.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        name: tl.name,
        flag: tl.flag,
        sequence: tl.sequence,
        phaseCode: p.code,
        status: "Active",
      });
    });
  });

  return lists;
}

/** A scaffolded task plus the titles of the subtasks to create under it (see SOPTaskSeed.subtasks). */
export type ScaffoldedTask = Partial<TaskItem> & {
  subtaskTitles?: string[];
  /** Set only when the template task has them; otherwise the task gets the column defaults. */
  defaultStartDate?: string;
  defaultDueDate?: string;
  defaultOwners?: { id: string; name: string }[];
  sopChecklists?: { id: string; name: string }[];
};

const dateInDays = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB");

export function scaffoldTasksFromTemplate(
  template: ProjectTemplate,
  projectCode: string,
  defaultOwnerName?: string,
  defaultOwnerId?: string
): ScaffoldedTask[] {
  const tasks: ScaffoldedTask[] = [];
  let taskCounter = 1;
  const monthName = new Date().toLocaleString("en-US", { month: "long" });
  const withMonth = (s: string) => s.split(TEMPLATE_MONTH_PLACEHOLDER).join(monthName);
  const ownerName = defaultOwnerName || "Unassigned";
  const ownersList = defaultOwnerName && defaultOwnerName !== "Unassigned" ? [defaultOwnerName] : [];
  const ownerIdsList = defaultOwnerId ? [defaultOwnerId] : [];

  template.phases.forEach((p) => {
    const defaultTasksFromLists = p.taskLists ? p.taskLists.flatMap((tl) => tl.defaultTasks || []) : [];
    const allPhaseTasks = p.tasks && p.tasks.length > 0 ? p.tasks : defaultTasksFromLists;

    allPhaseTasks.forEach((dt) => {
      const codeNum = String(taskCounter).padStart(2, "0");
      tasks.push({
        code: `${projectCode}-T${codeNum}`,
        title: withMonth(dt.title),
        ...(dt.subtasks && dt.subtasks.length > 0 ? { subtaskTitles: dt.subtasks.map(withMonth) } : {}),
        ...(dt.startInDays !== undefined ? { defaultStartDate: dateInDays(dt.startInDays) } : {}),
        ...(dt.dueInDays !== undefined ? { defaultDueDate: dateInDays(dt.dueInDays) } : {}),
        ...(dt.defaultOwners?.length ? { defaultOwners: dt.defaultOwners } : {}),
        ...(dt.sopChecklists?.length ? { sopChecklists: dt.sopChecklists } : {}),
        phaseCode: p.code,
        phaseName: p.name,
        taskListName: p.name,
        status: dt.status || "Open",
        priority: dt.priority || "Medium",
        duration: dt.duration || "1 day",
        workHours: "00:00",
        startDate: new Date().toLocaleDateString("en-GB"),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-GB"),
        completionPercentage: 0,
        departmentAlias: dt.departmentAlias || p.departmentAlias || "digitalproducts@",
        description: dt.description || "",
        owner: ownerName,
        ownerId: defaultOwnerId,
        owners: ownersList,
        ownerIds: ownerIdsList,
        tags: [p.code],
        billingType: "Hourly Rate",
      });
      taskCounter++;
    });
  });

  return tasks;
}
