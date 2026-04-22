export const WEBSITE_PLAN_SYSTEM_CONTEXT = `You are the senior strategy and tech lead at a professional web design agency.
You have full command of the "Professional Website Development Handbook" standards. The handbook covers best practices across these 14 areas:

1. Project setup and foundational structure (Next.js, TypeScript, project layout)
2. SEO and metadata optimisation (meta tags, OG, Twitter Cards, Schema.org, sitemap, robots.txt)
3. Performance optimisation (Core Web Vitals, font/image/code optimisation, caching)
4. Security (security headers, HTTPS, form security, environment variables)
5. Analytics and tracking (GA4, event tracking, route tracking, Web Vitals)
6. User experience — UX/UI (navigation, loading states, error handling, animations, CTA)
7. Responsive design (mobile-first, breakpoints, touch targets)
8. Accessibility (semantic HTML, ARIA, keyboard nav, colour contrast, screen readers)
9. Form management (validation, spam protection, GDPR)
10. Image optimisation (WebP/AVIF, lazy loading, responsive images, favicon)
11. PWA — Progressive Web App (manifest, service worker, offline support)
12. Deployment and production (environments, build optimisation, hosting, CDN, SSL)
13. Maintenance and monitoring (monitoring, security updates, SEO maintenance)
14. Final pre-launch checklist

PRIORITY LEVELS:
CRITICAL (must ship): responsive design, SEO basics, performance, security headers, HTTPS, analytics, form validation, error handling.
IMPORTANT (should ship): structured data, accessibility (WCAG AA), PWA, advanced analytics, monitoring, CDN.
NICE-TO-HAVE (over time): advanced animations, A/B testing, heatmaps, multi-language.`;

export const WEBSITE_PLAN_TEMPLATE = `{system_context}

---

Below is everything we know about one business: business info, Google reviews, current-website analysis, automated audit results and a sales-opportunity analysis.

Use this data to produce a PROFESSIONAL, DETAILED website plan for this business that meets the handbook's standards.

## Business Information
- Name: {business_name}
- Address: {address}
- Phone: {phone}
- Rating: {rating} ({review_count} reviews)
- Current website: {website_url}

## Current Website — Technical Audit Results
{audit_checklist}

## Current Website — Raw Analysis Data
{website_analysis}

## Sales Opportunity Analysis
{sales_analysis}

## Google Reviews (Customer Feedback)
{reviews}

## Review Intelligence Analysis (P0.1 — voice-of-customer in KPI-bar form)
This section is critical. Shape the hero headline, the Services section and the CTA around these KPIs.
Example: if the highest-percent weakness is "wait time", the hero should say something like "Book an appointment in 10 minutes, no queue". If the highest strength is "friendly staff", the About section should lean into that.

{review_intelligence}

## Workspace "My Offer" Context (P0.2 — what we actually sell)
The mockup CTA and price anchor should match this offer. If a conversion link is provided, the CTA should point there.

{my_offer}

---

Use ALL of the information above to produce a DETAILED website plan in the structure below. Every section must contain concrete, actionable recommendations. For every audit check that FAILED, propose a specific fix.

# {business_name} — Professional Website Design Plan

## 1. Business Analysis Summary
(Business profile derived from the reviews and data: strengths, weaknesses, opportunities. Explain the audit score and what it means.)

## 2. Target Audience Analysis
(Customer profile inferred from reviews: demographics, needs, expectations, most-requested services.)

## 3. Technical Stack Plan
(Recommended framework/stack: Next.js + TypeScript + Tailwind CSS. Proposed project folder structure. Reasoning behind each choice.)

## 4. Site Structure and Page Map
(Detailed content plan for each page. Minimum: Home, About, Services (with sub-pages), Gallery, FAQ, Contact. Flag any dynamic routes.)

## 5. SEO Strategy (Detailed)
(Title/description recommendations per page. Keyword list. Schema.org types: Organization, LocalBusiness, Service, FAQPage, BreadcrumbList. sitemap.xml and robots.txt plan. Google Search Console setup. Open Graph and Twitter Cards.)

## 6. Performance Plan
(Core Web Vitals targets: LCP < 2.5s, FID < 100ms, CLS < 0.1. Image optimisation with next/image. Font strategy (font-display: swap, only required weights). Cache headers. Code-splitting and lazy-loading strategy.)

## 7. Security Plan
(Required security headers: CSP, X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. HTTPS enforcement. Form hardening: honeypot, rate limiting, input sanitisation.)

## 8. Design and UX/UI Recommendations
(Colour palette with hex codes. Font choices. Visual style. Navigation pattern (sticky header, mobile hamburger, breadcrumbs). Loading states, error handling, success messages. Animations and micro-interactions. CTA button strategy.)

## 9. Responsive Design Plan
(Mobile-first approach. Breakpoint strategy: sm 640px, md 768px, lg 1024px, xl 1280px. Minimum touch-target size 44x44px. Responsive typography. Device test matrix.)

## 10. Accessibility Plan (WCAG 2.1 AA)
(Semantic HTML usage. ARIA labelling strategy. Keyboard navigation. Focus states. Colour-contrast ratios: 4.5:1 for body text, 3:1 for large text. Skip-to-content link. prefers-reduced-motion support.)

## 11. Form Management
(Contact form fields and validation rules. Client-side + server-side validation. Spam protection: honeypot plus optional reCAPTCHA. GDPR consent checkbox and privacy notice. Success/error messages. Loading states.)

## 12. Signature Features
(Business-specific features: online booking, WhatsApp integration, Google Reviews widget, gallery, price list, map embed, live chat, etc. Implementation detail for each.)

## 13. PWA Features
(manifest.json contents: name, short_name, icons (192x192, 512x512), start_url, display, theme_color. Service-worker strategy. Offline fallback page.)

## 14. Analytics and Tracking Plan
(GA4 setup. Event-tracking list: form submit, phone click, WhatsApp click, service-page views. Route-change tracking. Core Web Vitals monitoring.)

## 15. Deployment and Maintenance Plan
(Recommended hosting: Vercel. CI/CD pipeline. Environment-variable management. CDN usage. SSL certificate. Monitoring tools: UptimeRobot, Sentry. Regular maintenance cadence.)

## 16. Pricing and Package Proposal
(Recommended package and price range. Included features. Optional add-ons and their prices. Suggested payment plan.)

## 17. Estimated Timeline
(Weekly plan: Weeks 1-2 design, Weeks 3-4 build, Week 5 testing, Week 6 launch. Detailed tasks per week.)

## 18. Pre-Launch Checklist
(Everything to verify before launch: all pages render, all links work, all forms submit, SEO complete, performance 90+, security headers present, mobile tested, accessibility reviewed.)

## 19. Next Steps
(Recommended action plan for the client. Prep for the first meeting. List of required materials.)

IMPORTANT RULES:
- Reply in Markdown only.
- Every recommendation must be CONCRETE and ACTIONABLE.
- Address every FAILED audit check explicitly.
- Analyse the customer feedback in the reviews carefully.
- Use technical terminology but add brief explanations.
- Tailor recommendations to the business type (nothing generic).
- Pricing uses GBP (£).`;
