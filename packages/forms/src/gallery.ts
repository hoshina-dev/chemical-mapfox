import type { z } from "zod";

import {
  BooleanQuestion,
  CheckboxGroupQuestion,
  ColorQuestion,
  DateQuestion,
  DateTimeQuestion,
  MultiSelectQuestion,
  NumberQuestion,
  NumberSelectQuestion,
  PasswordQuestion,
  type Question,
  type QuestionType,
  RadioQuestion,
  RatingQuestion,
  RepeatableGroupQuestion,
  SegmentedQuestion,
  SliderQuestion,
  StringQuestion,
  StringSelectQuestion,
  TagsQuestion,
  TextareaQuestion,
  TimeQuestion,
} from "./schema";

export interface GalleryEntry {
  type: QuestionType;
  label: string;
  description: string;
  zodSchema: z.ZodType;
  example: Question;
}

export const GALLERY: GalleryEntry[] = [
  {
    type: "string",
    label: "Short text",
    description:
      "Single-line text input. Mantine TextInput. Google Forms' short answer.",
    zodSchema: StringQuestion,
    example: {
      id: "name",
      type: "string",
      label: "Your name",
      description: "We'll use this on your name tag.",
      required: true,
      config: {
        placeholder: "e.g. Hoshina",
        maxLength: 60,
      },
    },
  },
  {
    type: "textarea",
    label: "Paragraph",
    description:
      "Multi-line autosizing text area. Mantine Textarea. Google Forms' paragraph.",
    zodSchema: TextareaQuestion,
    example: {
      id: "bio",
      type: "textarea",
      label: "Short bio",
      description: "A couple of sentences about you.",
      config: {
        placeholder: "I'm a ...",
        minRows: 3,
        maxRows: 8,
        maxLength: 500,
      },
    },
  },
  {
    type: "password",
    label: "Password",
    description: "Masked text input with reveal toggle. Mantine PasswordInput.",
    zodSchema: PasswordQuestion,
    example: {
      id: "invite_code",
      type: "password",
      label: "Invite code",
      config: {
        placeholder: "•••••••",
        minLength: 4,
      },
    },
  },
  {
    type: "number",
    label: "Number",
    description:
      "Numeric input with optional min/max/step. Mantine NumberInput.",
    zodSchema: NumberQuestion,
    example: {
      id: "age",
      type: "number",
      label: "Age",
      config: {
        min: 0,
        max: 120,
        step: 1,
        default: 25,
      },
    },
  },
  {
    type: "select-string",
    label: "Dropdown (text)",
    description:
      "Single-value dropdown whose values are strings. Mantine Select.",
    zodSchema: StringSelectQuestion,
    example: {
      id: "country",
      type: "select-string",
      label: "Country",
      required: true,
      config: {
        placeholder: "Pick one",
        default: "JP",
        options: [
          { label: "Japan", value: "JP" },
          { label: "Thailand", value: "TH" },
          { label: "United States", value: "US" },
          { label: "Germany", value: "DE" },
        ],
      },
    },
  },
  {
    type: "select-number",
    label: "Dropdown (number)",
    description:
      "Single-value dropdown whose values are numbers (useful when feeding calculations).",
    zodSchema: NumberSelectQuestion,
    example: {
      id: "tshirt_size",
      type: "select-number",
      label: "T-shirt size (chest cm)",
      config: {
        default: 100,
        options: [
          { label: "S (90cm)", value: 90 },
          { label: "M (100cm)", value: 100 },
          { label: "L (110cm)", value: 110 },
          { label: "XL (120cm)", value: 120 },
        ],
      },
    },
  },
  {
    type: "multi-select",
    label: "Multi-select",
    description:
      "Pick zero or more values from a dropdown. Mantine MultiSelect. Value is a string array.",
    zodSchema: MultiSelectQuestion,
    example: {
      id: "languages",
      type: "multi-select",
      label: "Languages you speak",
      config: {
        placeholder: "Pick any",
        maxValues: 5,
        default: ["en"],
        options: [
          { label: "English", value: "en" },
          { label: "Japanese", value: "ja" },
          { label: "Thai", value: "th" },
          { label: "German", value: "de" },
          { label: "French", value: "fr" },
          { label: "Spanish", value: "es" },
        ],
      },
    },
  },
  {
    type: "radio",
    label: "Radio",
    description:
      "Single-choice rendered as radio buttons. Mantine Radio.Group. Google Forms' multiple choice.",
    zodSchema: RadioQuestion,
    example: {
      id: "contact_pref",
      type: "radio",
      label: "Preferred contact",
      required: true,
      config: {
        default: "email",
        options: [
          { label: "Email", value: "email" },
          { label: "Phone", value: "phone" },
          { label: "Carrier pigeon", value: "pigeon" },
        ],
      },
    },
  },
  {
    type: "checkbox-group",
    label: "Checkboxes",
    description:
      "Multi-choice rendered as checkboxes. Mantine Checkbox.Group. Google Forms' checkboxes.",
    zodSchema: CheckboxGroupQuestion,
    example: {
      id: "interests",
      type: "checkbox-group",
      label: "Interests",
      config: {
        default: ["coffee", "reading"],
        options: [
          { label: "Coffee", value: "coffee" },
          { label: "Cooking", value: "cooking" },
          { label: "Cycling", value: "cycling" },
          { label: "Reading", value: "reading" },
          { label: "Gaming", value: "gaming" },
        ],
      },
    },
  },
  {
    type: "boolean",
    label: "Switch",
    description: "Yes/no toggle. Mantine Switch. Value is a boolean.",
    zodSchema: BooleanQuestion,
    example: {
      id: "newsletter",
      type: "boolean",
      label: "Subscribe to newsletter",
      description: "We send one digest per week.",
      config: {
        default: true,
      },
    },
  },
  {
    type: "segmented",
    label: "Segmented control",
    description:
      "Single-choice rendered as a pill-style segmented control. Mantine SegmentedControl.",
    zodSchema: SegmentedQuestion,
    example: {
      id: "plan",
      type: "segmented",
      label: "Plan",
      config: {
        default: "pro",
        options: [
          { label: "Free", value: "free" },
          { label: "Pro", value: "pro" },
          { label: "Team", value: "team" },
        ],
      },
    },
  },
  {
    type: "slider",
    label: "Slider",
    description:
      "Numeric slider with optional marks. Mantine Slider. Google Forms' linear scale.",
    zodSchema: SliderQuestion,
    example: {
      id: "satisfaction",
      type: "slider",
      label: "Overall satisfaction",
      config: {
        min: 0,
        max: 10,
        step: 1,
        default: 7,
        marks: [
          { value: 0, label: "0" },
          { value: 5, label: "5" },
          { value: 10, label: "10" },
        ],
      },
    },
  },
  {
    type: "rating",
    label: "Rating",
    description:
      "Star rating with optional fractional precision. Mantine Rating.",
    zodSchema: RatingQuestion,
    example: {
      id: "quality",
      type: "rating",
      label: "Rate the product",
      config: {
        count: 5,
        fractions: 2,
        default: 4,
      },
    },
  },
  {
    type: "color",
    label: "Color",
    description: "Color picker with optional swatches. Mantine ColorInput.",
    zodSchema: ColorQuestion,
    example: {
      id: "fav_color",
      type: "color",
      label: "Favourite color",
      config: {
        default: "#7048e8",
        swatches: [
          "#fa5252",
          "#fd7e14",
          "#fab005",
          "#40c057",
          "#228be6",
          "#7048e8",
          "#000000",
          "#ffffff",
        ],
      },
    },
  },
  {
    type: "date",
    label: "Date",
    description: "Native date picker. Value is an ISO yyyy-MM-dd string.",
    zodSchema: DateQuestion,
    example: {
      id: "birthday",
      type: "date",
      label: "Birthday",
      config: {
        min: "1900-01-01",
        max: "2025-12-31",
      },
    },
  },
  {
    type: "time",
    label: "Time",
    description: "Native time picker. Value is an HH:mm string.",
    zodSchema: TimeQuestion,
    example: {
      id: "wake_time",
      type: "time",
      label: "Usual wake time",
      config: {
        default: "07:30",
      },
    },
  },
  {
    type: "datetime",
    label: "Date & time",
    description:
      "Native datetime-local picker. Value is an ISO yyyy-MM-ddTHH:mm string.",
    zodSchema: DateTimeQuestion,
    example: {
      id: "event_at",
      type: "datetime",
      label: "Event start",
      config: {
        default: "2026-06-01T19:00",
      },
    },
  },
  {
    type: "tags",
    label: "Tags",
    description:
      "Free-form chips/tags input. Mantine TagsInput. Value is a string array.",
    zodSchema: TagsQuestion,
    example: {
      id: "skills",
      type: "tags",
      label: "Skills",
      config: {
        placeholder: "Type and press Enter",
        maxTags: 8,
        default: ["typescript", "react"],
      },
    },
  },
  {
    type: "repeatable-group",
    label: "Repeatable group",
    description:
      "A fixed-count repeating section (e.g. 'measure the sample 8 times'). Child questions repeat exactly `count` times; answers are stored columnar (one array per child question id).",
    zodSchema: RepeatableGroupQuestion,
    example: {
      id: "measurement",
      type: "repeatable-group",
      label: "Sample measurements",
      description:
        "Each repetition captures one reading from Instrument A and one from Instrument B.",
      required: true,
      config: {
        count: 3,
        itemLabel: "Measurement",
        questions: [
          {
            id: "reading_a",
            type: "number",
            label: "Instrument A reading (mg)",
            required: true,
            config: {
              min: 0,
              step: 0.01,
              placeholder: "Reading A",
            },
          },
          {
            id: "reading_b",
            type: "number",
            label: "Instrument B reading (mg)",
            required: true,
            config: {
              min: 0,
              step: 0.01,
              placeholder: "Reading B",
            },
          },
        ],
      },
    },
  },
];

export function findGalleryEntry(type: string): GalleryEntry | undefined {
  return GALLERY.find((g) => g.type === type);
}
