import React from "react";
import { createComponent } from "@lit/react";
import {
  BlAccordion,
  BlAccordionGroup,
  BlAlert,
  BlButton,
  BlDialog,
  BlInput,
  BlProgressIndicator,
  BlTable,
  BlTableBody,
  BlTableCell,
  BlTableHeader,
  BlTableHeaderCell,
  BlTableRow,
  BlTag,
  BlTextarea,
} from "@trendyol/baklava";

export const BaklavaInput = createComponent({
  react: React,
  tagName: "bl-input",
  elementClass: BlInput,
  events: {
    onBlChange: "bl-change",
    onBlInput: "bl-input",
  },
});

export const BaklavaButton = createComponent({
  react: React,
  tagName: "bl-button",
  elementClass: BlButton,
  events: {
    onBlClick: "bl-click",
  },
});

export const BaklavaAlert = createComponent({
  react: React,
  tagName: "bl-alert",
  elementClass: BlAlert,
  events: {
    onBlClose: "bl-close",
  },
});

export const BaklavaDialog = createComponent({
  react: React,
  tagName: "bl-dialog",
  elementClass: BlDialog,
  events: {
    onBlDialogOpen: "bl-dialog-open",
    onBlDialogRequestClose: "bl-dialog-request-close",
    onBlDialogClose: "bl-dialog-close",
  },
});

export const BaklavaTextarea = createComponent({
  react: React,
  tagName: "bl-textarea",
  elementClass: BlTextarea,
  events: {
    onBlChange: "bl-change",
    onBlInput: "bl-input",
  },
});

export const BaklavaAccordion = createComponent({
  react: React,
  tagName: "bl-accordion",
  elementClass: BlAccordion,
  events: {
    onBlToggle: "bl-toggle",
  },
});

export const BaklavaAccordionGroup = createComponent({
  react: React,
  tagName: "bl-accordion-group",
  elementClass: BlAccordionGroup,
});

export const BaklavaTable = createComponent({
  react: React,
  tagName: "bl-table",
  elementClass: BlTable,
});

export const BaklavaTableHeader = createComponent({
  react: React,
  tagName: "bl-table-header",
  elementClass: BlTableHeader,
});

export const BaklavaTableBody = createComponent({
  react: React,
  tagName: "bl-table-body",
  elementClass: BlTableBody,
});

export const BaklavaTableRow = createComponent({
  react: React,
  tagName: "bl-table-row",
  elementClass: BlTableRow,
});

export const BaklavaTableCell = createComponent({
  react: React,
  tagName: "bl-table-cell",
  elementClass: BlTableCell,
});

export const BaklavaTableHeaderCell = createComponent({
  react: React,
  tagName: "bl-table-header-cell",
  elementClass: BlTableHeaderCell,
});

export const BaklavaTag = createComponent({
  react: React,
  tagName: "bl-tag",
  elementClass: BlTag,
});

export const BaklavaProgressIndicator = createComponent({
  react: React,
  tagName: "bl-progress-indicator",
  elementClass: BlProgressIndicator,
});
