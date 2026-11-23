import type { Deal, DealCall, DealMeeting, DealNote, DealTimeLog, NegotiationRequest, ProposalVersion } from "../types";

// Fixture data for the Setu unit tests (and a reference for what real records look like).
// Not loaded at runtime — the app reads the database (see server/data.ts).

const base = {
  contactRole: "Decision Maker",
  email: "",
  location: "",
  source: "",
  remark: "",
};

export const MOCK_DEALS: Deal[] = [
  // ── Lead ──
  { ...base, id: "d-01", leadCode: "LD-2026-0042", title: "", company: "ABC Technologies", contactName: "Rahul Sharma", phone: "+91 98765 43210", email: "rahul@abctech.com", location: "Hyderabad", source: "Pavan", stage: "LEAD", ownerId: "u-vamshi-r", ownerName: "Vamshi R.", remark: "Call not lifted", dueDate: "2026-11-24", updatedAt: "2026-11-22T16:22:00+05:30" },
  { ...base, id: "d-02", leadCode: "LD-2026-0043", title: "", company: "Bluefin Retail", contactName: "Sneha Iyer", phone: "+91 99001 22334", email: "sneha@bluefin.in", location: "Bengaluru", source: "Website", stage: "LEAD", ownerId: "u-priya-shah", ownerName: "Priya Shah", remark: "Asked to call back after 4 PM", dueDate: "2026-11-23", updatedAt: "2026-11-21T11:05:00+05:30" },
  { ...base, id: "d-03", leadCode: "LD-2026-0044", title: "", company: "Kaveri Foods", contactName: "Manoj Reddy", phone: "+91 90000 45678", email: "manoj@kaverifoods.com", location: "Hyderabad", source: "Pavan", stage: "LEAD", ownerId: "u-vamshi-r", ownerName: "Vamshi R.", remark: "Call not lifted", dueDate: "2026-11-20", updatedAt: "2026-11-19T15:40:00+05:30" },
  { ...base, id: "d-04", leadCode: "LD-2026-0045", title: "", company: "UrbanNest Realty", contactName: "Farhan Ali", phone: "+91 98480 11223", email: "farhan@urbannest.co", location: "Pune", source: "LinkedIn", stage: "LEAD", ownerId: "u-arjun-tech", ownerName: "Arjun Tech", remark: "Shared company profile on WhatsApp", updatedAt: "2026-11-18T10:12:00+05:30" },

  // ── Meeting ──
  { ...base, id: "d-05", leadCode: "LD-2026-0038", title: "Product Demo & Architecture", company: "Orbit Logistics", contactName: "Karan Mehta", phone: "+91 97012 33445", email: "karan@orbitlogistics.in", location: "Mumbai", source: "Referral", stage: "MEETING", ownerId: "u-vamshi-r", ownerName: "Vamshi R.", updatedAt: "2026-11-22T16:22:00+05:30" },
  { ...base, id: "d-06", leadCode: "LD-2026-0039", title: "Mobile App Discovery", company: "Greenleaf Pharma", contactName: "Divya Nair", phone: "+91 96523 77889", email: "divya@greenleafpharma.com", location: "Hyderabad", source: "Pavan", stage: "MEETING", ownerId: "u-priya-shah", ownerName: "Priya Shah", updatedAt: "2026-11-21T09:15:00+05:30" },
  { ...base, id: "d-07", leadCode: "LD-2026-0040", title: "CRM Integration Walkthrough", company: "Stellar Motors", contactName: "Abhishek Rao", phone: "+91 98111 90876", email: "abhishek@stellarmotors.in", location: "Chennai", source: "Website", stage: "MEETING", ownerId: "u-arjun-tech", ownerName: "Arjun Tech", updatedAt: "2026-11-20T18:02:00+05:30" },

  // ── Discussions ──
  { ...base, id: "d-08", leadCode: "LD-2026-0031", title: "Website Development & Headless CMS", company: "Nimbus Edtech", contactName: "Ritika Jain", phone: "+91 98765 43210", email: "ritika@nimbusedtech.com", location: "Delhi", source: "Pavan", stage: "DISCUSSION", ownerId: "u-vamshi-r", ownerName: "Vamshi R.", remark: "Enterprise website + headless CMS & multi-region CDN", dueDate: "2026-11-24", updatedAt: "2026-11-22T16:22:00+05:30" },
  { ...base, id: "d-09", leadCode: "LD-2026-0032", title: "E-commerce Replatforming", company: "Craftbox India", contactName: "Neha Kapoor", phone: "+91 99887 66554", email: "neha@craftbox.in", location: "Jaipur", source: "Referral", stage: "DISCUSSION", ownerId: "u-priya-shah", ownerName: "Priya Shah", remark: "Moving from WooCommerce to Shopify Plus; wants SEO retained", dueDate: "2026-11-26", updatedAt: "2026-11-21T12:30:00+05:30" },
  { ...base, id: "d-10", leadCode: "LD-2026-0033", title: "Social Media Management", company: "Spice Route Cafes", contactName: "Arvind Menon", phone: "+91 90101 20202", email: "arvind@spiceroute.in", location: "Kochi", source: "Instagram", stage: "DISCUSSION", ownerId: "u-arjun-tech", ownerName: "Arjun Tech", remark: "Needs 3 outlets covered; monthly reels budget TBD", updatedAt: "2026-11-20T17:45:00+05:30" },
  { ...base, id: "d-11", leadCode: "LD-2026-0034", title: "Customer Portal Revamp", company: "Trident Insurance", contactName: "Pooja Verma", phone: "+91 98300 45612", email: "pooja@tridentins.com", location: "Kolkata", source: "Website", stage: "DISCUSSION", ownerId: "u-vamshi-r", ownerName: "Vamshi R.", remark: "Security review required before any proposal", dueDate: "2026-11-30", updatedAt: "2026-11-19T10:00:00+05:30" },
  { ...base, id: "d-12", leadCode: "LD-2026-0035", title: "Booking Engine & Payments", company: "Azure Stays", contactName: "Rohan Desai", phone: "+91 97400 12345", email: "rohan@azurestays.com", location: "Goa", source: "Pavan", stage: "DISCUSSION", ownerId: "u-priya-shah", ownerName: "Priya Shah", remark: "Razorpay + channel manager sync", updatedAt: "2026-11-18T14:20:00+05:30" },

  // ── Proposal ──
  { ...base, id: "d-13", leadCode: "LD-2026-0021", dealCode: "DEAL-2026-0016", title: "Website Development Proposal", company: "Lotus Interiors", contactName: "Meera Pillai", phone: "+91 98450 67890", email: "meera@lotusinteriors.in", location: "Bengaluru", source: "Referral", stage: "PROPOSAL", ownerId: "u-vamshi-r", ownerName: "Vamshi R.", value: 450000, proposalVersion: 2, dueDate: "2026-11-25", updatedAt: "2026-11-22T16:22:00+05:30" },
  { ...base, id: "d-14", leadCode: "LD-2026-0022", dealCode: "DEAL-2026-0017", title: "Brand Identity & Website", company: "Peak Fitness", contactName: "Siddharth Rao", phone: "+91 99000 11122", email: "sid@peakfitness.in", location: "Hyderabad", source: "Pavan", stage: "PROPOSAL", ownerId: "u-arjun-tech", ownerName: "Arjun Tech", value: 280000, proposalVersion: 1, updatedAt: "2026-11-20T13:10:00+05:30" },
  { ...base, id: "d-15", leadCode: "LD-2026-0023", dealCode: "DEAL-2026-0019", title: "Analytics Dashboard Build", company: "Meridian Capital", contactName: "Ananya Gupta", phone: "+91 98200 33344", email: "ananya@meridiancap.com", location: "Mumbai", source: "LinkedIn", stage: "PROPOSAL", ownerId: "u-priya-shah", ownerName: "Priya Shah", value: 620000, proposalVersion: 3, updatedAt: "2026-11-19T16:00:00+05:30" },

  // ── Negotiation ──
  { ...base, id: "d-abc", leadCode: "LD-2026-0012", dealCode: "DEAL-2026-0018", title: "Website Development", proposalVersion: 3, company: "ABC Technologies", contactName: "Rahul Sharma", contactRole: "Decision Maker (VP Engineering)", phone: "+91 98490 82190", email: "rahul@abctech.com", location: "HiTech City, Hyderabad", source: "Pavan", stage: "NEGOTIATION", ownerId: "u-vamshi-r", ownerName: "Vamshi R.", value: 450000, remark: "10% discount on 2-yr renewal", dueDate: "2026-11-24", updatedAt: "2026-11-22T16:22:00+05:30" },
  { ...base, id: "d-17", leadCode: "LD-2026-0013", dealCode: "DEAL-2026-0012", title: "ERP Customisation", company: "Sagar Cements", contactName: "Vikram Patil", phone: "+91 98220 55566", email: "vikram@sagarcements.com", location: "Nagpur", source: "Referral", stage: "NEGOTIATION", ownerId: "u-arjun-tech", ownerName: "Arjun Tech", value: 900000, remark: "Wants payment in 3 milestones", updatedAt: "2026-11-21T11:45:00+05:30" },
  { ...base, id: "d-18", leadCode: "LD-2026-0014", dealCode: "DEAL-2026-0013", title: "SEO & Performance Marketing", company: "Kiddo Toys", contactName: "Shalini Das", phone: "+91 90000 77788", email: "shalini@kiddotoys.in", location: "Ahmedabad", source: "Website", stage: "NEGOTIATION", ownerId: "u-priya-shah", ownerName: "Priya Shah", value: 180000, remark: "Asked for a 3-month trial before annual", updatedAt: "2026-11-20T15:30:00+05:30" },
  { ...base, id: "d-19", leadCode: "LD-2026-0015", dealCode: "DEAL-2026-0014", title: "Learning Platform MVP", company: "BrightPath Academy", contactName: "Nikhil Sinha", phone: "+91 97111 22233", email: "nikhil@brightpath.edu", location: "Patna", source: "Pavan", stage: "NEGOTIATION", ownerId: "u-vamshi-r", ownerName: "Vamshi R.", value: 750000, remark: "Scope cut: drop native apps from phase 1", updatedAt: "2026-11-18T12:00:00+05:30" },

  // ── Closed Won ──
  { ...base, id: "d-20", leadCode: "LD-2026-0004", dealCode: "DEAL-2026-0005", title: "FinTech Payment Gateway Core", company: "Hyperion Logistics", contactName: "Aditya Kulkarni", phone: "+91 98900 12121", email: "aditya@hyperion.in", location: "Pune", source: "Referral", stage: "CLOSED_WON", ownerId: "u-arjun-tech", ownerName: "Arjun Tech", value: 675000, closedAt: "2026-10-01", updatedAt: "2026-10-01T16:22:00+05:30",
    won: { finalValue: 675000, closedDate: "2026-10-01", advanceReceived: 337500, contractTerm: "2-Year MSA Term (Standard Enterprise)", paymentTerms: "50% Upfront, 50% on UAT Sign-off", documents: [{ id: "wf-1", name: "Signed_MSA_Hyperion_Logistics.pdf", size: 1_800_000 }, { id: "wf-2", name: "Advance_Tax_Invoice_INV-2026-0912.pdf", size: 420_000 }] } },
  { ...base, id: "d-21", leadCode: "LD-2026-0006", dealCode: "DEAL-2026-0008", title: "Corporate Website Refresh", company: "Silverline Hospitals", contactName: "Dr. Kavya Rao", phone: "+91 98480 99887", email: "kavya@silverline.health", location: "Hyderabad", source: "Pavan", stage: "CLOSED_WON", ownerId: "u-vamshi-r", ownerName: "Vamshi R.", value: 320000, closedAt: "2026-11-12", updatedAt: "2026-11-12T11:00:00+05:30" },

  // ── Closed Lost ──
  { ...base, id: "d-22", leadCode: "LD-2026-0002", dealCode: "DEAL-2026-0002", title: "Custom ERP Microservices", company: "Nexus Global", contactName: "Sameer Khan", phone: "+91 99666 55443", email: "sameer@nexusglobal.com", location: "Bengaluru", source: "LinkedIn", stage: "CLOSED_LOST", ownerId: "u-priya-shah", ownerName: "Priya Shah", value: 450000, remark: "Budget constraints & fiscal freeze", closedAt: "2026-10-20", updatedAt: "2026-10-20T16:22:00+05:30",
    lost: { lostValue: 450000, primaryReason: "Budget Constraints & Fiscal Freeze", secondaryFactor: "Multi-region infra pricing above their FY cap", closedDate: "2026-10-20", analysis: "Client CFO froze mid-year spend on new platforms. Technical evaluation went well; asked us to reach out again for the next budget review.", reengageDate: "2027-02-15", reengageNote: "Q4 Budget Cycle", keepNurturing: true } },
];

