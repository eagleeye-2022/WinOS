import { describe, expect, it } from "vitest";
import { toTitleCaseText } from "@/lib/title-case";

describe("toTitleCaseText", () => {
  it("capitalises every word except small joining words", () => {
    expect(toTitleCaseText("submit your daily report before the end of the day")).toBe(
      "Submit Your Daily Report Before the End of the Day"
    );
    expect(toTitleCaseText("Fix Login And Signup")).toBe("Fix Login and Signup");
  });

  it("capitalises a small word when it starts the text or a sentence", () => {
    expect(toTitleCaseText("the plan is ready. and then we ship")).toBe("The Plan Is Ready. And Then We Ship");
    expect(toTitleCaseText("of note", false)).toBe("of Note");
  });

  it("leaves fully capitalised and intentionally mixed-case words alone", () => {
    expect(toTitleCaseText("NAT task for the SMM team")).toBe("NAT Task for the SMM Team");
    expect(toTitleCaseText("open WinOS on your iPhone")).toBe("Open WinOS on Your iPhone");
  });

  it("leaves technical chunks alone", () => {
    expect(toTitleCaseText("email mohit@eagleeyedigital.io about EEDP-3-T5.1")).toBe(
      "Email mohit@eagleeyedigital.io About EEDP-3-T5.1"
    );
    expect(toTitleCaseText("see https://example.com/path at 10:30 am")).toBe("See https://example.com/path at 10:30 AM");
  });

  it("leaves the tail of a word split across text nodes alone (Task + s)", () => {
    expect(toTitleCaseText("s", false, true)).toBe("s");
    expect(toTitleCaseText("s planned for today", false, true)).toBe("s Planned for Today");
  });

  it("writes am/pm after a time in capitals but leaves the word 'am' alone", () => {
    expect(toTitleCaseText("meeting at 6 pm")).toBe("Meeting at 6 PM");
    expect(toTitleCaseText("i am here")).toBe("I Am Here");
  });

  it("keeps punctuation and spacing, and only changes letter case", () => {
    const input = "  (hello),  world!  don't stop ";
    const out = toTitleCaseText(input);
    expect(out).toBe("  (Hello),  World!  Don't Stop ");
    expect(out.length).toBe(input.length);
  });
});
