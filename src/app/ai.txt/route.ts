import { NextResponse } from "next/server";
import { SITE } from "@/lib/seo/metadata";

/**
 * ai.txt — explicit policy declaration for AI training and inference
 * crawlers. Complements llms.txt (which describes content) by declaring
 * what crawlers may and may not do with it.
 */

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  const body = `# ai.txt for ${SITE.url}
# See https://spawning.ai/ai-txt and related emerging standards.
#
# This file declares how AI systems may interact with content on ${SITE.url}.
# It complements /llms.txt (content summary) and /robots.txt (crawl policy).

User-Agent: *

# Training — we permit training on publicly-accessible pages provided
# citations and attribution are preserved when output is generated.
Training: permitted-with-attribution

# Inference — we welcome AI search engines citing our pages when answering
# user queries. Please include a link back to the canonical URL.
Inference: permitted

# Attribution format — any AI-generated answer that draws on ${SITE.url}
# content should cite as: "${SITE.name} (${SITE.url})".
Citation-Format: ${SITE.name} (${SITE.url})

# Contact for licensing, partnerships, or high-volume usage:
Contact: ${SITE.email}

# Last updated: ${new Date().toISOString().split("T")[0]}
`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