export const MOCK_NOTES: DealNote[] = [
  { id: "n-1", dealId: "d-abc", category: "NOTE", title: "Customer is highly interested", body: "Customer is highly interested in the enterprise package. Main concern is pricing and payment flexibility. Suggested 50/50 payment milestone on UAT completion.", pinned: true, authorId: "u-vamshi-r", authorName: "Vamshi R.", createdAt: "2026-10-04T17:15:00+05:30" },
  { id: "n-2", dealId: "d-abc", category: "NOTE", title: "Technical requirement", body: "Customer requires PostgreSQL integration and WhatsApp API support. Custom webhook integration will take approx 3 business days during onboarding.", pinned: false, authorId: "u-arjun-tech", authorName: "Arjun Tech", createdAt: "2026-10-02T15:30:00+05:30" },
  { id: "n-3", dealId: "d-abc", category: "NOTE", title: "Billing & Procurement Note", body: "Finance team requires GST invoice with vendor registration certificate. Rahul confirmed PO will be issued within 48h of final contract sign-off.", pinned: false, authorId: "u-priya-shah", authorName: "Priya Shah", createdAt: "2026-09-29T13:10:00+05:30" },
  { id: "n-4", dealId: "d-abc", category: "NOTE", title: "Competitor quote", body: "They have a competing quote about 15% lower, but prefer our support SLA.", pinned: false, authorId: "u-vamshi-r", authorName: "Vamshi R.", createdAt: "2026-09-27T12:00:00+05:30" },
  { id: "n-5", dealId: "d-abc", category: "NOTE", title: "First call summary", body: "Intro call went well. Looking to replace their marketing site and add a customer portal next year.", pinned: false, authorId: "u-vamshi-r", authorName: "Vamshi R.", createdAt: "2026-09-24T10:30:00+05:30" },
];

