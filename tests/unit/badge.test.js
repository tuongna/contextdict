import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock self and chrome APIs before importing service-worker
globalThis.self = globalThis;
globalThis.chrome = {
  action: {
    setBadgeText: vi.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
    setBadgeTextColor: vi.fn().mockResolvedValue(undefined),
    setTitle: vi.fn().mockResolvedValue(undefined),
  },
  runtime: {
    onStartup: { addListener: vi.fn() },
    onInstalled: { addListener: vi.fn() },
    onMessage: { addListener: vi.fn() },
  },
  alarms: {
    create: vi.fn(),
    onAlarm: { addListener: vi.fn() },
  },
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    local: {
      get: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
  tabs: {
    query: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue(undefined),
  },
};

import { updateActionBadge } from "../../background/service-worker.js";

describe("Extension Action Badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should set green ON badge and active title when enabled is true", async () => {
    await updateActionBadge(true);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "ON" });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: "#10B981",
    });
    expect(chrome.action.setBadgeTextColor).toHaveBeenCalledWith({
      color: "#FFFFFF",
    });
    expect(chrome.action.setTitle).toHaveBeenCalledWith({
      title: "ContextDict: Bật (Sẵn sàng tra từ khi rê chuột)",
    });
  });

  it("should set gray OFF badge and inactive title when enabled is false", async () => {
    await updateActionBadge(false);

    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "OFF" });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
      color: "#64748B",
    });
    expect(chrome.action.setBadgeTextColor).toHaveBeenCalledWith({
      color: "#FFFFFF",
    });
    expect(chrome.action.setTitle).toHaveBeenCalledWith({
      title: "ContextDict: Đang tắt (Nhấn vào biểu tượng để bật)",
    });
  });

  it("should not throw error if chrome.action is unavailable", async () => {
    const originalAction = chrome.action;
    chrome.action = undefined;

    await expect(updateActionBadge(true)).resolves.not.toThrow();

    chrome.action = originalAction;
  });
});
