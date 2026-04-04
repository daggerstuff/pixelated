import { describe, expect, it } from "vitest"
import { unescapeHTML } from "./common"

describe("common utilities", () => {
  it("unescapes HTML entities in VNode children", () => {
    const node = {
      type: "div",
      children: "&lt;b&gt;bold&lt;/b&gt; &amp; beautiful",
    }
    const result = unescapeHTML(node)
    expect(result.children).toBe("<b>bold</b> & beautiful")
  })
})
