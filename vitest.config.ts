import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // V3.7: 排除 git worktree copies in .claude/worktrees/ — 否則同一 test 跑 N 份
    // + 主 branch test 更新後 worktree 仍跑舊版本 → false-positive failures。
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**"],
  },
});
