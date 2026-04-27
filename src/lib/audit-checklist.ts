import type { WebsiteFeatures, CheckResult, AuditChecklistResult } from "@/types";

function check(
  category: CheckResult["category"],
  item: string,
  status: CheckResult["status"],
  priority: CheckResult["priority"],
  recommendation: string
): CheckResult {
  return { category, item, status, priority, recommendation };
}

function boolStatus(val: boolean): "pass" | "fail" {
  return val ? "pass" : "fail";
}

export function runAuditChecklist(
  features: WebsiteFeatures | null,
  hasWebsite: boolean,
  niche?: string | null,
  subNicheSlug?: string | null
): AuditChecklistResult {
  const seo: CheckResult[] = [];
  const performance: CheckResult[] = [];
  const security: CheckResult[] = [];
  const accessibility: CheckResult[] = [];
  const ux: CheckResult[] = [];
  const pwa: CheckResult[] = [];
  const form: CheckResult[] = [];

  if (!hasWebsite || !features) {
    seo.push(check("seo", "Website exists", "fail", "critical",
      "The business needs a website. Build a modern, mobile-friendly site."));

    const allChecks = [...seo];
    return {
      seo, performance, security, accessibility, ux, pwa, form,
      summary: buildSummary(allChecks),
    };
  }

  // ===== SEO CHECKS =====
  seo.push(check("seo", "Site is reachable", boolStatus(features.reachable), "critical",
    "Site must be reachable and return 200 OK."));

  seo.push(check("seo", "Title tag present", boolStatus(!!features.title), "critical",
    "Every page should have a unique <title> tag (50-60 characters)."));

  seo.push(check("seo", "Meta description present", boolStatus(!!features.metaDescription), "critical",
    "Every page should have a 150-160 character meta description."));

  seo.push(check("seo", "H1 heading present", boolStatus(!!features.h1), "critical",
    "Every page should have a single H1 heading."));

  seo.push(check("seo", "Open Graph tags", boolStatus(features.hasOpenGraph), "important",
    "Add og:title, og:description, and og:image (1200x630) tags."));

  seo.push(check("seo", "Twitter Cards", boolStatus(features.hasTwitterCards), "nice_to_have",
    "Add twitter:card, twitter:title, and twitter:description tags."));

  seo.push(check("seo", "Schema.org structured data", boolStatus(features.structuredDataPresent), "important",
    "Add schema.org types such as Organization, LocalBusiness, or Service."));

  const hasLocalBusiness = features.schemaTypes.some(
    (t) => t === "LocalBusiness" || t === "Organization"
  );
  seo.push(check("seo", "LocalBusiness/Organization schema", boolStatus(hasLocalBusiness), "important",
    "Local businesses should include LocalBusiness or Organization schema markup."));

  seo.push(check("seo", "Canonical URL", "unknown", "important",
    "Every page should declare a canonical URL to prevent duplicate content."));

  // ===== PERFORMANCE CHECKS =====
  const loadOk = features.loadTimeMs !== null && features.loadTimeMs < 3000;
  performance.push(check("performance", "Page load time < 3s",
    features.loadTimeMs !== null ? boolStatus(loadOk) : "unknown", "critical",
    `Page loaded in ${features.loadTimeMs ?? "?"}ms. Target < 2500ms (LCP).`));

  performance.push(check("performance", "HTTPS enabled", boolStatus(features.https), "critical",
    "HTTPS should be enforced with an HTTP -> HTTPS redirect."));

  performance.push(check("performance", "Responsive images", boolStatus(features.hasResponsiveImages), "important",
    "Use srcset and sizes attributes to serve images appropriate for each device."));

  performance.push(check("performance", "Font display swap", boolStatus(features.hasFontDisplay), "important",
    "Use font-display: swap to avoid FOUT during font loading."));

  const lazyIssue = features.performanceHints.some((h) => h.includes("lazy loading"));
  performance.push(check("performance", "Lazy loading enabled", boolStatus(!lazyIssue), "important",
    "Use loading='lazy' for offscreen images."));

  const preloadIssue = features.performanceHints.some((h) => h.includes("preload"));
  performance.push(check("performance", "Preload hints", boolStatus(!preloadIssue), "nice_to_have",
    "Use <link rel='preload'> for critical resources."));

  const renderBlockIssue = features.performanceHints.some((h) => h.includes("render-blocking"));
  performance.push(check("performance", "Render-blocking resources minimized", boolStatus(!renderBlockIssue), "important",
    "Reduce render-blocking CSS/JS and inline critical CSS."));

  // ===== SECURITY CHECKS =====
  security.push(check("security", "HTTPS", boolStatus(features.https), "critical",
    "An SSL certificate should be installed and all traffic should go over HTTPS."));

  security.push(check("security", "Content-Security-Policy (CSP)",
    boolStatus(features.securityHeaders.hasCSP), "important",
    "Define a CSP header with rules for script-src, style-src, and img-src."));

  security.push(check("security", "X-Frame-Options",
    boolStatus(features.securityHeaders.hasXFrameOptions), "important",
    "X-Frame-Options: DENY - protect against clickjacking attacks."));

  security.push(check("security", "X-Content-Type-Options",
    boolStatus(features.securityHeaders.hasXContentTypeOptions), "important",
    "X-Content-Type-Options: nosniff - block MIME type sniffing."));

  security.push(check("security", "Referrer-Policy",
    boolStatus(features.securityHeaders.hasReferrerPolicy), "important",
    "Define Referrer-Policy: origin-when-cross-origin."));

  security.push(check("security", "Strict-Transport-Security (HSTS)",
    boolStatus(features.securityHeaders.hasHSTS), "important",
    "Use an HSTS header to make HTTPS enforcement persistent."));

  security.push(check("security", "Permissions-Policy",
    boolStatus(features.securityHeaders.hasPermissionsPolicy), "nice_to_have",
    "Use Permissions-Policy to restrict camera, microphone, and geolocation access."));

  // ===== ACCESSIBILITY CHECKS =====
  const noA11yIssues = features.accessibilityIssues.length === 0;
  accessibility.push(check("accessibility", "Overall accessibility", boolStatus(noA11yIssues), "critical",
    features.accessibilityIssues.length > 0
      ? `Issues detected: ${features.accessibilityIssues.join("; ")}`
      : "Basic accessibility checks passed."));

  const noMissingAlt = !features.accessibilityIssues.some((i) => i.includes("alt"));
  accessibility.push(check("accessibility", "Image alt text", boolStatus(noMissingAlt), "critical",
    "All images should have meaningful alt text; decorative images should use alt=''."));

  const noMissingLabel = !features.accessibilityIssues.some((i) => i.includes("label"));
  accessibility.push(check("accessibility", "Form label association", boolStatus(noMissingLabel), "critical",
    "Every form input should be associated with a label (for/id or aria-label)."));

  const noHeadingIssue = !features.accessibilityIssues.some((i) => i.includes("h1"));
  accessibility.push(check("accessibility", "Heading hierarchy", boolStatus(noHeadingIssue), "important",
    "Heading hierarchy should be correct (single H1, H1 > H2 > H3 order)."));

  const noLangIssue = !features.accessibilityIssues.some((i) => i.includes("lang"));
  accessibility.push(check("accessibility", "HTML lang attribute", boolStatus(noLangIssue), "important",
    "Declare the page language with <html lang='en'>."));

  const noSemanticIssue = !features.accessibilityIssues.some((i) => i.includes("semantic"));
  accessibility.push(check("accessibility", "Semantic HTML", boolStatus(noSemanticIssue), "important",
    "Use semantic elements such as <header>, <nav>, <main>, <footer>, and <article>."));

  // ===== F&B NICHE CHECKS (only when niche === RESTAURANT_TECH) =====
  //
  // Generic F&B checks fire for every sub-niche, then a sub-niche-specific
  // block adds 2-4 audit signals tuned to what THAT format actually needs.
  // The sub-niche slug comes from `Lead.subNicheSlug`, populated either by
  // the rep at discovery time (MANUAL) or the FNB_SUBVERTICAL_CLASSIFIER
  // worker (AUTO). When subNicheSlug is null (parent F&B fallback) only
  // the generic block runs.
  if (niche === "RESTAURANT_TECH") {
    // -------- Generic F&B checks (apply to every sub-vertical) --------
    ux.push(check(
      "ux",
      "QR menu / digital menu",
      features.hasQrMenu ? "pass" : "fail",
      "critical",
      features.hasQrMenu
        ? `QR menu detected${features.detectedMenuTool ? ` (${features.detectedMenuTool})` : ""}.`
        : "No QR menu detected — primary sales opportunity. Customers expect to scan and order instantly.",
    ));

    // -------- Sub-niche-specific checks --------
    switch (subNicheSlug) {
      case "fnb-fine-dining":
        ux.push(check(
          "ux",
          "Premium reservation widget (OpenTable / SevenRooms / Tock)",
          features.hasOnlineReservation ? "pass" : "fail",
          "critical",
          features.hasOnlineReservation
            ? "Online reservation integration found."
            : "No premium reservation widget — fine-dining guests expect to book the room before they arrive. Tock or SevenRooms drops in.",
        ));
        ux.push(check(
          "ux",
          "Tasting menu / chef's table page",
          "unknown",
          "important",
          "Showcase the tasting menu, sommelier picks, and chef bio on a dedicated page; this is the primary conversion driver for fine dining.",
        ));
        ux.push(check(
          "ux",
          "Allergen / dietary filter on menu",
          "unknown",
          "important",
          "Add an allergen and dietary-preference filter on the digital menu — fine-dining guests expect this and it removes a service-time bottleneck.",
        ));
        break;

      case "fnb-bar-club":
        ux.push(check(
          "ux",
          "QR pay with tab / round split",
          features.hasQrMenu ? "pass" : "fail",
          "critical",
          features.hasQrMenu
            ? "QR ordering detected — confirm tab + split-bill flow is enabled in payment settings."
            : "No QR pay or tab/round-split flow. Peak-hour throughput is the bottleneck for bars; QR pay collapses the close-the-tab queue.",
        ));
        ux.push(check(
          "ux",
          "Event calendar",
          "unknown",
          "important",
          "Bars and clubs convert through events; add a calendar with DJ nights, live music, and themed events linked from the homepage.",
        ));
        ux.push(check(
          "ux",
          "Age verification step",
          "unknown",
          "nice_to_have",
          "Add an age-gate landing modal — required in many EU jurisdictions and good practice for compliance.",
        ));
        break;

      case "fnb-cafe-bakery":
        ux.push(check(
          "ux",
          "Order-ahead / mobile ordering",
          features.hasQrMenu ? "pass" : "fail",
          "critical",
          features.hasQrMenu
            ? "Mobile ordering detected."
            : "No order-ahead. Morning rush and queue length is the #1 cafe complaint — pickup ordering converts standing customers into repeat visits.",
        ));
        ux.push(check(
          "ux",
          "Loyalty program / digital stamp card",
          "unknown",
          "important",
          "Add a digital loyalty program — cafes drive 30-40% repeat-visit lift from a stamp-card flow. Tie it to the CRM so you keep customer profiles.",
        ));
        ux.push(check(
          "ux",
          "Instagram embed / latest posts",
          "unknown",
          "nice_to_have",
          "Embed the latest Instagram posts on the homepage — cafes' growth channel is Instagram and the embed brings followers back to the site.",
        ));
        break;

      case "fnb-ghost-kitchen":
        ux.push(check(
          "ux",
          "Own-brand commission-free ordering",
          features.hasDeliveryIntegration ? "pass" : "fail",
          "critical",
          features.hasDeliveryIntegration
            ? "Delivery integration found — confirm it is the venue's OWN ordering page, not just a UberEats/Deliveroo link."
            : "No own-brand ordering page. Every order routed through UberEats/Deliveroo costs ~25-30% commission; a commission-free pickup/delivery page protects margin.",
        ));
        ux.push(check(
          "ux",
          "Scheduled-pickup / delivery slots",
          "unknown",
          "important",
          "Add scheduled pickup windows so guests can order ahead — ghost kitchens that batch orders by slot run with smaller line cooks per cover.",
        ));
        break;

      case "fnb-food-truck":
        ux.push(check(
          "ux",
          "Live location / today's schedule",
          "unknown",
          "critical",
          "Food trucks live or die by 'where are you today.' Add a live location + weekly schedule page; followers should know in 1 tap whether you're nearby.",
        ));
        ux.push(check(
          "ux",
          "Mobile-first menu with QR pay",
          features.hasQrMenu ? "pass" : "fail",
          "critical",
          features.hasQrMenu
            ? "QR ordering detected — keep it cash-light to shorten the line."
            : "No mobile menu / QR pay. Cash-only food trucks lose ~40% of card-only walk-ups. A QR menu with contactless pay fixes that overnight.",
        ));
        break;

      case "fnb-hotel-fnb":
        ux.push(check(
          "ux",
          "In-room ordering / room-charge integration",
          "unknown",
          "critical",
          "Hotels: guests should be able to scan a QR in their room and bill the order to their room — this is the single biggest F&B revenue lever in hospitality.",
        ));
        ux.push(check(
          "ux",
          "Multi-outlet menu (restaurant / bar / spa)",
          "unknown",
          "important",
          "Surface every outlet — restaurant, lobby bar, spa cafe, room service — under one digital menu so guests stay on-property.",
        ));
        ux.push(check(
          "ux",
          "Reservation widget for guest dining",
          features.hasOnlineReservation ? "pass" : "fail",
          "important",
          features.hasOnlineReservation
            ? "Reservation widget found."
            : "Hotel restaurants without booking widgets leave guest-table revenue on the table — they should be able to book on arrival without calling reception.",
        ));
        ux.push(check(
          "ux",
          "Multi-language for international guests",
          "unknown",
          "important",
          "Boutique hotels need at least EN + local language toggle on the menu and reservation flow.",
        ));
        break;

      case "fnb-casual-dining":
        ux.push(check(
          "ux",
          "Online reservation system",
          features.hasOnlineReservation ? "pass" : "fail",
          "critical",
          features.hasOnlineReservation
            ? "Online reservation integration found."
            : "No online reservation system. Add OpenTable, Resy, or TheFork to drive table turns and reduce no-shows.",
        ));
        ux.push(check(
          "ux",
          "Visible table-management capability",
          "unknown",
          "important",
          "Casual dining table-turn rate is the revenue lever; show that floor staff can manage waitlist + table assignment from a single screen.",
        ));
        ux.push(check(
          "ux",
          "Family / kids menu CTA",
          "unknown",
          "nice_to_have",
          "Family-friendly venues convert better with a visible kids-menu CTA on the homepage.",
        ));
        break;

      case "fnb-qsr":
        ux.push(check(
          "ux",
          "Self-service kiosk option",
          "unknown",
          "critical",
          "QSR conversion: kiosks drive 18-22% higher average order value through combo upsells and remove the line at peak.",
        ));
        ux.push(check(
          "ux",
          "Mobile order-ahead",
          features.hasQrMenu ? "pass" : "fail",
          "critical",
          features.hasQrMenu
            ? "Mobile ordering detected."
            : "No mobile order-ahead. QSR walk-up customers expect to order on their phone and skip the queue.",
        ));
        ux.push(check(
          "ux",
          "Combo upsell / meal deal flow",
          "unknown",
          "important",
          "Add an automatic combo upsell prompt at checkout — QSR's #1 AOV lever.",
        ));
        ux.push(check(
          "ux",
          "Loyalty / app program",
          "unknown",
          "important",
          "QSR loyalty (stamp cards, BOGO offers) drives 20-30% return-visit rate; a digital CRM ties this together.",
        ));
        break;

      case "fnb-airport-fnb":
        ux.push(check(
          "ux",
          "Fast-pickup CTA + boarding-time aware ordering",
          "unknown",
          "critical",
          "Airport diners are clock-watching travelers; surface a 'pickup before boarding' prompt with order-by time tied to the gate.",
        ));
        ux.push(check(
          "ux",
          "Multi-currency / multi-language menu",
          "unknown",
          "important",
          "Airport venues serve international travelers; multi-currency display + multi-language toggle removes a friction point at checkout.",
        ));
        ux.push(check(
          "ux",
          "Kiosk for transit traffic",
          "unknown",
          "important",
          "High-throughput formats benefit from kiosks — transit travelers prefer self-service over queueing for staff.",
        ));
        break;

      case "fnb-multi-location":
        ux.push(check(
          "ux",
          "Centralised menu management across locations",
          "unknown",
          "critical",
          "Chains with 5+ locations bleed brand consistency; a single CMS that pushes menu + pricing to every site fixes this overnight.",
        ));
        ux.push(check(
          "ux",
          "Group-wide loyalty / CRM program",
          "unknown",
          "important",
          "A shared loyalty program across every location drives cross-location visit rate and gives head office a unified customer view.",
        ));
        ux.push(check(
          "ux",
          "Per-location landing pages with consistent template",
          "unknown",
          "important",
          "Generate per-location landing pages from one template with local SEO data — drives local pack rankings + brand consistency.",
        ));
        break;

      // Parent F&B (no specific sub-niche selected yet) or unrecognised
      // slug: fall back to the historic generic checks so we never
      // ship a thinner audit than the legacy single-niche behaviour.
      default:
        ux.push(check(
          "ux",
          "Online reservation system",
          features.hasOnlineReservation ? "pass" : "fail",
          "important",
          features.hasOnlineReservation
            ? "Online reservation integration found."
            : "No online reservation system. Add OpenTable, SevenRooms, or a similar integration to reduce no-shows.",
        ));
        ux.push(check(
          "ux",
          "Delivery platform integration",
          features.hasDeliveryIntegration ? "pass" : "fail",
          "nice_to_have",
          features.hasDeliveryIntegration
            ? "Delivery platform embed detected."
            : "No delivery platform link found. Consider embedding Deliveroo, Uber Eats, or a local equivalent.",
        ));
        break;
    }
  }

  // ===== UX CHECKS =====
  ux.push(check("ux", "Mobile friendly", boolStatus(features.mobileFriendlyGuess), "critical",
    "Ensure mobile friendliness with a viewport meta tag and responsive design."));

  ux.push(check("ux", "Favicon", boolStatus(features.hasFavicon), "important",
    "Provide favicon sizes: 16x16, 32x32, 180x180 (iOS), and 512x512 (Android)."));

  ux.push(check("ux", "Contact form", boolStatus(features.hasContactForm), "critical",
    "Include a contact form with email, phone, and message fields."));

  ux.push(check("ux", "WhatsApp integration", boolStatus(features.hasWhatsappLink), "important",
    "Add a WhatsApp contact link (wa.me/number)."));

  ux.push(check("ux", "Online booking system", boolStatus(features.hasBookingSystem), "important",
    "Integrate an online booking or reservation system."));

  ux.push(check("ux", "CTA (Call-to-Action) links", boolStatus(features.ctaLinks.length > 0), "critical",
    "Provide clear CTA buttons such as 'Contact Us', 'Get a Quote', or 'Book Now'."));

  ux.push(check("ux", "Navigation structure", boolStatus(features.navItems.length >= 3), "critical",
    "A clear navigation menu should include at least Home, Services, and Contact."));

  // ===== PWA CHECKS =====
  pwa.push(check("pwa", "Web App Manifest", boolStatus(features.hasManifest), "nice_to_have",
    "Add a manifest.json with PWA features (name, icons, start_url, display)."));

  pwa.push(check("pwa", "Service Worker", boolStatus(features.hasServiceWorker), "nice_to_have",
    "Add a service worker for offline support and a caching strategy."));

  // ===== FORM CHECKS =====
  form.push(check("form", "Contact form present", boolStatus(features.hasContactForm), "critical",
    "The business should have a contact form (name, email, phone, message)."));

  form.push(check("form", "Privacy / GDPR compliance", "unknown", "critical",
    "Forms should include a privacy/GDPR consent checkbox and a link to the privacy policy."));

  form.push(check("form", "Spam protection (honeypot/captcha)", "unknown", "important",
    "Add bot protection via a honeypot field or reCAPTCHA."));

  // ===== ANALYTICS =====
  seo.push(check("seo", "Google Analytics / Tag Manager", boolStatus(features.hasGoogleAnalytics), "critical",
    "Integrate GA4 or GTM with pageview and event tracking."));

  seo.push(check("seo", "Cookie consent banner", boolStatus(features.hasCookieConsent), "important",
    "Add a GDPR-compliant cookie consent banner."));

  const allChecks = [
    ...seo, ...performance, ...security,
    ...accessibility, ...ux, ...pwa, ...form,
  ];

  return {
    seo, performance, security, accessibility, ux, pwa, form,
    summary: buildSummary(allChecks),
  };
}

