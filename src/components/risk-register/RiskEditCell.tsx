"use client";

import React from "react";

type Props = {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
};

export function RiskEditCell({ value, placeholder, onChange }: Props) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "6px 8px",
        border: "1px solid #ddd",
        borderRadius: 8,
        background: "transparent",
      }}
    />
  );
}