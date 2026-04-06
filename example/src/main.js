import "./style.css";
import { Grid, GridEvent } from "gridgg";

const elm = document.getElementById("grid-1");
for (let rowid = 0; rowid < 20; rowid++) {
  const tr = document.createElement("tr");
  const th = document.createElement("th");
  th.textContent = `${rowid}`;
  tr.appendChild(th);
  for (let colid = 0; colid < 10; colid++) {
    const td = document.createElement("td");
    td.textContent = `${rowid}-${colid} datagrid`;
    tr.appendChild(td);
  }
  elm.appendChild(tr);
}

const g = new Grid(elm);
g.table.addEventListener("selectionchanged", (/** @type{GridEvent} */ evt) => {
  const g = evt.grid;
  const rows = g.getSelectedRows();
  if (rows.length > 0) {
    const indexes = rows.map((r) => rows.indexOf(r)).join(",");
    console.log(`rows select: ${indexes}`);
  } else {
    const from = g.getCellPosition(g.getCurrentCell());
    const eosel = g.getEndOfSelection();
    if (eosel) {
      const to = g.getCellPosition(g.getEndOfSelection());
      console.log(
        `range selected from ${from.row}-${from.column} to ${to.row}-${to.column}`,
      );
    } else {
      console.log("selection cleared.");
    }
  }
});
g.table.addEventListener("cursormoved", (/** @type{GridEvent} */ evt) => {
  const td = evt.grid.getCurrentCell();
  const { row, column } = evt.grid.getCellPosition(td);
  console.log(`cursor moved at ${row}-${column}`);
});
g.table.addEventListener("startediting", (/** @type{GridEvent} */ evt) => {
  const { row, column } = evt.grid.getCellPosition(evt.grid.getCurrentCell());
  console.log(`start editing at ${row}-${column}`);
  evt.setText(`${row}-${column}`);
});
g.table.addEventListener("endediting", (/** @type{GridEvent} */ evt) => {
  const { row, column } = evt.grid.getCellPosition(evt.grid.getCurrentCell());
  console.log(`end editing at ${row}-${column}, newvalue = ${evt.newValue}`);
  evt.setText(`${evt.newValue} datagrid`);
});
g.table.addEventListener("copy", () => console.log("copy"));
g.table.addEventListener("paste", () => console.log("paste"));
g.table.addEventListener("cut", () => console.log("cut"));
g.editableRange = {
  from: {
    row: 0,
    column: 1,
  },
};
g.setCursor(g.getCellAt(0, 1));

const elm2 = document.getElementById("grid-2");
const columns = [
  { label: "名前", field: "name", header: true },
  "interest",
  { label: "年齢", field: "age" },
];
const rowdata = [
  { name: "Chris", interest: "HTML 表", age: 22 },
  { name: "Dennis", interest: "ウェブアクセシビリティ", age: 45 },
  { name: "Sarah", interest: "JavaScript フレームワーク", age: 29 },
  { name: "Karen", interest: "ウェブパフォーマンス", age: 36 },
];
const g2 = new Grid(Grid.createTable(elm2, columns, rowdata));
g2.editableRange = {
  from: {
    row: 1,
    column: 1,
  },
};
g2.setCursorTextAlign({ vertical: "middle" });
g2.setCursor(g2.getCellAt(1, 1));
