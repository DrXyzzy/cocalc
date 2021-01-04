/*
 *  This file is part of CoCalc: Copyright © 2020 Sagemath, Inc.
 *  License: AGPLv3 s.t. "Commons Clause" – see LICENSE.md for details
 */

import { React } from "../../../app-framework";
import { RenderElementProps, RenderLeafProps } from "slate-react";

export const Element: React.FC<RenderElementProps> = ({
  attributes,
  children,
  element,
}) => {
  if (element.tag) {
    // We use some extra classes for certain tags so things just look better.
    let className: undefined | string = undefined;
    if (element.tag == "table") {
      className = "table";
    }
    return React.createElement(
      element.tag as string,
      { ...attributes, ...(element.attrs as object), ...{ className } },
      children
    );
  }
  switch (element.type) {
    case "html_inline":
      return (
        <code {...attributes} {...element.attrs} style={{ color: "#666" }}>
          {children}
        </code>
      );
    default:
      return (
        <p {...attributes} {...element.attrs}>
          {children}
        </p>
      );
  }
};

export const Leaf: React.FC<RenderLeafProps> = ({
  attributes,
  children,
  leaf,
}) => {
  if (leaf.bold) {
    children = <strong>{children}</strong>;
  }

  if (leaf.italic) {
    children = <em>{children}</em>;
  }
  if (leaf.strikethrough) {
    children = <s>{children}</s>;
  }
  if (leaf.underline) {
    children = <u>{children}</u>;
  }

  return <span {...attributes}>{children}</span>;
};