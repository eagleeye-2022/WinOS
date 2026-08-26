import { ProjectPhase, ProjectTemplate, TaskItem, TaskList } from "../types";

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

export const DEFAULT_PROJECT_TEMPLATES: ProjectTemplate[] = [
  VERBATIM_T2T_7_PHASE_TEMPLATE,
  INTERNAL_PRODUCT_TEMPLATE,
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

export function scaffoldTasksFromTemplate(
  template: ProjectTemplate,
  projectCode: string,
  defaultOwnerName?: string,
  defaultOwnerId?: string
): Partial<TaskItem>[] {
  const tasks: Partial<TaskItem>[] = [];
  let taskCounter = 1;
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
        title: dt.title,
        phaseCode: p.code,
        phaseName: p.name,
        taskListName: p.name,
        status: "Open",
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