function buildSummary(checks: CheckResult[]) {
  const totalChecks = checks.length;
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;
  const unknown = checks.filter((c) => c.status === "unknown").length;
  const scorable = totalChecks - unknown;
  const scorePercent = scorable > 0 ? Math.round((passed / scorable) * 100) : 0;

  return { totalChecks, passed, failed, unknown, scorePercent };
}

export function formatChecklistForPrompt(result: AuditChecklistResult): string {
  const lines: string[] = [];
  lines.push(`## Audit summary: ${result.summary.passed}/${result.summary.totalChecks - result.summary.unknown} passed (${result.summary.scorePercent}%)\n`);

  const categories: { key: keyof Omit<AuditChecklistResult, "summary">; label: string }[] = [
    { key: "seo", label: "SEO and Metadata" },
    { key: "performance", label: "Performance" },
    { key: "security", label: "Security" },
    { key: "accessibility", label: "Accessibility" },
    { key: "ux", label: "User Experience (UX)" },
    { key: "pwa", label: "PWA" },
    { key: "form", label: "Form Management" },
  ];

  for (const { key, label } of categories) {
    const checks = result[key];
    if (checks.length === 0) continue;

    const passCount = checks.filter((c) => c.status === "pass").length;
    lines.push(`### ${label} (${passCount}/${checks.length})`);
    for (const c of checks) {
      const icon = c.status === "pass" ? "[PASS]" : c.status === "fail" ? "[FAIL]" : "[UNKNOWN]";
      const pri = c.priority === "critical" ? "(CRITICAL)" : c.priority === "important" ? "(IMPORTANT)" : "(NICE TO HAVE)";
      lines.push(`${icon} ${pri} ${c.item}`);
      if (c.status !== "pass") {
        lines.push(`  -> Recommendation: ${c.recommendation}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
