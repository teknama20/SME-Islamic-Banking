"use client";

export function PrintButton() {
  return (
    <button className="btn btn-primary" onClick={() => window.print()}>
      Print / save as PDF
    </button>
  );
}
