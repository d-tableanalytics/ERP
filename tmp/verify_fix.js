const stockQty = 100;
const item_qty_out = "50.00";
const item_qty_in = "25.00";

console.log("Input values:");
console.log("- initial stockQty:", stockQty, typeof stockQty);
console.log("- item_qty_out:", item_qty_out, typeof item_qty_out);
console.log("- item_qty_in:", item_qty_in, typeof item_qty_in);

let buggyResult = stockQty;
buggyResult += item_qty_out;
buggyResult -= item_qty_in;
console.log(
  "\nBuggy Result (stockQty += item_qty_out; buggyResult -= item_qty_in):",
  buggyResult,
);

let fixedResult = stockQty;
fixedResult += Number(item_qty_out);
fixedResult -= Number(item_qty_in);
console.log(
  "Fixed Result (stockQty += Number(item_qty_out); fixedResult -= Number(item_qty_in)):",
  fixedResult,
);

if (fixedResult === 125) {
  console.log("\nSUCCESS: Calculation is correct.");
} else {
  console.log("\nFAILURE: Calculation is incorrect.");
}
