/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

/* Automatic formatting

The idea is you type some markdown in a text cell, then space, and
if the markdown processor does something nontrivial given that text,
then the text gets replaced by the result.

The actual implementation of this is **much deeper** than what is done
in the "shortcuts" slatejs demo here

    https://www.slatejs.org/examples/markdown-shortcuts

in two ways:

1. This automatically supports everything the markdown-to-slate
implementation supports.  Instead of having to reimplement bits
and pieces of markdown that we think of, we automatically get
absolutely everything the processor supports with 100% correct
results.  If at any point we ever add a new plugin to markdown-it,
or change options, they just automatically work.

2. We use our slate-diff implementation to make the transformation
rather than coding it up for different special cases.  This slate-diff
is itself  deep, being based on diff-match-patch, and using numerous
heuristics.
*/

import { Editor, Operation, Transforms, Range, Point, Text } from "slate";
import { len } from "smc-util/misc";
import { markdown_to_slate } from "../markdown-to-slate";
import { applyOperations } from "../operations";
import { slateDiff } from "../slate-diff";
import { getRules } from "../elements";
import { moveCursorToEndOfElement } from "../control";
import { ReactEditor } from "../slate-react";
import { SlateEditor } from "../editable-markdown";

export const withInsertText = (editor) => {
  const { insertText } = editor;

  editor.insertText = (text, autoFormat?) => {
    if (!autoFormat) {
      insertText(text);
      return;
    }
    const { selection } = editor;

    if (text === " " && selection && Range.isCollapsed(selection)) {
      insertText(text);
      markdownReplace(editor);
      return;
    }
    insertText(text);
  };

  return editor;
};

