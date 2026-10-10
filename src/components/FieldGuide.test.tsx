import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Journal from "./Journal";
import FieldGuide from "./FieldGuide";

describe("journal reference presentation", () => {
  it("offers a discoverable guide from an empty journal and disables blank observations", () => {
    const html = renderToStaticMarkup(<Journal entries={[]} onClose={() => undefined} onAddNote={() => undefined} />);
    expect(html).toContain("Field guide");
    expect(html).toContain("Explore first steps");
    expect(html).toContain('aria-label="Record status"');
    expect(html).toContain('aria-label="Record order"');
    expect(html).toContain("0 / 1200 characters");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>WRITE<\/button>/);
  });

  it("announces onboarding progress from journal evidence and uses local imagery", () => {
    const html = renderToStaticMarkup(<FieldGuide entries={[{ id: "personal:1", title: "My observations", text: "A landmark." }]} />);
    expect(html).toContain('aria-label="Search field guide"');
    expect(html).toContain("1 of 6 first steps recorded");
    expect(html).toContain('value="1" max="6"');
    expect(html).toContain("Optional suggestions; there is no required order.");
    expect(html).toContain("journal.png");
    expect(html).not.toContain("http");
  });
});
