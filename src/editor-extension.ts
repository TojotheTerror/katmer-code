import { StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, WidgetType, EditorView } from "@codemirror/view";

// ── Effects ──

export interface InlineDiffData {
  from: number;       // start of new_string in doc
  to: number;         // end of new_string in doc
  oldText: string;    // what was replaced
  newText: string;    // what replaced it
  onAccept: () => void;
  onReject: (view: EditorView) => void;
}

export const addInlineDiff = StateEffect.define<InlineDiffData>();
export const clearInlineDiff = StateEffect.define<void>();

// ── Word-level diff ──

function commonPrefix(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function commonSuffix(a: string, b: string, maxLen: number): number {
  let i = 0;
  while (
    i < a.length && i < b.length && i < maxLen &&
    a[a.length - 1 - i] === b[b.length - 1 - i]
  ) i++;
  return i;
}

// ── Widgets ──

/** Inline strikethrough showing deleted text — sits right in the text flow */
class DeletedTextWidget extends WidgetType {
  constructor(readonly text: string) { super(); }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cc-deleted-inline";
    span.textContent = this.text;
    return span;
  }

  ignoreEvent() { return true; }
}

/** Accept/Undo buttons shown as a small inline widget after the change */
class DiffActionsWidget extends WidgetType {
  constructor(
    private onAccept: () => void,
    private onReject: (view: EditorView) => void
  ) { super(); }

  toDOM(view: EditorView): HTMLElement {
    const wrap = document.createElement("span");
    wrap.className = "cc-diff-actions-inline";

    const accept = document.createElement("button");
    accept.className = "cc-action-btn cc-action-accept";
    accept.textContent = "✓";
    accept.title = "Accept change";
    accept.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: clearInlineDiff.of() });
      this.onAccept();
    });

    const reject = document.createElement("button");
    reject.className = "cc-action-btn cc-action-reject";
    reject.textContent = "✕";
    reject.title = "Undo change";
    reject.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onReject(view);
      view.dispatch({ effects: clearInlineDiff.of() });
    });

    wrap.appendChild(accept);
    wrap.appendChild(reject);
    return wrap;
  }

  ignoreEvent() { return false; }
}

// ── State Field ──

export const inlineDiffField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },

  update(decos, tr) {
    decos = decos.map(tr.changes);

    for (const effect of tr.effects) {
      if (effect.is(addInlineDiff)) {
        const { from, to, oldText, newText, onAccept, onReject } = effect.value;
        const builder = new RangeSetBuilder<Decoration>();

        // Find common prefix/suffix to isolate the actual change
        const prefixLen = commonPrefix(oldText, newText);
        const suffixLen = commonSuffix(oldText, newText, Math.min(oldText.length - prefixLen, newText.length - prefixLen));

        const oldChanged = oldText.slice(prefixLen, oldText.length - suffixLen);
        const newChanged = newText.slice(prefixLen, newText.length - suffixLen);

        // Position of the changed part within the document
        const changeFrom = from + prefixLen;
        const changeTo = to - suffixLen;

        if (oldChanged.length > 0) {
          // Inline widget showing deleted text (strikethrough) right before the new text
          builder.add(changeFrom, changeFrom, Decoration.widget({
            widget: new DeletedTextWidget(oldChanged),
            side: -1, // before
          }));
        }

        if (newChanged.length > 0) {
          // Mark the new/changed portion with highlight
          builder.add(changeFrom, changeTo, Decoration.mark({
            class: "cc-inserted-inline",
          }));
        }

        // Action buttons after the changed region
        builder.add(changeTo, changeTo, Decoration.widget({
          widget: new DiffActionsWidget(onAccept, onReject),
          side: 1,
        }));

        decos = builder.finish();
      }

      if (effect.is(clearInlineDiff)) {
        decos = Decoration.none;
      }
    }

    return decos;
  },

  provide(field) {
    return EditorView.decorations.from(field);
  },
});