async function markdownReplace(editor: SlateEditor): Promise<boolean> {
  const { selection } = editor;
  if (!selection) return false;
  const [node, path] = Editor.node(editor, selection.focus);
  // Must be a text node
  if (!Text.isText(node)) return false;
  // Cursor must be at the end of the text node (except for whitespace):
  if (selection.focus.offset < node.text.trimRight().length) return false;

  const pos = path[path.length - 1]; // position among siblings.

  // Find the first whitespace from the end after triming whitespace.
  // This is what we autoformat on, since it is the most predictable,
  // and doesn't suddenly do something with text earlier in the sentence
  // that the user already explicitly decided not to autoformat.
  let text = node.text;
  let start = text.lastIndexOf(" ", text.trimRight().length - 1);
  // However, there are some cases where we extend the range of
  // the autofocus further:
  //    - "[ ]" for checkboxes.
  //    - formatting, e.g., "consider `foo bar`".
  //    - NOTE: I'm not including math ($ or $$) here, since it is very
  //      annoying if you trying to type USD amounts, and people can
  //      create their inline formula with no spaces, then edit it.
  const text0 = text.trimRight();
  if (text0.endsWith("]")) {
    const i = text.lastIndexOf("[");
    if (i != -1) {
      start = Math.min(i - 1, start);
    }
  } else {
    for (const mark of ["`", "**", "*", "_", "~~"]) {
      if (text0.endsWith(mark)) {
        const i = text.lastIndexOf(mark, text0.length - mark.length - 1);
        if (i != -1) {
          start = Math.min(i - 1, start);
          break;
        }
      }
    }
  }

  text = text.slice(start + 1).trim();
  if (text.length == 0) return false;

  // make a copy to avoid any caching issues (??).
  const doc = [...(markdown_to_slate(text, true) as any)];
  // console.log("autoformat doc = ");
  // console.log(JSON.stringify(doc, undefined, 2));

  if (
    doc.length == 1 &&
    doc[0].type == "paragraph" &&
    doc[0].children.length == 1 &&
    Text.isText(doc[0].children[0]) &&
    doc[0].children[0].text.trim() == text.trim()
  ) {
    // No "auto format" action since no real change.
    return false;
  }

  const isInline =
    doc.length == 1 &&
    doc[0].type == "paragraph" &&
    Text.isText(doc[0].children[0]);

  if (!isInline && start >= 1) {
    // block level autocomplete must start at beginning of node. Otherwise, e.g.,
    // typing "Tuesday - Thursday" would make a list item.
    return false;
  }

  // Do an immediate save so that it is easy and possible
  // to undo exactly the result of auto format, in case user
  // doesn't like it.
  // @ts-ignore
  editor.saveValue(true);
  // Wait for next time to finish before applying operations below; if
  // we don't do this, then undo gets messed up.
  await new Promise(requestAnimationFrame);

  // **INLINE CASE**
  if (isInline) {
    const children = doc[0].children;
    if (start != -1) {
      if (children[0]["text"] === "") {
        // In case the first node in children is empty text, remove that,
        // since otherwise it will get normalized away after doing this,
        // and that throws the cursor computation off below, causing a crash.
        children.shift();
      }
      // Add text from before starting point back, since we excluded it above.
      const first = { ...node };
      first.text = node.text.slice(0, start + 1);
      children.unshift(first);
    }
    // Add a space at the end.
    if (
      len(children[children.length - 1]) == 1 &&
      children[children.length - 1]["text"] != null
    ) {
      // text node with NO marks, i.e., it is plain text.
      children[children.length - 1]["text"] += " ";
    } else {
      // last node has marks so we append another node.
      children.push({ text: " " });
    }

    // Find a sequence of operations that converts our input
    // text node into the new list of inline nodes.
    const operations = slateDiff(
      [node],
      children,
      path.slice(0, path.length - 1)
    );

    // Adjust the last entry in path for each operation computed
    // above to account for fact that node might not be first sibling.
    for (const op of operations) {
      shift_path(op, pos);
    }

    applyOperations(editor, operations);
    // Move the cursor to the right position.  It's very important to
    // do this immediately after applying the operations, since otherwise
    // the cursor will be in an invalid position right when
    // scrollCaretIntoView and other things are called, which causes a crash.
    const new_path = [...path];
    new_path[new_path.length - 1] += children.length - 1;
    const new_cursor = {
      offset: children[children.length - 1]["text"].length,
      path: new_path,
    };
    await focusEditorAt(editor, new_cursor);
  } else {
    // **NON-INLINE CASE**
    // Select what is being replaced so it will get deleted when the
    // insert happens.
    Transforms.select(editor, {
      anchor: { path, offset: start == -1 ? 0 : start },
      focus: { path, offset: Math.max(0, node.text.length - 1) },
    });
    // We put an empty paragraph after, so that formatting
    // is preserved (otherwise it gets stripped); also some documents
    // ending in void block elements are difficult to use.
    Transforms.insertNodes(editor, doc);
    await new Promise(requestAnimationFrame);
    moveCursorToEndOfElement(editor, doc[0]);

    // Normally just move the cursor beyond what was just
    // inserted, though sometimes it makes more sense to
    // focus it.
    const type = doc[0].type;
    const rules = getRules(type);
    if (!rules?.autoFocus) {
      // move cursor out of the newly created block element.
      Transforms.move(editor, { distance: 1 });
    }
  }
  await new Promise(requestAnimationFrame);
  // @ts-ignore
  editor.saveValue(true);
  return true;
}

function shift_path(op: Operation, shift: number): void {
  const path = [...op["path"]];
  path[path.length - 1] += shift;
  op["path"] = path;
}

// This is pretty scary, but I need it especially in the weird case
// where you insert a checkbox in an empty document and everything
// looses focus.
// This is a SCARY function so please don't export it.
export async function focusEditorAt(
  editor: ReactEditor,
  point: Point
): Promise<void> {
  const sel = { focus: point, anchor: point };
  Transforms.setSelection(editor, sel);
  let n = 0;
  await new Promise(requestAnimationFrame);
  while (
    n < 100 &&
    (editor.selection == null || !Point.equals(editor.selection.anchor, point))
  ) {
    ReactEditor.focus(editor, true);
    Transforms.setSelection(editor, sel);
    await delay(n);
    n += 1;
  }
  editor.scrollCaretIntoView();
}