export const MOCK_TIME_LOGS: DealTimeLog[] = [
  { id: "t-1", dealId: "d-abc", userId: "u-vamshi-r", employeeName: "Vamshi R.", reason: "Preparing Proposal", startedAt: "2026-10-04T10:42:00+05:30", endedAt: "2026-10-04T11:06:36+05:30" },
  { id: "t-2", dealId: "d-abc", userId: "u-vamshi-r", employeeName: "Vamshi R.", reason: "Customer Follow-up", startedAt: "2026-10-04T14:15:00+05:30", endedAt: "2026-10-04T14:42:12+05:30" },
  { id: "t-3", dealId: "d-abc", userId: "u-arjun-tech", employeeName: "Arjun Tech", reason: "Technical Architecture Review", startedAt: "2026-10-03T16:10:00+05:30", endedAt: "2026-10-03T16:48:05+05:30" },
  { id: "t-4", dealId: "d-abc", userId: "u-vamshi-r", employeeName: "Vamshi R.", reason: "Requirement Review & SOW Scope", startedAt: "2026-10-02T11:20:00+05:30", endedAt: "2026-10-02T12:05:22+05:30" },
  { id: "t-5", dealId: "d-abc", userId: "u-priya-shah", employeeName: "Priya Shah", reason: "Commercial Pricing Model Analysis", startedAt: "2026-10-01T15:00:00+05:30", endedAt: "2026-10-01T15:50:00+05:30" },
  { id: "t-6", dealId: "d-abc", userId: "u-arjun-tech", employeeName: "Arjun Tech", reason: "Security Questionnaire Completion", startedAt: "2026-09-30T10:00:00+05:30", endedAt: "2026-09-30T11:15:00+05:30" },
];

