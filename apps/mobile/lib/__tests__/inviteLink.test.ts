import { describe, expect, it } from "vitest";
import { inviteRedirect } from "../inviteLink";

const id = "487b6080-9cd3-438d-abc2-e0d9daeaac0b";

describe("inviteRedirect", () => {
  it("sends an invite link to its table", () => {
    expect(inviteRedirect(`https://playcapi.com/?join=${id}`)).toBe(`/game/${id}`);
    expect(inviteRedirect(`https://playcapi.com/?join=${id}&code=T3DJ4T`)).toBe(`/game/${id}`);
    expect(inviteRedirect(`https://playcapi.com?join=${id}`)).toBe(`/game/${id}`);
    expect(inviteRedirect(`capi://?join=${id}`)).toBe(`/game/${id}`);
    expect(inviteRedirect(`/?join=${id}`)).toBe(`/game/${id}`);
  });

  it("finds join after other query items", () => {
    expect(inviteRedirect(`https://playcapi.com/?code=T3DJ4T&join=${id}`)).toBe(`/game/${id}`);
  });

  it("leaves every other link alone", () => {
    const seat = `capi://game/${id}?p=4d3ec6ca-1a09-475c-9357-704c85ebc605&seat=n`;
    expect(inviteRedirect(seat)).toBe(seat);
    expect(inviteRedirect(`https://playcapi.com/game/${id}`)).toBe(`https://playcapi.com/game/${id}`);
    expect(inviteRedirect("https://playcapi.com/rules")).toBe("https://playcapi.com/rules");
    expect(inviteRedirect("/")).toBe("/");
    expect(inviteRedirect("capi://")).toBe("capi://");
  });

  it("ignores a join value that is not a table id", () => {
    expect(inviteRedirect("https://playcapi.com/?join=abc")).toBe("https://playcapi.com/?join=abc");
    expect(inviteRedirect("https://playcapi.com/?join=")).toBe("https://playcapi.com/?join=");
  });
});
