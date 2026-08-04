import { beforeEach, describe, expect, it } from "vitest"
import { tokenStore } from "./token-store"

describe("tokenStore", () => {
  beforeEach(() => localStorage.clear())
  it("persists and clears the access token", () => {
    expect(tokenStore.get()).toBeNull()
    tokenStore.set("test-token")
    expect(tokenStore.get()).toBe("test-token")
    tokenStore.clear()
    expect(tokenStore.get()).toBeNull()
  })
})