export const MOCK_DISCUSSIONS: DealNote[] = [
  { id: "ds-1", dealId: "d-abc", category: "DISCUSSION", title: "Website Development & Headless CMS Architecture Scoping", body: "Client requested confirmation on Strapi CMS editorial workflow with role-based permissions and ~25k concurrent peak traffic. Configured multi-region Cloudflare CDN edge handlers and Redis cache layer over PostgreSQL. Attached Architecture_CDN_Benchmark_v1.pdf. Webhook retry policy with exponential backoff agreed.", pinned: true, authorId: "u-arjun-tech", authorName: "Arjun Tech", createdAt: "2026-09-29T11:40:00+05:30" },
  { id: "ds-2", dealId: "d-abc", category: "DISCUSSION", title: "WhatsApp Webhook Integration & SLA Discussion", body: "Discussed Meta Business Cloud API webhooks. Inbound lead payloads normalized and ingested into WinOS pipeline in <180ms. Factored into Proposal V3.", pinned: false, authorId: "u-priya-shah", authorName: "Priya Shah", createdAt: "2026-09-29T14:15:00+05:30" },
  { id: "ds-3", dealId: "d-abc", category: "DISCUSSION", title: "Initial Tech Stack Scoping & Compliance Review", body: "Client engineering team cleared AWS Mumbai (ap-south-1) primary datacenter for customer PII and database storage. SOC2 and ISO 27001 compliance questionnaire verified.", pinned: false, authorId: "u-vamshi-r", authorName: "Vamshi R.", createdAt: "2026-09-26T16:30:00+05:30" },
];

