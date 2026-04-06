/**
 * @typedef {Object} GridggCssRule
 * @property {string[]} selectors
 * @property {{[key: string]:string}} properties
 */

const CLASS_TABLE = "gridgg_table";
const CLASS_EDITING = "gridgg_editing";
const CLASS_CURSOR = "gridgg_cursor";
const CLASS_SELECTED = "gridgg_selected";

const EVENT_SELECTIONCHANGED = "selectionchanged";
const EVENT_CURSORMOVED = "cursormoved";
const EVENT_STARTEDITING = "startediting";
const EVENT_ENDEDITING = "endediting";

/** @type {GridggCssRule[]} */
const cssRules = [
  {
    selectors: [`table.${CLASS_TABLE}`],
    properties: {
      "user-select": "none",
      "touch-action": "none",
    },
  },
  {
    selectors: [
      `table.${CLASS_TABLE} > tbody > tr > td`,
      `table.${CLASS_TABLE} > tr > td`,
    ],
    properties: {
      position: "relative",
    },
  },
  {
    /*
     * If contenteditable is true or plaintext-only, vertical-align is ignored and always becomes top.
     * Therefore, if vertical-align of td is set to middle, the vertical position in the cell will change depending on whether there is a cursor or not.
     * Therefore, if the vertical-align of td is set to top instead of middle, the vertical alignment will not change between when there is a cursor and when there is not, resulting in natural movement.
     */
    selectors: [
      `table.${CLASS_TABLE} > tbody > tr > td > .${CLASS_CURSOR}`,
      `table.${CLASS_TABLE} > tr > td > .${CLASS_CURSOR}`,
    ],
    properties: {
      position: "absolute",
      left: "0px",
      top: "0px",
      width: "100%",
      height: "100%",
      "box-sizing": "border-box",
      "line-break": "inherit",
      padding: "inherit",
      overflow: "inherit",
      "overflow-wrap": "inherit",
      "text-align": "inherit",
      "text-indent": "inherit",
      "text-overflow": "inherit",
      "text-wrap-mode": "inherit",
      display: "flex",
    },
  },
  {
    selectors: [
      `table.${CLASS_TABLE}:not(.${CLASS_EDITING}) > tbody > tr > td > .${CLASS_CURSOR}`,
      `table.${CLASS_TABLE}:not(.${CLASS_EDITING}) > tr > td > .${CLASS_CURSOR}`,
    ],
    properties: {
      "caret-color": "transparent",
    },
  },
  {
    selectors: [
      `table.${CLASS_TABLE}:not(.${CLASS_EDITING}) > tbody > tr > td::selection`,
      `table.${CLASS_TABLE}:not(.${CLASS_EDITING}) > tr > td::selection`,
      `table.${CLASS_TABLE}:not(.${CLASS_EDITING}) > tbody > tr > td > .${CLASS_CURSOR}::selection`,
      `table.${CLASS_TABLE}:not(.${CLASS_EDITING}) > tr > td > .${CLASS_CURSOR}::selection`,
    ],
    properties: {
      background: "none",
    },
  },
  {
    /* During editing, ellipsis causes display problems, so it is set to clip. */
    selectors: [
      `table.${CLASS_TABLE}.${CLASS_EDITING} > tbody > tr > td > .${CLASS_CURSOR}`,
      `table.${CLASS_TABLE}.${CLASS_EDITING} > tr > td > .${CLASS_CURSOR}`,
    ],
    properties: {
      "text-overflow": "clip",
    },
  },
];

/**
 *
 * @returns {HTMLStyleElement}
 */
function addGridggStyles() {
  const style = document.createElement("style");
  document.head.appendChild(style);

  const styleSheet = style.sheet;
  cssRules.forEach((rule) => {
    const props = Object.getOwnPropertyNames(rule.properties)
      .map((r) => `${r}:${rule.properties[r]};`)
      .join("");
    rule.selectors.forEach((s) => {
      const r = `${s} {${props}}`;
      styleSheet.insertRule(r);
    });
  });
  return style;
}

/**
 * Represents the editing state.
 * @readonly
 * @enum {number}
 */
const EditState = {
  none: 0, // Not in edit mode
  immediate: 1, // Immediate edit mode
  edit: 2, // Edit mode
};

export class GridEvent extends Event {
  /**
   * @type {Grid}
   */
  #grid;

  /**
   * @type {(v:string)=>any} v
   */
  #setText;

  /**
   * @type {string}
   */
  #newValue;

