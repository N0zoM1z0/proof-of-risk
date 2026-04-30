import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../src/App";
import { VisualSlice } from "../src/ui/VisualSlice";

describe("UI smoke coverage", () => {
  it("renders the 2.5D visual slice without browser-only APIs", () => {
    const html = renderToString(<VisualSlice />);

    expect(html).toContain("Academy risk floor");
    expect(html).toContain("Perspective risk table");
    expect(html).toContain("Evidence Board");
  });

  it("renders the app shell with all phase panels", () => {
    const html = renderToString(<App />);

    expect(html).toContain("Ballot RPS");
    expect(html).toContain("Room Flow Console");
    expect(html).toContain("Zero Nim");
    expect(html).toContain("Greater Good");
    expect(html).toContain("Deterministic simulation snapshot");
    expect(html).toContain("Auction and probability tutorials");
    expect(html).toContain("Gamble Lab");
  });
});
