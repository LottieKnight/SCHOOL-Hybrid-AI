import type { Meta, StoryObj } from "@storybook/react";
import React from "react";
import { CommerceStreamView } from "./CommerceStreamView";

const meta: Meta<typeof CommerceStreamView> = {
  title: "Curriculum/CommerceStreamView",
  component: CommerceStreamView,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj<typeof CommerceStreamView>;

export const Default: Story = {
  args: {
    outline: {
      title: "Commerce Stream",
      grades: [
        {
          id: "grade10",
          title: "Grade 10",
          subjects: [
            {
              id: "accounting",
              title: "Accounting",
              terms: [
                { id: "term1", title: "Term 1", weeks: 10 },
                { id: "term2", title: "Term 2", weeks: 10 },
              ],
            },
            {
              id: "business-studies",
              title: "Business Studies",
              terms: [{ id: "term1", title: "Term 1", weeks: 10 }],
            },
          ],
        },
      ],
    },
    lessonTitle: "Budgeting Basics (Demo)",
    lessonHtml: `
      <p><strong>Budgeting</strong> is just telling your money where to go instead of wondering where it went.</p>
      <h3>Key Ideas</h3>
      <ul>
        <li>Income vs expenses</li>
        <li>Fixed vs variable costs</li>
        <li>Track, review, adjust</li>
      </ul>
      <blockquote>What gets measured gets managed.</blockquote>
    `,
  },
};
