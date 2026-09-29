// @vitest-environment happy-dom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { toDecisionCard } from "@/lib/control/decision";
import { ReviewInbox } from "@/components/admin/control-review-panel";
vi.stubGlobal("React", React);
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
afterEach(cleanup);
const output = { salesConfidence: 87, headline: "Burger House", headAgent: { recommendedModules: [{ module: "order_and_pay" }, { module: "crm_loyalty" }], talkTrack: "A useful conversation for this business.", primaryAngle: "Repeat customers" } };
const selected = { businessName: "Burger House", decision: toDecisionCard(output), output, agentRunId: "run", reviews: [], nextLeadId: null, missingLenses: [] };
it("keeps completed cards reachable with an empty queue and previews the primary module rule", () => {
 render(<ReviewInbox workspaceId="ws" canReview lens="DOMAIN" queue={[]} selectedLeadId="lead" selected={selected} />);
 fireEvent.click(screen.getByRole("button", { name: "Referans vaka yap" }));
 expect(screen.getByLabelText("Vaka başlığı")).toHaveValue("Burger House");
 expect(screen.getByLabelText("Puan alt sınırı")).toHaveValue("");
 fireEvent.click(screen.getByRole("checkbox", { name: "CRM ve sadakat" }));
 expect(screen.queryByText("Bu kurallarla donmuş çıktı geçer")).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole("checkbox", { name: "Sipariş ve ödeme" }));
 expect(screen.getByText("Bu kurallarla donmuş çıktı geçer")).toBeInTheDocument();
 expect(screen.getByText("Alan merceği: yalnızca kendi hükmünü kaydet.")).toBeInTheDocument();
});
it("names the missing lens and keeps promotion closed", () => {
 render(<ReviewInbox workspaceId="ws" canReview lens="TECHNICAL" queue={[]} selectedLeadId="lead" selected={{ ...selected, missingLenses: ["SALES"] }} />);
 expect(screen.getByRole("button", { name: "Referans vaka yap" })).toBeDisabled();
 expect(screen.getByText(/Eksik mercekler: Satış/)).toBeInTheDocument();
});
it("a null lens cannot submit a verdict", () => {
 render(<ReviewInbox workspaceId="ws" canReview={false} lens={null} queue={[]} selectedLeadId="lead" selected={selected} />);
 expect(screen.getByText("Sana bir mercek atanmadı.")).toBeInTheDocument();
 expect(screen.getByRole("button", { name: "Kararı kaydet" })).toBeDisabled();
});