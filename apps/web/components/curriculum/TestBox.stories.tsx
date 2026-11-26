import type { Meta, StoryObj } from "@storybook/react";
import React from "react";

type TestBoxProps = {
  label: string;
};

function TestBox({ label }: TestBoxProps) {
  return (
    <div
      style={{
        border: "2px dashed var(--text-1)",
        borderRadius: 12,
        padding: 24,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        background: "linear-gradient(135deg, var(--gold-dim), var(--gold))",
        color: "var(--text-1)",
      }}
    >
      {label}
    </div>
  );
}

const meta: Meta<typeof TestBox> = {
  title: "Debug/TestBox",
  component: TestBox,
  parameters: { layout: "centered" },
};

export default meta;

type Story = StoryObj<typeof TestBox>;

export const Default: Story = {
  args: {
    label: "Storybook is scanning components stories.",
  },
};