export const MOCK_PROPOSALS: ProposalVersion[] = [
  { id: "pv-abc-3", dealId: "d-abc", version: 3, title: "Website Development & Headless CMS Enterprise Proposal", value: 450000, reason: "10% 2-year renewal lock-in, 50/50 UAT milestone covenant, and WhatsApp Business API integration support.", authorId: "u-priya-shah", authorName: "Priya Shah", authorRole: "Solutions Architect", createdAt: "2026-10-03T16:22:00+05:30", status: "ACTIVE", sentVia: "DocuSign", attachment: { id: "f-1", name: "ABC_Tech_Proposal_V3.pdf", size: 860_000 } },
  { id: "pv-abc-2", dealId: "d-abc", version: 2, title: "Website Development & Headless CMS (Revised Quotation)", value: 480000, reason: "Client requested pricing reduction and payment milestone revision from 40/30/30 to UAT milestones.", authorId: "u-arjun-tech", authorName: "Arjun Tech", authorRole: "Lead Tech Consultant", createdAt: "2026-10-01T15:30:00+05:30", status: "SUPERSEDED", sentVia: "Email", attachment: { id: "f-2", name: "ABC_Tech_Proposal_V2.pdf", size: 790_000 } },
  { id: "pv-abc-1", dealId: "d-abc", version: 1, title: "Initial Commercial Proposal - Architecture & Discovery", value: 520000, reason: "Comprehensive full-stack delivery covering portal frontend, headless CMS, and devops setup.", authorId: "u-priya-shah", authorName: "Priya Shah", createdAt: "2026-09-27T17:00:00+05:30", status: "SUPERSEDED", sentVia: "Email", attachment: { id: "f-3", name: "ABC_Tech_Proposal_V1.pdf", size: 720_000 } },
];

/** Negotiations-tab updates (same shape as notes). */
export const MOCK_NEGOTIATION_UPDATES: DealNote[] = [
  { id: "nu-1", dealId: "d-abc", category: "NEGOTIATION", title: "Commercial Term Review: 10% 2-year discount clause", body: "Customer is highly interested in the enterprise package. Main concern is pricing and payment flexibility. Suggested 50/50 payment milestone on UAT completion. Finance team confirmed GST invoice with vendor registration certificate is ready. Rahul confirmed PO will be issued within 48h of final contract sign-off.", pinned: true, authorId: "u-priya-shah", authorName: "Priya Shah", createdAt: "2026-10-04T17:15:00+05:30" },
  { id: "nu-2", dealId: "d-abc", category: "NEGOTIATION", title: "Website Development Proposal (Revision V3)", body: "Headless architecture using Next.js, Strapi CMS, and high-concurrency PostgreSQL cluster. Includes CDN endpoints across Mumbai, Singapore, and Frankfurt. Customer accepted V3 scope document without architectural redlines.", pinned: false, authorId: "u-vamshi-r", authorName: "Vamshi R.", createdAt: "2026-10-03T16:22:00+05:30" },
  { id: "nu-3", dealId: "d-abc", category: "NEGOTIATION", title: "Technical Requirement & Webhook Integration", body: "Customer requires PostgreSQL integration and WhatsApp API support. Custom webhook integration will take approx 3 business days during onboarding. Architecture team has cleared feasibility with zero additional licensing overhead.", pinned: false, authorId: "u-arjun-tech", authorName: "Arjun Tech", createdAt: "2026-10-02T15:30:00+05:30" },
  { id: "nu-4", dealId: "d-abc", category: "NEGOTIATION", title: "Billing & Procurement Note", body: "Finance team requires GST invoice with vendor registration certificate. Rahul confirmed PO will be issued within 48h of final contract sign-off.", pinned: false, authorId: "u-priya-shah", authorName: "Priya Shah", createdAt: "2026-09-29T13:10:00+05:30" },
];

