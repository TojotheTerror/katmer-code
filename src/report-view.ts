import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_REPORT = "katmer-report-view";

export class ReportView extends ItemView {
  filePath = "";
  fileName = "";
  private frameEl: HTMLIFrameElement | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() { return VIEW_TYPE_REPORT; }
  getDisplayText() { return this.fileName || "Report"; }
  getIcon() { return "file-chart"; }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("katmer-report-root");
    this.frameEl = container.createEl("iframe", {
      cls: "katmer-report-frame",
      attr: { sandbox: "allow-scripts allow-same-origin", frameborder: "0" },
    });
    if (this.filePath) this.loadReport(this.filePath);
  }

  async loadReport(filePath: string) {
    this.filePath = filePath;
    this.fileName = filePath.split("/").pop() || "Report";
    (this.leaf as any).updateHeader?.();
    try {
      const content = require("fs").readFileSync(filePath, "utf-8");
      if (this.frameEl) this.frameEl.srcdoc = content;
    } catch {
      const container = this.containerEl.children[1] as HTMLElement;
      container.empty();
      container.createEl("div", {
        cls: "katmer-report-error",
        text: "Could not load: " + filePath,
      });
    }
  }

  async onClose() {}
}