  /**
   * @returns {Grid}
   */
  get grid() {
    return this.#grid;
  }

  /**
   * @returns {(v:string)=>any}
   */
  get setText() {
    return this.#setText;
  }

  /**
   * @returns {string}
   */
  get newValue() {
    return this.#newValue;
  }

  /**
   *
   * @param {Grid} grid
   * @param {string} type
   * @param {((v:string)=>any)?} setText
   * @param {string?} newValue;
   */
  constructor(grid, type, setText, newValue) {
    super(type);
    this.#grid = grid;
    this.#setText = setText;
    this.#newValue = newValue;
  }
}

export class Grid {
  /** @type {HTMLTableElement} */
  #table;

  /** @type {HTMLElement} */
  #cursor;

  /** @type {EditState} */
  #editState;

  /** @type {HTMLStyleElement | null} */
  static #style = null;

  /**
   * End of selection
   * @type {HTMLTableCellElement | null}
   */
  #endOfSelection;

  /**
   *
   * @param {Element} elm
   * @returns {HTMLTableCellElement | null}
   */
  #getCellElm(elm) {
    let e = elm;
    while (e && e != document.body && e !== document.documentElement) {
      if (e instanceof HTMLTableCellElement) {
        return e;
      }
      e = e.parentElement;
    }
    return null;
  }

  /**
   *
   * @param {Element} elm
   * @returns {HTMLTableCellElement | null}
   */
  #getCursorElm(elm) {
    let e = elm;
    while (e && e != document.body && e !== document.documentElement) {
      if (e.classList.contains(CLASS_CURSOR)) {
        return e;
      }
      e = e.parentElement;
    }
    return null;
  }

  /**
   *
   * @param {HTMLElement} elm
   * @returns {boolean}
   */
  #elmIsTableElm(elm) {
    let e = elm;
    while (e && e != document.body && e !== document.documentElement) {
      if (e === this.#table) {
        return true;
      }
      e = e.parentElement;
    }
    return false;
  }

  get table() {
    return this.#table;
  }

  /**
   * @returns {HTMLTableCellElement | null}
   */
  getEndOfSelection() {
    return this.#endOfSelection;
  }

  /** @returns {boolean} */
  get #editing() {
    return this.#table.classList.contains(CLASS_EDITING);
  }

  set #editing(value) {
    if (value) {
      this.#table.classList.add(CLASS_EDITING);
    } else {
      this.#table.classList.remove(CLASS_EDITING);
    }
  }

  get #firstRowIndex() {
    return this.editableRange?.from?.row ?? 0;
  }

  get #lastRowIndex() {
    return this.editableRange?.to?.row ?? this.#table.rows.length - 1;
  }

  /**
   * @param {HTMLTableRowElement} tr
   * @returns {number}
   */
  #firstColumnIndex(tr) {
    return this.editableRange?.from?.column ?? 0;
  }

  /**
   * @param {HTMLTableRowElement} tr
   * @returns {HTMLTableCellElement | null}
   */
  #firstColumn(tr) {
    const col = this.#firstColumnIndex(tr);
    return tr.cells.item(col);
  }

  /**
   *
   * @param {HTMLTableRowElement} tr
   * @returns {number}
   */
  #lastColumnIndex(tr) {
    return this.editableRange?.to?.column ?? tr.cells.length - 1;
  }

  /**
   * @param {HTMLTableRowElement} tr
   * @returns {HTMLTableCellElement | null}
   */
  #lastColumn(tr) {
    return tr.cells.item(this.#lastColumnIndex(tr));
  }

  /**
   * @type {{ from: { row: number | null, column: number | null } | null, to: { row: number | null, column: number | null } | null } | null}
   */
  editableRange;

  /**
   * @returns {HTMLTableRowElement[]}
   */
  getSelectedRows() {
    return Array.from(this.#table.rows).filter((elm) =>
      elm.classList.contains(CLASS_SELECTED),
    );
  }

  /**
   * @returns {{start: {row: number, column: number}, end: {row: number, column: number}}|null}
   */
  getSelectedRange() {
    const cur = this.getCurrentCell();
    const eos = this.getEndOfSelection();
    if (cur && eos) {
      const from = this.getCellPosition(cur);
      const to = this.getCellPosition(eos);
      const [startrow, endrow] = [from.row, to.row].sort((a, b) => a - b);
      const [startcol, endcol] = [from.column, to.column].sort((a, b) => a - b);
      return {
        start: { row: startrow, column: startcol },
        end: { row: endrow, column: endcol },
      };
    } else {
      return null;
    }
  }

  /**
   * Move the cursor to the element specified by the argument `td`.
   * @param {HTMLTableCellElement | null} td
   */
  setCursor(td) {
    if (this.#editing) {
      this.#endEditing();
    }
    const cur = this.getCurrentCell();
    // cur can be null only during initialization.
    cur?.removeChild(this.#cursor);
    this.#cursor.textContent = td.textContent;
    td.appendChild(this.#cursor);
    this.#cursor.focus({ preventScroll: true });
    this.#moveCarretToStart();
  }

  /**
   * Move the cursor to the element specified by the argument `td`.
   * @param {HTMLTableCellElement | null} td
   */
  #setCursor(td) {
    this.setCursor(td);
    const evt = new GridEvent(this, EVENT_CURSORMOVED);
    this.#table.dispatchEvent(evt);
  }

  /**
   * Selects the range from the current cursor position to the cell specified by `td`.
   * @param {HTMLTableCellElement | null} td
   */
  selectTo(td) {
    let changed = false;
    if (td) {
      if (td === this.#endOfSelection) {
        return false;
      }
      if (this.#editing) {
        this.#endEditing();
      }
      const { row: arow, column: acol } = this.getCellPosition(
        this.getCurrentCell(),
      );
      const { row: brow, column: bcol } = this.getCellPosition(td);
      const srow = Math.min(arow, brow);
      const erow = Math.max(arow, brow);
      const scol = Math.min(acol, bcol);
      const ecol = Math.max(acol, bcol);
      console.debug(`select ${srow},${scol}-${erow},${ecol}`);
      const rows = this.#table.rows;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        const cells = row.cells;
        if (r >= srow && r <= erow) {
          for (let c = 0; c < cells.length; c++) {
            const cell = cells[c];
            const selected = cell.classList.contains(CLASS_SELECTED);
            if (c >= scol && c <= ecol) {
              changed |= !selected;
              if (!selected) {
                cell.classList.add(CLASS_SELECTED);
              }
            } else {
              changed |= selected;
              if (selected) {
                cell.classList.remove(CLASS_SELECTED);
              }
            }
          }
        } else {
          Array.from(cells).forEach((c) => {
            changed |= c.classList.contains(CLASS_SELECTED);
            c.classList.remove(CLASS_SELECTED);
          });
        }
        changed |= row.classList.contains(CLASS_SELECTED);
        row.classList.remove(CLASS_SELECTED);
      }
    } else {
      for (const tr of this.#table.rows) {
        for (const td of tr.children) {
          changed |= td.classList.contains(CLASS_SELECTED);
          td.classList.remove(CLASS_SELECTED);
        }
        changed |= tr.classList.contains(CLASS_SELECTED);
        tr.classList.remove(CLASS_SELECTED);
      }
    }
    this.#endOfSelection = td;
    return changed;
  }

  /**
   *
   * @param {HTMLTableCellElement} td
   */
  #selectTo(td) {
    if (this.selectTo(td)) {
      this.#emitSelectionChanged();
    }
  }

  /**
   * Return the row and column number of a cell from a TD element.
   * @param {HTMLTableCellElement} td
   * @returns {{row:number, column:number}}
   */
  getCellPosition(td) {
    /** @type {HTMLTableRowElement} */
    const tr = td.parentElement;
    return { row: tr.rowIndex, column: td.cellIndex };
  }

  /**
   *
   * @param {number} row
   * @param {number} column
   * @returns {HTMLTableCellElement | null}
   */
  getCellAt(row, column) {
    return this.#table.rows.item(row)?.cells.item(column) ?? null;
  }

  /**
   * Return the current cell.
   * @returns {HTMLTableCellElement | null}
   */
  getCurrentCell() {
    return this.#cursor.parentElement;
  }

  /**
   * @returns {HTMLTableRowElement|null}
   */
  #getCurrentRow() {
    return this.#cursor.parentElement?.parentElement ?? null;
  }

  /**
   *
   * @param {HTMLTableCellElement} cell
   * @param {any} value
   */
  setCellValue(cell, value) {
    const isCurrent = cell === this.getCurrentCell();
    const v = value.toString();
    if (isCurrent) {
      cell.removeChild(this.#cursor);
    }
    cell.textContent = v;
    if (isCurrent) {
      this.#cursor.textContent = v;
      cell.appendChild(this.#cursor);
    }
  }

  /**
   *
   * @param {HTMLTableCellElement} cell
   * @returns {string}
   */
  getCellValue(cell) {
    return cell === this.getCurrentCell()
      ? this.#cursor.textContent
      : cell.textContent;
  }

  /**
   *
   * @param {PointerEvent} evt
   * @param {HTMLTableCellElement} td
   */
  #onTdPointerDown(evt, td) {
    evt.preventDefault();

    if (evt.shiftKey) {
      this.#selectTo(td);
    } else {
      this.selectTo(null);
      this.#setCursor(td);
    }
    this.#cursor.setPointerCapture(evt.pointerId);
  }

  /**
   *
   * @param {HTMLTableRowElement} fromElm
   * @param {HTMLTableRowElement} toElm
   */
  selectRows(fromElm, toElm) {
    const rows = this.#table.rows;
    const [from, to] = [fromElm.rowIndex, toElm.rowIndex].sort((a, b) => a - b);
    let changed = false;
    for (let i = 0; i < rows.length; i++) {
      const rowelm = rows[i];
      if (i >= from && i <= to) {
        changed |= !rowelm.classList.contains(CLASS_SELECTED);
        rowelm.classList.add(CLASS_SELECTED);
      } else {
        changed |= rowelm.classList.contains(CLASS_SELECTED);
        rowelm.classList.remove(CLASS_SELECTED);
      }
    }
    return changed;
  }

  /**
   *
   * @param {HTMLTableRowElement} fromElm
   * @param {HTMLTableRowElement} toElm
   */
  #selectRows(fromElm, toElm) {
    if (this.selectRows(fromElm, toElm)) {
      this.#emitSelectionChanged();
    }
  }

  /**
   *
   * @param {PointerEvent} evt
   * @@param {HTMLTableCellElement} th
   */
  #onRowHeaderPointerMove(evt, th) {
    if (!th.hasPointerCapture(evt.pointerId)) {
      return;
    }
    const e = document.elementFromPoint(evt.clientX, evt.clientY);
    if (this.#elmIsTableElm(e)) {
      /** @type {HTMLTableRowElement | null} */
      let row = null;
      if (e instanceof HTMLTableCellElement) {
        row = e.parentElement;
      } else if (e.classList.contains(CLASS_CURSOR)) {
        row = e.parentElement.parentElement;
      }
      if (row) {
        this.#selectRows(this.#cursor.parentElement.parentElement, row);
      }
    }
  }

  /**
   *
   * @param {PointerEvent} evt
   * @param {HTMLTableCellElement} th
   */
  #onRowHeaderPointerDown(evt, th) {
    evt.preventDefault();
    const row = th.parentElement;
    if (evt.ctrlKey || evt.metaKey) {
      row.classList.toggle(CLASS_SELECTED);
      this.#emitSelectionChanged();
    } else {
      th.setPointerCapture(evt.pointerId);
      if (evt.shiftKey) {
        this.#selectRows(this.#getCurrentRow(), row);
      } else {
        const selected = this.getSelectedRows();
        if (selected.length !== 1 || !row.classList.contains(CLASS_SELECTED)) {
          this.selectTo(null);
          row.classList.add(CLASS_SELECTED);
          const td = this.#firstColumn(row);
          if (td) {
            this.setCursor(td);
          }
          this.#emitSelectionChanged();
        }
      }
    }
  }

  /**
   *
   * @param {PointerEvent} evt
   */
  #onCursorPointerMove(evt) {
    if (this.#cursor.hasPointerCapture(evt.pointerId)) {
      const e = document.elementFromPoint(evt.clientX, evt.clientY);
      if (this.#elmIsTableElm(e)) {
        const td = this.#getCellElm(e);
        if (td) {
          this.#selectTo(td);
        }
      }
    }
  }

  /**
   *
   * @param {PointerEvent} evt
   */
  #onCursorPointerDown(evt) {
    if (!this.#editing) {
      evt.preventDefault();
      this.#moveCarretToStart();
      this.#selectTo(null);
      this.#cursor.setPointerCapture(evt.pointerId);
    }
  }

  /**
   *
   * @param {KeyboardEvent} evt
   */
  #onKeyDown(evt) {
    switch (this.#editState) {
      case EditState.edit:
        this.#onEditKeyDown(evt);
        break;

      case EditState.immediate:
        this.#onImmediateKeyDown(evt);
        break;

      case EditState.none:
        this.#onNoneKeyDown(evt);
        break;

      default:
        console.error("Unknown edit state");
        break;
    }
  }

  /**
   *
   * @param {KeyboardEvent} evt
   */
  #onEditKeyDown(evt) {
    console.debug(
      `keydown(edit) ${evt.key} ${evt.isComposing}　${evt.keyCode}`,
    );
    if (evt.isComposing || evt.keyCode === 229) {
      // When the Enter key is pressed to confirm input in Safari,
      // the order of the compositionend event and the keydown event for the Enter key is reversed.
      // As a workaround for the problem that isComposing becomes false in the keydown event of the Enter key,
      // we use the fact that Safari sets the keyCode to 229 during IME conversion,
      // and process the case where the keyCode is 229 in the same way as when isComposing is true.
      evt.preventDefault();
    } else {
      if (evt.key.length === 1) {
        // Printable keys
        // Insertion of the typed key into the DOM tree is left to the browser
        return;
      } else {
        switch (evt.key) {
          case "Escape":
            {
              evt.preventDefault();
              this.#cancelEditing();
            }
            break;
          case "Enter":
            {
              evt.preventDefault();

              this.#endEditing();
              if (evt.shiftKey) {
                this.#arrowRight(false, false);
              } else {
                this.#arrowDown(false, false);
              }
            }
            break;
          default:
            break;
        }
      }
    }
  }

  /**
   *
   * @param {boolean} modKey Set to true to perform processing when a modifier key is pressed. For example, to move to the beginning of the line instead of left.
   * @param {boolean} selectKey Set to true to perform processing when a range selection key such as shift is pressed.
   * @param {(elm:HTMLTableCellElement, modKey:boolean) => HTMLTableCellElement | null} nextcb
   */
  #cursorKey(modKey, selectKey, nextcb) {
    const cell = this.getCurrentCell();
    if (selectKey) {
      const row = this.#getCurrentRow();
      if (row.classList.contains(CLASS_SELECTED)) {
        const rows = this.getSelectedRows();
        const tr = rows.indexOf(row) === 0 ? rows[rows.length - 1] : rows[0];
        const td = this.#firstColumn(tr);
        if (td) {
          const next = nextcb.call(this, td, modKey);
          if (next) {
            this.#selectRows(row, next.parentElement);
          }
        }
      } else {
        const next = nextcb.call(this, this.#endOfSelection ?? cell, modKey);
        if (next) {
          this.#selectTo(next);
          next.scrollIntoView({ behavior: "instant", block: "nearest" });
        }
      }
    } else {
      /** @type {HTMLTableCellElement | null} */
      const next = nextcb.call(this, cell, modKey);
      if (next) {
        this.selectTo(null);
        this.#setCursor(next);
        next.scrollIntoView({ behavior: "instant", block: "nearest" });
      }
    }
  }

  /**
   *
   * @param {HTMLTableCellElement} td
   * @param {boolean} modKey
   * @returns {HTMLElement | null}
   */
  #getCellAbove(td, modKey) {
    const { column: col } = this.getCellPosition(td);
    if (modKey) {
      const tr = this.#table.rows[this.#firstRowIndex];
      if (tr) {
        return tr.cells[col];
      } else {
        return null;
      }
    } else {
      const tr =
        this.#table.rows[
          Math.max(this.#firstRowIndex, td.parentElement.rowIndex - 1)
        ];
      return tr.cells[col];
    }
  }

  /**
   *
   * @param {boolean} modKey
   * @param {boolean} shiftKey
   */
  #arrowUp(modKey, shiftKey) {
    this.#cursorKey(modKey, shiftKey, this.#getCellAbove);
  }

  /**
   *
   * @param {HTMLTableCellElement} td
   * @param {boolean} modKey
   * @returns {HTMLElement | null}
   */
  #getCellBelow(td, modKey) {
    const { column: col } = this.getCellPosition(td);
    if (modKey) {
      const tr = this.#table.rows[this.#lastRowIndex];
      if (tr) {
        return tr.cells[col];
      } else {
        return null;
      }
    } else {
      const tr =
        this.#table.rows[
          Math.min(td.parentElement.rowIndex + 1, this.#lastRowIndex)
        ];
      return tr.cells[col];
    }
  }

  /**
   *
   * @param {boolean} modKey
   * @param {boolean} shiftKey
   */
  #arrowDown(modKey, shiftKey) {
    this.#cursorKey(modKey, shiftKey, this.#getCellBelow);
  }

  /**
   *
   * @param {HTMLTableCellElement} td
   * @param {boolean} alyKey
   * @returns {HTMLElement | null}
   */
  #getLeftCell(td, modKey) {
    const tr = td.parentElement;
    if (modKey) {
      return this.#firstColumn(tr);
    } else {
      const left = Math.max(td.cellIndex - 1, this.#firstColumnIndex(tr));
      return tr.cells[left];
    }
  }

  /**
   *
   * @param {boolean} modKey
   * @param {boolean} shiftKey
   */
  #arrowLeft(modKey, shiftKey) {
    this.#cursorKey(modKey, shiftKey, this.#getLeftCell);
  }

  /**
   *
   * @param {HTMLTableCellElement} td
   * @param {boolean} modKey
   * @return {HTMLElement | null}
   */
  #getRightCell(td, modKey) {
    const tr = td.parentElement;
    if (modKey) {
      return this.#lastColumn(tr);
    } else {
      const right = Math.min(td.cellIndex + 1, this.#lastColumnIndex(tr));
      return tr.cells[right];
    }
  }

  /**
   *
   * @param {boolean} modKey
   * @param {boolean} shiftKey
   */
  #arrowRight(modKey, shiftKey) {
    this.#cursorKey(modKey, shiftKey, this.#getRightCell);
  }

  /**
   *
   * @param {KeyboardEvent} evt
   */

  #onImmediateKeyDown(evt) {
    console.debug(
      `keydown(immediate) ${evt.key} ${evt.isComposing}　${evt.keyCode}`,
    );

    if (evt.isComposing || evt.keyCode === 229) {
      // When the Enter key is pressed to confirm input in Safari,
      // the order of the compositionend event and the keydown event for the Enter key is reversed.
      // As a workaround for the problem that isComposing becomes false in the keydown event of the Enter key,
      // we use the fact that Safari sets the keyCode to 229 during IME conversion,
      // and process the case where the keyCode is 229 in the same way as when isComposing is true.
      evt.preventDefault();
      return;
    }

    if (evt.key.length === 1) {
      // Printable keys
      // Insertion of the typed key into the DOM tree is left to the browser
      return;
    }

    switch (evt.key) {
      case "Escape":
        this.#cancelEditing();
        break;

      case "Enter":
        this.#endEditing();
        if (evt.shiftKey) {
          this.#arrowRight(false, false);
        } else {
          this.#arrowDown(false, false);
        }
        break;

      case "ArrowUp":
        this.#arrowUp(false, evt.shiftKey);
        break;

      case "ArrowDown":
        this.#arrowDown(false, evt.shiftKey);
        break;

      case "ArrowLeft":
        this.#arrowLeft(false, evt.shiftKey);
        break;

      case "ArrowRight":
        this.#arrowRight(false, evt.shiftKey);
        break;

      case "Home":
        this.#arrowLeft(true, evt.shiftKey);
        break;

      case "End":
        this.#arrowRight(true, evt.shiftKey);
        break;

      case "PageUp":
        this.#arrowUp(true, evt.shiftKey);
        break;

      case "PageDown":
        this.#arrowDown(true, evt.shiftKey);
        break;

      default:
        return;
    }
    // Disable all default handling of key events that were broken in the switch statement above.
    evt.preventDefault();
  }

  /**
   *
   * @param {KeyboardEvent} evt
   */
  #onNoneKeyDown(evt) {
    console.debug(
      `keydown(none) ${evt.key} ${evt.isComposing}　${evt.keyCode}`,
    );
    if (evt.key.length === 1) {
      // Printable keys

      // If a printable key is pressed in non-edit mode, switch to immediate edit mode.
      // Insertion of the typed key into the DOM tree is left to the browser

      if (!evt.ctrlKey && !evt.metaKey) {
        this.#startEditing(true);
      }
      return;
    }

    switch (evt.key) {
      case "ArrowUp":
        this.#arrowUp(false, evt.shiftKey);
        break;
      case "ArrowDown":
        this.#arrowDown(false, evt.shiftKey);
        break;
      case "ArrowLeft":
        this.#arrowLeft(false, evt.shiftKey);
        break;
      case "ArrowRight":
        this.#arrowRight(false, evt.shiftKey);
        break;
      case "F2":
        {
          // const cur = this.currentCellElement;
          // When F2 is pressed, switch to edit mode.
          // this.#cursor.textContent = cur.textContent;
          this.#startEditing(false);
        }
        break;
      case "Escape":
        this.#selectTo(null);
        break;
      case "Enter":
        if (evt.shiftKey) {
          this.#arrowRight(false, false);
        } else {
          this.#arrowDown(false, false);
        }
        break;
      case "Home":
        this.#arrowLeft(true, evt.shiftKey);
        break;
      case "End":
        this.#arrowRight(true, evt.shiftKey);
        break;
      case "PageUp":
        this.#arrowUp(true, evt.shiftKey);
        break;
      case "PageDown":
        this.#arrowDown(true, evt.shiftKey);
        break;
      case "Delete":
        {
          const cur = this.getCurrentCell();
          this.#cursor.textContent = "";
          cur.removeChild(this.#cursor);
          cur.textContent = "";
          cur.appendChild(this.#cursor);
          this.#moveCarretToStart();
        }
        break;
      case "Backspace":
        // When Backspace is pressed, switch to immediate edit mode.
        this.#startEditing(true);
        break;

      default:
        return;
    }
    // Disable all default handling of key events that were broken in the switch statement above.
    evt.preventDefault();
  }

  /**
   *
   * @param {boolean} immediate
   * @returns
   */
  #startEditing(immediate) {
    if (this.#editing) {
      console.warn("already editing");
      return;
    }
    console.debug("startEditing");
    const sel = document.getSelection();
    if (sel) {
      if (immediate) {
        this.#cursor.textContent = "";
        this.#editState = EditState.immediate;
      } else {
        const cb = (v) => {
          if (typeof v === "string") {
            this.#cursor.textContent = v;
          }
        };
        const evt = new GridEvent(this, EVENT_STARTEDITING, cb);
        this.#table.dispatchEvent(evt);
        this.#editState = EditState.edit;
      }

      const range = document.createRange();
      if (this.#cursor.lastChild == null) {
        range.setStart(this.#cursor, 0);
      } else {
        range.selectNode(this.#cursor.lastChild);
      }
      sel.removeAllRanges();
      sel.addRange(range);

      this.#editing = true;
    } else {
      console.warn(`document.getSelection() returns ${sel}`);
    }
  }

  #cancelEditing() {
    if (!this.#editing) {
      console.warn("not editing");
      return;
    }
    console.debug("cancelEditing");
    const cur = this.getCurrentCell();
    cur.removeChild(this.#cursor);
    this.#cursor.textContent = cur.textContent;
    cur.appendChild(this.#cursor);
    this.#editState = EditState.none;
    this.#editing = false;

    this.#moveCarretToStart();
  }

  #endEditing() {
    if (!this.#editing) {
      console.warn("not editing");
      return;
    }
    console.debug("endEditing");
    const newvalue = this.#cursor.textContent;
    const cur = this.getCurrentCell();
    let tmp = newvalue;
    const cb = (v) => {
      if (typeof v === "string") {
        tmp = v;
      }
    };
    const evt = new GridEvent(this, EVENT_ENDEDITING, cb, newvalue);
    this.#table.dispatchEvent(evt);
    cur.removeChild(this.#cursor);
    cur.textContent = tmp;
    this.#cursor.textContent = tmp;
    cur.appendChild(this.#cursor);
    this.#editState = EditState.none;
    this.#editing = false;

    this.#moveCarretToStart();
  }

  #moveCarretToStart() {
    const sel = document.getSelection();
    if (sel) {
      const range = document.createRange();

      range.setStart(this.#cursor, 0);
      range.collapse(true);

      sel.removeAllRanges();
      sel.addRange(range);
    }
    // Even if the caret position is moved to the left end, the scroll position within the cursor does not change, so we scroll it.
    this.#cursor.scrollLeft = 0;
    this.#cursor.scrollTop = 0;
  }

  #onCompositionStart() {
    console.debug("composition start", this.#editState, this.#editing);
    if (this.#editState === EditState.none) {
      this.#startEditing(true);
    }
  }

  #emitSelectionChanged() {
    const evt = new GridEvent(this, EVENT_SELECTIONCHANGED);
    this.#table.dispatchEvent(evt);
  }

  /**
   *
   * @param {{vertical:"top"|"middle"|"bottom",horizontal:"left"|"center"|"right"} alignment
   */
  setCursorTextAlign(alignment) {
    const { vertical: v, horizontal: h } = alignment;
    if (typeof v === "string") {
      switch (v) {
        case "top":
          this.#cursor.style.alignItems = "start";
          break;
        case "middle":
          this.#cursor.style.alignItems = "center";
          break;
        case "bottom":
          this.#cursor.style.alignItems = "end";
          break;
      }
    }
    if (typeof h === "string") {
      switch (h) {
        case "left":
          this.#cursor.style.justifyItems = "start";
          break;
        case "center":
          this.#cursor.style.justifyItems = "center";
          break;
        case "right":
          this.#cursor.style.justifyItems = "end";
          break;
      }
    }
  }

  /**
   *
   * @param {HTMLTableElement} element
   */
  constructor(element) {
    if (Grid.#style === null) {
      Grid.#style = addGridggStyles();
    }
    this.#editState = EditState.none;

    this.#table = element;
    this.#table.classList.add(CLASS_TABLE);

    this.#cursor = document.createElement("div");
    this.#cursor.className = CLASS_CURSOR;
    this.#cursor.contentEditable = "plaintext-only";

    this.#editing = false;

    this.#table.addEventListener("pointerdown", (evt) => {
      evt.preventDefault();
      if (!evt.isPrimary || (evt.pointerType === "mouse" && evt.button !== 0)) {
        return;
      }
      if (this.#getCursorElm(evt.target)) {
        this.#onCursorPointerDown(evt);
      } else {
        const cell = this.#getCellElm(evt.target);
        if (cell) {
          /** @type {HTMLTableRowElement} */
          const row = cell.parentElement;
          const rowIndex = row.rowIndex;
          if (
            rowIndex >= this.#firstRowIndex &&
            rowIndex <= this.#lastRowIndex
          ) {
            const columnIndex = cell.cellIndex;
            if (
              columnIndex >= this.#firstColumnIndex(row) &&
              columnIndex <= this.#lastColumnIndex(row)
            ) {
              this.#onTdPointerDown(evt, cell);
            } else {
              this.#onRowHeaderPointerDown(evt, cell);
            }
          }
        }
      }
    });

    this.#table.addEventListener("pointermove", (evt) => {
      if (this.#getCursorElm(evt.target)) {
        this.#onCursorPointerMove(evt);
      } else {
        const cell = this.#getCellElm(evt.target);
        if (cell) {
          this.#onRowHeaderPointerMove(evt, cell);
        }
      }
    });

    this.#table.addEventListener("pointercancel", (evt) => {
      if (this.#getCursorElm(evt.target)) {
        if (this.#cursor.hasPointerCapture(evt.pointerId)) {
          this.#cursor.releasePointerCapture(evt.pointerId);
        }
      } else {
        const cell = this.#getCellElm(evt.target);
        if (cell && cell.hasPointerCapture(evt.pointerId)) {
          cell.releasePointerCapture(evt.pointerId);
        }
      }
    });

    this.#cursor.addEventListener("keydown", (evt) => this.#onKeyDown(evt));
    this.#table.addEventListener("compositionstart", () =>
      this.#onCompositionStart(),
    );

    this.#table.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
    });
  }

  /**
   *
   * @param {HTMLTableElement} table
   * @param {(string|{label:string, field:string,header?:boolean})[]} columns
   * @param {Object[]} rowdata
   */
  static createTable(table, columns, rowdata) {
    /** {{ label: string, field: string, header: boolean }[]} */
    const cols = columns
      .map((c) => {
        if (typeof c === "string") {
          return { label: c, field: c, header: false };
        } else {
          let { label, field, header } = c;
          if (typeof field !== "string") {
            return null;
          } else if (typeof label !== "string") {
            label = field;
          }
          return { label, field, header: header === true };
        }
      })
      .filter((m) => m != null);
    const thead = document.createElement("thead");
    let tr = document.createElement("tr");
    cols.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = c.label;
      th.setAttribute("scope", "col");
      tr.appendChild(th);
    });
    thead.appendChild(tr);
    const tbody = document.createElement("tbody");
    rowdata.forEach((data) => {
      const tr = document.createElement("tr");
      cols.forEach((c) => {
        if (c.header === true) {
          const th = document.createElement("th");
          th.textContent = Reflect.get(data, c.field)?.toString() ?? "";
          th.setAttribute("scope", "row");
          tr.appendChild(th);
        } else {
          const td = document.createElement("td");
          td.textContent = Reflect.get(data, c.field)?.toString() ?? "";
          tr.appendChild(td);
        }
      });
      tbody.appendChild(tr);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }
}