export const MOCK_REQUESTS: NegotiationRequest[] = [
  { id: "rq-1", dealId: "d-abc", level: 1, text: "10% discount on 2-yr renewal", requestedBy: "Rahul Sharma" },
  { id: "rq-2", dealId: "d-abc", level: 2, text: "50/50 payment milestone on UAT completion", requestedBy: "Rahul Sharma" },
  { id: "rq-3", dealId: "d-abc", level: 3, text: "99.9% Platinum SLA Tier with WhatsApp support", requestedBy: "Arjun Tech" },
  { id: "rq-4", dealId: "d-17", level: 1, text: "Payment in 3 milestones", requestedBy: "Vikram Patil" },
];

export const MOCK_CALLS: DealCall[] = [
  { id: "c-4", dealId: "d-abc", title: "Commercial & API Scope Clarification", direction: "OUTBOUND", outcome: "INTERESTED", startedAt: "2026-10-04T11:30:00+05:30", endedAt: "2026-10-04T11:48:24+05:30", repId: "u-vamshi-r", repName: "Vamshi R.", contactName: "Rahul Sharma", contactRole: "Client VP", summary: "Rahul requested an expedited revised proposal and confirmed executive interest. Specifically inquired about multi-channel WhatsApp sync and whether API rate limits are covered in the standard license.", recordingUrl: "https://example.com/recordings/c-4" },
  { id: "c-3", dealId: "d-abc", title: "Technical Architecture Discovery", direction: "OUTBOUND", outcome: "COMPLETED", startedAt: "2026-10-02T15:15:00+05:30", endedAt: "2026-10-02T15:39:10+05:30", repId: "u-arjun-tech", repName: "Arjun Tech", repRole: "Lead Architect", contactName: "Rahul Sharma", summary: "Discussed Okta SSO SAML 2.0 provisioning and dedicated Indian data residency requirements. Verified VPC peering compatibility and confirmed sub-50ms latency on Mumbai region cluster.", recordingUrl: "https://example.com/recordings/c-3" },
  { id: "c-2", dealId: "d-abc", title: "Stakeholder Alignment & Demo Prep", direction: "OUTBOUND", outcome: "QUALIFIED", startedAt: "2026-09-30T16:00:00+05:30", endedAt: "2026-09-30T16:16:40+05:30", repId: "u-vamshi-r", repName: "Vamshi R.", contactName: "Neha Kapoor", contactRole: "Procurement", summary: "Confirmed attendance of CTO and VP Eng for product walkthrough. Sent pre-meeting agenda and procurement compliance checklist ahead of time.", recordingUrl: "https://example.com/recordings/c-2" },
  { id: "c-1", dealId: "d-abc", title: "Inbound Lead Qualification", direction: "INBOUND", outcome: "CONNECTED", startedAt: "2026-09-28T10:15:00+05:30", endedAt: "2026-09-28T10:27:30+05:30", repId: "u-priya-shah", repName: "Priya Shah", contactName: "Rahul Sharma", summary: "Initial discovery call from website referral. 50 Enterprise seats needed with SLA 4h and dedicated account engineer. Allocated to Vamshi R. for end-to-end deal execution.", recordingUrl: "https://example.com/recordings/c-1" },
];

