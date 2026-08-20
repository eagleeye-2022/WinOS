import { ProjectPhase, ProjectTemplate, TaskItem, TaskList } from "../types";

export const VERBATIM_T2T_7_PHASE_TEMPLATE: ProjectTemplate = {
  id: "template-t2t-7phase",
  name: "EagleEye T2T 7-Phase Delivery SOP Template",
  description: "Repeatable 7-Phase, 17-Task-List client web & marketing delivery pipeline scaffolded with starter tasks.",
  isDefault: true,
  category: "Client Delivery",
  phases: [
    {
      code: "1.0",
      name: "1. Client Onboarding and Requirement Gathering",
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
              title: "Project Requirement and Expectation collection from Client",
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
              title: "Client Board Creation",
              duration: "1 day",
              priority: "Medium",
              departmentAlias: "digitalproducts@",
              description: "Setup client portal board and configure external visibility settings.",
            },
          ],
        },
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
              title: "Functional Specification Signoff",
              duration: "2 days",
              priority: "Urgent",
              departmentAlias: "digitalproducts@",
              description: "Obtain client written approval on technical and functional specifications.",
            },
          ],
        },
      ],
    },
    {
      code: "2.0",
      name: "2. Research and Planning",
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
        {
          name: "2.2 Ideation & Conceptualization",
          flag: "internal",
          sequence: 4,
          defaultTasks: [
            {
              title: "Information Architecture Preparation",
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
              title: "User Journey Map",
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
      code: "3.0",
      name: "3. Product Design",
      departmentAlias: "design@",
      taskLists: [
        {
          name: "3.1 UI/UX Designing",
          flag: "external",
          sequence: 5,
          defaultTasks: [
            {
              title: "Figma UI Design System & Master Components",
              duration: "3 days",
              priority: "Urgent",
              departmentAlias: "design@",
              description: "Build reusable UI component library in Figma (buttons, inputs, cards, typography).",
            },
            {
              title: "High-Fidelity Desktop & Mobile Screen Designs",
              duration: "4 days",
              priority: "Urgent",
              departmentAlias: "design@",
              description: "Design pixel-perfect responsive layouts for all core template pages.",
            },
          ],
        },
        {
          name: "3.2 Graphic Designing",
          flag: "external",
          sequence: 6,
          defaultTasks: [
            {
              title: "Custom Illustrations & Visual Assets",
              duration: "3 days",
              priority: "Medium",
              departmentAlias: "design@",
              description: "Create custom vector graphics, hero section illustrations, and icons.",
            },
          ],
        },
        {
          name: "3.3 Content Writing",
          flag: "internal",
          sequence: 7,
          defaultTasks: [
            {
              title: "Website Copywriting & Marketing Messaging Draft",
              duration: "3 days",
              priority: "High",
              departmentAlias: "design@",
              description: "Write compelling SEO-optimized page content and call-to-action copy.",
            },
          ],
        },
      ],
    },
    {
      code: "4.0",
      name: "4. Product Development",
      departmentAlias: "dev@",
      taskLists: [
        {
          name: "4.1 Development",
          flag: "internal",
          sequence: 8,
          defaultTasks: [
            {
              title: "Frontend Architecture & Page Layout Build",
              duration: "5 days",
              priority: "Urgent",
              departmentAlias: "dev@",
              description: "Develop responsive Next.js / Tailwind CSS frontend components.",
            },
            {
              title: "Backend API & Database Schema Implementation",
              duration: "5 days",
              priority: "Urgent",
              departmentAlias: "dev@",
              description: "Configure backend server routes, database tables, and API integrations.",
            },
            {
              title: "Third-party Services & Payment Gateway Integration",
              duration: "3 days",
              priority: "High",
              departmentAlias: "dev@",
              description: "Integrate email triggers, CRM webhooks, and payment processors.",
            },
          ],
        },
      ],
    },
    {
      code: "5.0",
      name: "5. Testing",
      departmentAlias: "qa@",
      taskLists: [
        {
          name: "5.1 Testing",
          flag: "internal",
          sequence: 9,
          defaultTasks: [
            {
              title: "Cross-browser & Mobile Responsiveness QA",
              duration: "2 days",
              priority: "High",
              departmentAlias: "qa@",
              description: "Perform functional regression testing across Chrome, Safari, iOS, and Android.",
            },
            {
              title: "User Acceptance Testing (UAT) Sign-off",
              duration: "2 days",
              priority: "Urgent",
              departmentAlias: "qa@",
              description: "Conduct client walkthrough demo and log final polish fixes.",
            },
          ],
        },
      ],
    },
    {
      code: "6.0",
      name: "6. Deployment and SEO",
      departmentAlias: "seo@",
      taskLists: [
        {
          name: "6.1 Deployment and SEO",
          flag: "external",
          sequence: 10,
          defaultTasks: [
            {
              title: "Production Server Deployment & SSL Setup",
              duration: "1 day",
              priority: "Urgent",
              departmentAlias: "dev@",
              description: "Point DNS records, configure SSL certificate, and launch production build.",
            },
            {
              title: "Technical SEO Audit, Meta Tags & Sitemap Submission",
              duration: "2 days",
              priority: "High",
              departmentAlias: "seo@",
              description: "Verify meta titles/descriptions, XML sitemap, and Google Search Console indexing.",
            },
          ],
        },
      ],
    },
    {
      code: "7.0",
      name: "7. Maintenance and Support",
      departmentAlias: "seo@",
      taskLists: [
        {
          name: "7.1 Maintenance & Support",
          flag: "external",
          sequence: 11,
          defaultTasks: [
            {
              title: "Monthly Security & Health Monitoring",
              duration: "Ongoing",
              priority: "Low",
              departmentAlias: "dev@",
              description: "Routine server dependency updates, database backups, and security scans.",
            },
          ],
        },
        {
          name: "7.2 MSO On-Page & Technical SEO",
          flag: "internal",
          sequence: 12,
          defaultTasks: [
            {
              title: "Monthly Technical SEO Audit & Core Web Vitals",
              duration: "Monthly",
              priority: "Medium",
              departmentAlias: "seo@",
              description: "Optimize page speed, fix broken links, and update schema markup.",
            },
          ],
        },
        {
          name: "7.3 MSO Off-Page",
          flag: "internal",
          sequence: 13,
          defaultTasks: [
            {
              title: "High-Authority Backlink Outreach",
              duration: "Monthly",
              priority: "Medium",
              departmentAlias: "seo@",
              description: "Execute link-building outreach and brand citation placement.",
            },
          ],
        },
        {
          name: "7.4 MSO Content Marketing",
          flag: "external",
          sequence: 14,
          defaultTasks: [
            {
              title: "Monthly SEO Blog Post Publishing",
              duration: "Monthly",
              priority: "Medium",
              departmentAlias: "design@",
              description: "Draft, design, and publish 4 keyword-targeted blog articles.",
            },
          ],
        },
        {
          name: "7.5 MSO Main",
          flag: "internal",
          sequence: 15,
          defaultTasks: [
            {
              title: "Monthly Campaign Strategy Alignment",
              duration: "Monthly",
              priority: "High",
              departmentAlias: "digitalproducts@",
              description: "Monthly executive review call to evaluate traffic and conversion growth.",
            },
          ],
        },
        {
          name: "7.6 MSO Local SEO",
          flag: "internal",
          sequence: 16,
          defaultTasks: [
            {
              title: "Google Business Profile Optimization",
              duration: "Monthly",
              priority: "Medium",
              departmentAlias: "seo@",
              description: "Update GBP posts, respond to reviews, and manage local citations.",
            },
          ],
        },
        {
          name: "7.7 MSO Performance Marketing",
          flag: "external",
          sequence: 17,
          defaultTasks: [
            {
              title: "Google Ads & Meta Ads Conversion Tracking Audit",
              duration: "Monthly",
              priority: "High",
              departmentAlias: "seo@",
              description: "Monitor ad spend ROI, keyword bids, and retargeting pixel tracking.",
            },
          ],
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
  return template.phases.map((p, idx) => ({
    id: `phase-${idx + 1}`,
    code: p.code,
    name: p.name,
    isCompleted: false,
  }));
}

export function scaffoldTaskListsFromTemplate(template: ProjectTemplate): TaskList[] {
  const taskLists: TaskList[] = [];
  template.phases.forEach((p) => {
    p.taskLists.forEach((tl) => {
      taskLists.push({
        id: `tl-${tl.sequence}`,
        name: tl.name,
        flag: tl.flag,
        status: "Active",
        sequence: tl.sequence,
        phaseCode: p.code,
      });
    });
  });
  return taskLists;
}

export function scaffoldTasksFromTemplate(template: ProjectTemplate, projectId: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  let taskCounter = 1;

  template.phases.forEach((p) => {
    p.taskLists.forEach((tl) => {
      tl.defaultTasks.forEach((t) => {
        const code = `${projectId}-T${taskCounter}`;
        tasks.push({
          id: code,
          code: code,
          title: t.title,
          phaseCode: p.code,
          phaseName: p.name,
          taskListName: tl.name,
          isExternal: tl.flag === "external",
          status: "Open",
          authorName: "SOP Template Engine",
          departmentAlias: t.departmentAlias,
          duration: t.duration,
          priority: t.priority,
          description: t.description,
          completionPercentage: 0,
          startDate: new Date().toLocaleDateString("en-US"),
          staleAlert: false,
          lastActivityDate: new Date().toISOString(),
          hasAttachments: false,
          hasComments: false,
          hasReminder: false,
          hasRecurrence: false,
        });
        taskCounter++;
      });
    });
  });

  return tasks;
}
