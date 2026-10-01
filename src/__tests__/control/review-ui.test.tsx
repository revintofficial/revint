// @vitest-environment happy-dom
// Register the jest-dom matchers here as well as in setup.ts: when this file
// runs in a worker whose setup registered them on a different `expect`
// instance, toHaveValue / toBeDisabled / toBeInTheDocument were reported as
// "Invalid Chai property". Importing the vitest entry is idempotent.
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { toDecisionCard } from "@/lib/control/decision";
import { buildShelf } from "@/lib/control/evidence-shelf";
import { RUBRIC, RUBRIC_VERSION } from "@/lib/control/rubric";
import { ReviewInbox, type ReviewSelection } from "@/components/admin/control-review-panel";
import type { ReviewView, ReviewViewRow } from "@/lib/control/review";

vi.stubGlobal("React", React);
const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => {
    if (url === "/api/admin/control/golden/preview") return new Response(JSON.stringify({ passed: true, failures: [] }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, id: "r_new" }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const FINISHED = "2026-09-28T10:00:00.000Z";
const output = {
  briefMode: "head-agent",
  salesConfidence: 87,
  headline: "Burger House",
  headAgent: {
    recommendedPackage: "growth", wedge: "reservation", primaryAngle: "Rezervasyon → Growth",
    recommendedModules: [{ module: "reservation" }], talkTrack: "Rezervasyonu tek yerden yönetin.",
    roomOne: { plan: "growth", wedge: "reservation", evidence: ["https://burger.example — rezervasyon formu yok"], bans: [], backup: null },
  },
};
const decision = toDecisionCard(output, { finishedAt: FINISHED, locationCount: 1 });
const lead = { websiteUrl: "https://burger.example", googleMapsUri: "https://maps.google.com/?cid=9", address: "1 High St", rating: 4.4, reviewCount: 310 };
const drawers = buildShelf({
  runs: [{ workerKind: "LEAD_INTELLIGENCE_BRIEF", status: "SUCCEEDED", finishedAt: FINISHED, output, errorMsg: null }],
  card: decision, lead, locationCount: 1,
});

function reviewRow(over: Partial<ReviewViewRow>): ReviewViewRow {
  return { id: "r1", lens: "TECHNICAL", source: "LENS", verdict: "PASS", errorClass: null, severity: null, note: null, createdAt: FINISHED, rubricVersion: RUBRIC_VERSION, reviewSeconds: 60, ...over };
}
function view(over: Partial<ReviewView> = {}): ReviewView {
  return { agentRunId: "run", lens: "DOMAIN", rubricVersion: RUBRIC_VERSION, ownReview: null, revealed: false, priorReviews: [], sdrReviews: [], adjudications: [], missingLenses: [], missingLensNames: [], ...over };
}
function selection(v: ReviewView): ReviewSelection {
  return { businessName: "Burger House", lead, decision, drawers, agentRunId: "run", view: v, nextLeadId: null };
}
const complete = view({
  lens: "DOMAIN",
  ownReview: reviewRow({ id: "own", lens: "DOMAIN" }),
  revealed: true,
  priorReviews: [reviewRow({ id: "t", lens: "TECHNICAL" }), reviewRow({ id: "s", lens: "SALES" })],
});

describe("review card", () => {
  it("keeps completed cards reachable with an empty queue and previews the rules on the server", async () => {
    render(<ReviewInbox workspaceId="ws" canReview lens="DOMAIN" queue={[]} selectedLeadId="lead" selected={selection(complete)} />);
    fireEvent.click(screen.getByRole("button", { name: "Referans vaka yap" }));
    expect(screen.getByLabelText("Vaka başlığı")).toHaveValue("Burger House");
    expect(screen.getByLabelText("Puan alt sınırı")).toHaveValue("");
    expect(screen.queryByRole("textbox", { name: /json/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Beklenen paket"), { target: { value: "growth" } });
    fireEvent.change(screen.getByLabelText("Beklenen kaçak"), { target: { value: "reservation" } });
    await waitFor(() => expect(screen.getByText("Bu kurallarla donmuş çıktı geçer")).toBeInTheDocument());
    const previewCall = fetchMock.mock.calls.filter(([url]) => url === "/api/admin/control/golden/preview").at(-1)!;
    expect(JSON.parse(previewCall[1].body)).toEqual({
      workspaceId: "ws", agentRunId: "run",
      expected: { expectedPackage: "growth", expectedWedge: "reservation", allowedModules: [], forbiddenClaims: [], forbiddenAngles: [] },
    });
    expect(screen.getByText("Alan merceği: yalnızca kendi hükmünü kaydet.")).toBeInTheDocument();
  });

  it("shows the server's reason when the preview fails, and adds forbidden claims one by one", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ passed: false, failures: [{ code: "PACKAGE", message: "Kalır, çünkü paket yanlış: Kart: Growth · Beklenen: Starter" }] }), { status: 200 }));
    render(<ReviewInbox workspaceId="ws" canReview lens="DOMAIN" queue={[]} selectedLeadId="lead" selected={selection(complete)} />);
    fireEvent.click(screen.getByRole("button", { name: "Referans vaka yap" }));
    fireEvent.change(screen.getByLabelText(/^Yasak iddialar/), { target: { value: "gelirinizi, kesin, artırır" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Ekle" })[0]);
    await waitFor(() => expect(screen.getByText(/Kalır, çünkü paket yanlış/)).toBeInTheDocument());
    const body = JSON.parse(fetchMock.mock.calls.at(-1)![1].body);
    expect(body.expected.forbiddenClaims).toEqual(["gelirinizi, kesin, artırır"]);
  });

  it("names the missing lens and keeps promotion closed", () => {
    render(<ReviewInbox workspaceId="ws" canReview lens="TECHNICAL" queue={[]} selectedLeadId="lead" selected={selection(view({ lens: "TECHNICAL", ownReview: reviewRow({ id: "own" }), revealed: true, missingLenses: ["SALES"], missingLensNames: ["Satış"] }))} />);
    expect(screen.getByRole("button", { name: "Referans vaka yap" })).toBeDisabled();
    expect(screen.getByText(/Eksik mercekler: Satış/)).toBeInTheDocument();
    expect(screen.getByText("Satış bakmadı.")).toBeInTheDocument();
  });

  it("a null lens cannot submit a verdict and says why", () => {
    render(<ReviewInbox workspaceId="ws" canReview={false} lens={null} queue={[]} selectedLeadId="lead" selected={selection(view({ lens: null, revealed: true }))} />);
    expect(screen.getByText("Sana bir mercek atanmadı.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kararı kaydet" })).toBeDisabled();
    expect(screen.getByText(/mercek ataması gerekir/)).toBeInTheDocument();
  });

  it("renders four drawers in the sales order", () => {
    render(<ReviewInbox workspaceId="ws" canReview lens="SALES" queue={[]} selectedLeadId="lead" selected={selection(view({ lens: "SALES" }))} />);
    const order = screen.getAllByTestId("shelf-drawer").map(el => el.getAttribute("data-drawer"));
    expect(order).toEqual(["decision", "reviews", "site", "map"]);
    expect(screen.getByRole("link", { name: "Siteyi aç" })).toHaveAttribute("href", "https://burger.example");
    expect(screen.getByRole("link", { name: "Haritada aç" })).toHaveAttribute("href", "https://maps.google.com/?cid=9");
  });

  it("does not render prior verdicts before this lens has written one", () => {
    // buildReviewView already strips them; the card must not invent any and must say why.
    const hidden = view({ lens: "SALES", revealed: false, missingLenses: ["TECHNICAL", "DOMAIN"], missingLensNames: ["Teknik", "Alan"] });
    render(<ReviewInbox workspaceId="ws" canReview lens="SALES" queue={[]} selectedLeadId="lead" selected={selection(hidden)} />);
    const verdicts = screen.getByTestId("verdicts");
    expect(within(verdicts).getByText("Teknik ve Alan bakmadı.")).toBeInTheDocument();
    expect(within(verdicts).getByText(/sen kendi hükmünü kaydedince açılır/)).toBeInTheDocument();
    expect(within(verdicts).queryByText(/^(Teknik|Alan|Satış): |^SDR geri bildirimi \(|^Uzlaştırma \(/)).not.toBeInTheDocument();
  });

  it("shows other lenses, SDR and adjudication once this lens has voted, labelled by source", () => {
    const revealed = view({
      lens: "SALES", revealed: true, ownReview: reviewRow({ id: "own", lens: "SALES" }),
      priorReviews: [reviewRow({ id: "t", lens: "TECHNICAL", verdict: "FAIL", errorClass: "STALE_SOURCE", severity: "P1", note: "eski site" })],
      sdrReviews: [reviewRow({ id: "sdr", lens: null, source: "SDR", verdict: "FAIL", errorClass: "UNSUPPORTED_CLAIM", rubricVersion: "sdr" })],
      adjudications: [reviewRow({ id: "adj", lens: null, source: "ADJUDICATION", verdict: "PASS", note: "uzlaştık" })],
      missingLenses: ["DOMAIN"], missingLensNames: ["Alan"],
    });
    render(<ReviewInbox workspaceId="ws" canReview lens="SALES" queue={[]} selectedLeadId="lead" selected={selection(revealed)} />);
    expect(screen.getByText(/^Teknik: Kaldı · Kaynak eski/)).toBeInTheDocument();
    expect(screen.getByText(/SDR geri bildirimi \(kapıya sayılmaz\): SDR kullanmadı: iddia dayanaksız\./)).toBeInTheDocument();
    expect(screen.getByText(/Uzlaştırma \(yönetici\): Geçti — uzlaştık/)).toBeInTheDocument();
  });

  it("shows the rubric version on the card", () => {
    render(<ReviewInbox workspaceId="ws" canReview lens="DOMAIN" queue={[]} selectedLeadId="lead" selected={selection(view())} />);
    expect(screen.getByText(new RegExp(`Rubrik sürümü ${RUBRIC_VERSION.replace(/\./g, "\\.")}`))).toBeInTheDocument();
  });

  it("shows the rubric include and exclude rule next to each error class of the lens", () => {
    render(<ReviewInbox workspaceId="ws" canReview lens="TECHNICAL" queue={[]} selectedLeadId="lead" selected={selection(view({ lens: "TECHNICAL" }))} />);
    fireEvent.click(screen.getByRole("button", { name: "Kaldı" }));
    expect(screen.getAllByRole("radio")).toHaveLength(RUBRIC.TECHNICAL.length);
    for (const entry of RUBRIC.TECHNICAL) {
      expect(screen.getByText(`Seç: ${entry.include}`)).toBeInTheDocument();
      expect(screen.getByText(`Seçme: ${entry.exclude}`)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Kararı kaydet" })).toBeDisabled();
    expect(screen.getByText("Kaldı için sınıf, ciddiyet, not gerekir.")).toBeInTheDocument();
  });

  it("sends the seconds since the card opened with the verdict", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    render(<ReviewInbox workspaceId="ws" canReview lens="DOMAIN" queue={[]} selectedLeadId="lead" selected={selection(view())} />);
    now.mockReturnValue(1_074_000);
    fireEvent.click(screen.getByRole("button", { name: "Kararı kaydet" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/control/reviews", expect.anything()));
    const body = JSON.parse(fetchMock.mock.calls.find(([url]) => url === "/api/admin/control/reviews")![1].body);
    expect(body).toMatchObject({ workspaceId: "ws", leadId: "lead", agentRunId: "run", verdict: "PASS", lens: "DOMAIN", reviewSeconds: 74 });
  });

  it("puts the SDR badge on a flagged queue row", () => {
    render(<ReviewInbox workspaceId="ws" canReview lens="DOMAIN" selectedLeadId={null} selected={null} queue={[
      { leadId: "l1", businessName: "Dishoom", salesConfidence: 70, primaryModule: "reservation", missingLenses: ["SALES"], sdrFlag: "UNSUPPORTED_CLAIM" },
      { leadId: "l2", businessName: "Bianco43", salesConfidence: 50, primaryModule: null, missingLenses: ["SALES"], sdrFlag: null },
    ]} />);
    expect(screen.getByText("SDR kullanmadı: iddia dayanaksız.")).toBeInTheDocument();
    expect(screen.getAllByText(/SDR kullanmadı/)).toHaveLength(1);
  });
});