// Attendees exclude the host (shown separately as Host / Organizer).
const team = (id: string, name: string, role: string, email?: string) => ({
  id,
  userId: `u-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/-+$/, "")}`,
  name,
  role,
  email,
  company: "WinOS CRM",
  external: false,
  source: "TEAM" as const,
  rsvp: "ACCEPTED" as const,
});
const client = (id: string, name: string, role: string, email: string, company: string, source: "LEAD" | "DEAL" | "GUEST" = "DEAL", rsvp: "PENDING" | "ACCEPTED" = "ACCEPTED") => ({
  id,
  name,
  role,
  email,
  company,
  external: true,
  source,
  rsvp,
});
const ev = (id: string, at: string, title: string, detail: string, tone: "blue" | "green" | "amber" | "red" = "blue") => ({ id, at, title, detail, tone });

export const MOCK_MEETINGS: DealMeeting[] = [
  {
    id: "m-abc-3", dealId: "d-abc", title: "Commercial Negotiation & SOW Finalization", type: "Commercial Review",
    startAt: "2026-11-24T11:00:00+05:30", endAt: "2026-11-24T12:00:00+05:30", hostId: "u-vamshi-r", hostName: "Vamshi R.", hostRole: "Sales Lead",
    channel: "GOOGLE_MEET", link: "https://meet.google.com/abc-tech-winos", status: "UPCOMING", reminder: "30m",
    agenda: "<p>Final review of customized enterprise pricing for 50 licenses, API SLA agreement, Okta SSO rollout schedule, and payment milestone terms (50% upfront, 50% upon UAT sign-off).</p>",
    attendees: [client("a-1", "Rahul Sharma", "VP Eng (Client)", "rahul@abctech.com", "ABC Technologies"), team("a-2", "Arjun Tech", "Lead Architect", "arjun@winos.app"), team("a-3", "Priya Shah", "Sales Manager", "priya@winos.app")],
    history: [
      ev("e-1", "2026-11-20T10:30:00+05:30", "Meeting scheduled", "Scheduled by Vamshi R. on Google Meet."),
      ev("e-2", "2026-11-20T10:32:00+05:30", "Invitation added", "Calendar invite queued for rahul@abctech.com."),
      ev("e-3", "2026-11-21T16:20:00+05:30", "RSVP accepted by Rahul Sharma", "Confirmed attendance without agenda changes.", "green"),
    ],
  },
  {
    id: "m-abc-2", dealId: "d-abc", title: "Architecture & Security Review", type: "Technical Deep Dive",
    startAt: "2026-10-02T14:00:00+05:30", endAt: "2026-10-02T15:00:00+05:30", hostId: "u-vamshi-r", hostName: "Vamshi R.", hostRole: "Sales Lead",
    channel: "GOOGLE_MEET", link: "https://meet.google.com/abc-sec-review", status: "COMPLETED", reminder: "30m", agenda: "Security architecture and data residency.",
    summary: "<p>Security architecture approved. Confirmed single-tenant database encryption and compliance audit sign-off. Arjun verified PostgreSQL multi-region replication setup.</p>",
    attendees: [{ ...client("a-4", "Rahul Sharma", "VP Eng (Client)", "rahul@abctech.com", "ABC Technologies"), attended: true }, { ...team("a-5", "Arjun Tech", "Lead Architect"), attended: true }],
    history: [
      ev("e-4", "2026-09-30T11:00:00+05:30", "Meeting scheduled", "Scheduled by Vamshi R. on Google Meet."),
      ev("e-5", "2026-10-02T15:10:00+05:30", "Meeting completed", "Summary logged; 2 of 2 attendees present.", "green"),
    ],
  },
  {
    id: "m-abc-1", dealId: "d-abc", title: "Product Demo & Requirement Discovery", type: "Discovery Demo",
    startAt: "2026-09-28T11:00:00+05:30", endAt: "2026-09-28T12:15:00+05:30", hostId: "u-vamshi-r", hostName: "Vamshi R.", hostRole: "Sales Lead",
    channel: "ZOOM", link: "https://zoom.us/j/1234567890", status: "COMPLETED", reminder: "1h", agenda: "Product walkthrough and requirement discovery.",
    summary: "<p>Live interactive walkthrough of WinOS CRM, lead capture pipeline, role-based access, and automated task delegation. Client requested expedited commercial proposal with WhatsApp sync inclusion.</p>",
    recordingUrl: "https://zoom.us/rec/share/abc-demo",
    attendees: [{ ...client("a-7", "Rahul Sharma", "VP Eng (Client)", "rahul@abctech.com", "ABC Technologies"), attended: true }, { ...client("a-8", "Neha Kapoor", "Procurement", "neha@abctech.com", "ABC Technologies", "LEAD"), attended: true }],
    history: [
      ev("e-6", "2026-09-26T12:00:00+05:30", "Meeting scheduled", "Scheduled by Vamshi R. on Zoom."),
      ev("e-7", "2026-09-28T12:30:00+05:30", "Meeting completed", "Summary and recording logged.", "green"),
    ],
  },
  // The Meeting-column deals on the Tasks board.
  {
    id: "m-05", dealId: "d-05", title: "Product Demo & Architecture", type: "Product Demo",
    startAt: "2026-11-23T17:00:00+05:30", endAt: "2026-11-23T18:00:00+05:30", hostId: "u-vamshi-r", hostName: "Vamshi R.", hostRole: "Sales Lead", channel: "GOOGLE_MEET", link: "https://meet.google.com/abc-defg-hij",
    status: "UPCOMING", reminder: "30m", agenda: "<p>Platform demo and integration architecture.</p>",
    attendees: [client("a-10", "Karan Mehta", "Director", "karan@orbitlogistics.in", "Orbit Logistics", "LEAD", "PENDING"), team("a-12", "Arjun Tech", "Lead Architect")],
    history: [ev("e-8", "2026-11-19T09:00:00+05:30", "Meeting scheduled", "Scheduled by Vamshi R. on Google Meet.")],
  },
  {
    id: "m-06", dealId: "d-06", title: "Mobile App Discovery", type: "Discovery",
    startAt: "2026-11-25T11:30:00+05:30", endAt: "2026-11-25T12:30:00+05:30", hostId: "u-priya-shah", hostName: "Priya Shah", hostRole: "Sales Manager", channel: "CLIENT_LOCATION",
    location: "Greenleaf Pharma, Banjara Hills, Hyderabad",
    status: "UPCOMING", reminder: "1d", agenda: "<p>Understand patient-app requirements.</p>",
    attendees: [client("a-13", "Divya Nair", "Head of Digital", "divya@greenleafpharma.com", "Greenleaf Pharma", "LEAD"), team("a-15", "Vamshi R.", "Sales Lead")],
    history: [ev("e-9", "2026-11-18T15:00:00+05:30", "Meeting scheduled", "On-site visit scheduled by Priya Shah.")],
  },
  {
    id: "m-07", dealId: "d-07", title: "CRM Integration Walkthrough", type: "Walkthrough",
    startAt: "2026-11-27T15:00:00+05:30", endAt: "2026-11-27T16:00:00+05:30", hostId: "u-arjun-tech", hostName: "Arjun Tech", hostRole: "Lead Architect", channel: "GOOGLE_MEET", link: "https://meet.google.com/xyz-uvwq-rst",
    status: "UPCOMING", reminder: "15m", agenda: "<p>Walk through the CRM integration plan.</p>",
    attendees: [client("a-16", "Abhishek Rao", "CTO", "abhishek@stellarmotors.in", "Stellar Motors", "LEAD", "PENDING")],
    history: [ev("e-10", "2026-11-20T12:00:00+05:30", "Meeting scheduled", "Scheduled by Arjun Tech on Google Meet.")],
  },
  {
    id: "m-17", dealId: "d-17", title: "Commercial Terms Negotiation", type: "Commercial Review",
    startAt: "2026-11-20T11:30:00+05:30", endAt: "2026-11-20T12:30:00+05:30", hostId: "u-arjun-tech", hostName: "Arjun Tech", hostRole: "Lead Architect", channel: "IN_OFFICE",
    location: "WinOS HQ · Room 3", status: "COMPLETED", reminder: "30m", agenda: "<p>Milestone payments and SLA.</p>",
    summary: "<p>Agreed to 3 payment milestones; SLA review pending with their legal team.</p>",
    attendees: [{ ...client("a-18", "Vikram Patil", "CFO", "vikram@sagarcements.com", "Sagar Cements"), attended: true }],
    history: [
      ev("e-11", "2026-11-15T10:00:00+05:30", "Meeting scheduled", "In-office meeting scheduled by Arjun Tech."),
      ev("e-12", "2026-11-20T12:45:00+05:30", "Meeting completed", "Summary logged; 1 of 1 attendees present.", "green"),
    ],
  },
];
