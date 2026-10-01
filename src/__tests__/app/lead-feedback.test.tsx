// @vitest-environment happy-dom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LeadFeedback } from "@/components/app/lead-feedback";
import { SDR_REASON_OPTIONS } from "@/lib/control/labels";

vi.stubGlobal("React", React);
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, id: "hr_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

const lastBody = () => JSON.parse(fetchMock.mock.calls.at(-1)![1].body);

describe("LeadFeedback", () => {
  it("records a used brief with one click, thanks the SDR and disables the buttons", async () => {
    render(<LeadFeedback leadId="lead_1" agentRunId="run_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Bu brief'i kullandım" }));
    await waitFor(() => expect(screen.getByText("Teşekkürler, kaydedildi")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/leads/lead_1/feedback", expect.objectContaining({ method: "POST" }));
    expect(lastBody()).toEqual({ agentRunId: "run_1", used: true, reason: null, note: null });
    expect(screen.getByRole("button", { name: "Bu brief'i kullandım" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Kullanmadım" })).toBeDisabled();
  });

  it("asks for one of six reasons when the brief was not used, with an optional note", async () => {
    render(<LeadFeedback leadId="lead_1" agentRunId="run_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Kullanmadım" }));
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(6);
    expect(SDR_REASON_OPTIONS.map(o => o.label)).toEqual(["Yanlış işletme", "Kaynak eski", "İddia dayanaksız", "Paket uymuyor", "Zaten müşteri", "Hedef profil değil"]);
    expect(screen.getByPlaceholderText("istersen tek cümle")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Kaydet" })).toBeDisabled();
    expect(screen.getByText("Bir neden seç.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("İddia dayanaksız"));
    fireEvent.change(screen.getByPlaceholderText("istersen tek cümle"), { target: { value: "Park sorunu yorumlarda yok." } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));
    await waitFor(() => expect(screen.getByText("Teşekkürler, kaydedildi")).toBeInTheDocument());
    expect(lastBody()).toEqual({ agentRunId: "run_1", used: false, reason: "UNSUPPORTED_CLAIM", note: "Park sorunu yorumlarda yok." });
    expect(screen.getByRole("button", { name: "Kullanmadım" })).toBeDisabled();
  });

  it("shows the server error and lets the SDR try again", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: "Kullanmadıysan bir neden seç." }), { status: 400 }));
    render(<LeadFeedback leadId="lead_1" agentRunId="run_1" />);
    fireEvent.click(screen.getByRole("button", { name: "Bu brief'i kullandım" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Kullanmadıysan bir neden seç."));
    expect(screen.getByRole("button", { name: "Bu brief'i kullandım" })).not.toBeDisabled();
  });
});
