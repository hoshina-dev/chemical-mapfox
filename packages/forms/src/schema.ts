// SOURCE OF TRUTH: ../experiment-template.schema.json (JSON Schema), which the
// backend also matches. The Zod schemas below are hand-written to mirror that
// JSON Schema for runtime validation + TypeScript types on the frontend. They
// are kept in sync MANUALLY — accepted tech debt, since the schema rarely
// changes. If you edit one, edit the other. See packages/forms/README.md.
import { z } from "zod";

export const StringSelectOption = z.object({
  label: z.string(),
  value: z.string(),
});
export type StringSelectOption = z.infer<typeof StringSelectOption>;

export const NumberSelectOption = z.object({
  label: z.string(),
  value: z.number(),
});
export type NumberSelectOption = z.infer<typeof NumberSelectOption>;

const BaseQuestion = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

export const StringQuestion = BaseQuestion.extend({
  type: z.literal("string"),
  config: z
    .object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      default: z.string().optional(),
      placeholder: z.string().optional(),
    })
    .optional(),
});
export type StringQuestion = z.infer<typeof StringQuestion>;

export const TextareaQuestion = BaseQuestion.extend({
  type: z.literal("textarea"),
  config: z
    .object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      default: z.string().optional(),
      placeholder: z.string().optional(),
      minRows: z.number().optional(),
      maxRows: z.number().optional(),
    })
    .optional(),
});
export type TextareaQuestion = z.infer<typeof TextareaQuestion>;

export const PasswordQuestion = BaseQuestion.extend({
  type: z.literal("password"),
  config: z
    .object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      placeholder: z.string().optional(),
    })
    .optional(),
});
export type PasswordQuestion = z.infer<typeof PasswordQuestion>;

export const NumberQuestion = BaseQuestion.extend({
  type: z.literal("number"),
  config: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      step: z.number().optional(),
      default: z.number().optional(),
      placeholder: z.string().optional(),
    })
    .optional(),
});
export type NumberQuestion = z.infer<typeof NumberQuestion>;

export const StringSelectQuestion = BaseQuestion.extend({
  type: z.literal("select-string"),
  config: z.object({
    options: z.array(StringSelectOption),
    default: z.string().optional(),
    placeholder: z.string().optional(),
  }),
});
export type StringSelectQuestion = z.infer<typeof StringSelectQuestion>;

export const NumberSelectQuestion = BaseQuestion.extend({
  type: z.literal("select-number"),
  config: z.object({
    options: z.array(NumberSelectOption),
    default: z.number().optional(),
    placeholder: z.string().optional(),
  }),
});
export type NumberSelectQuestion = z.infer<typeof NumberSelectQuestion>;

export const MultiSelectQuestion = BaseQuestion.extend({
  type: z.literal("multi-select"),
  config: z.object({
    options: z.array(StringSelectOption),
    default: z.array(z.string()).optional(),
    placeholder: z.string().optional(),
    maxValues: z.number().optional(),
  }),
});
export type MultiSelectQuestion = z.infer<typeof MultiSelectQuestion>;

export const RadioQuestion = BaseQuestion.extend({
  type: z.literal("radio"),
  config: z.object({
    options: z.array(StringSelectOption),
    default: z.string().optional(),
  }),
});
export type RadioQuestion = z.infer<typeof RadioQuestion>;

export const CheckboxGroupQuestion = BaseQuestion.extend({
  type: z.literal("checkbox-group"),
  config: z.object({
    options: z.array(StringSelectOption),
    default: z.array(z.string()).optional(),
  }),
});
export type CheckboxGroupQuestion = z.infer<typeof CheckboxGroupQuestion>;

export const BooleanQuestion = BaseQuestion.extend({
  type: z.literal("boolean"),
  config: z
    .object({
      default: z.boolean().optional(),
    })
    .optional(),
});
export type BooleanQuestion = z.infer<typeof BooleanQuestion>;

export const SegmentedQuestion = BaseQuestion.extend({
  type: z.literal("segmented"),
  config: z.object({
    options: z.array(StringSelectOption),
    default: z.string().optional(),
  }),
});
export type SegmentedQuestion = z.infer<typeof SegmentedQuestion>;

export const SliderQuestion = BaseQuestion.extend({
  type: z.literal("slider"),
  config: z.object({
    min: z.number(),
    max: z.number(),
    step: z.number().optional(),
    default: z.number().optional(),
    marks: z
      .array(z.object({ value: z.number(), label: z.string().optional() }))
      .optional(),
  }),
});
export type SliderQuestion = z.infer<typeof SliderQuestion>;

export const RatingQuestion = BaseQuestion.extend({
  type: z.literal("rating"),
  config: z
    .object({
      count: z.number().optional(),
      fractions: z.number().optional(),
      default: z.number().optional(),
    })
    .optional(),
});
export type RatingQuestion = z.infer<typeof RatingQuestion>;

export const ColorQuestion = BaseQuestion.extend({
  type: z.literal("color"),
  config: z
    .object({
      default: z.string().optional(),
      placeholder: z.string().optional(),
      swatches: z.array(z.string()).optional(),
      format: z.enum(["hex", "hexa", "rgb", "rgba", "hsl", "hsla"]).optional(),
    })
    .optional(),
});
export type ColorQuestion = z.infer<typeof ColorQuestion>;

export const DateQuestion = BaseQuestion.extend({
  type: z.literal("date"),
  config: z
    .object({
      default: z.string().optional(),
      min: z.string().optional(),
      max: z.string().optional(),
    })
    .optional(),
});
export type DateQuestion = z.infer<typeof DateQuestion>;

export const TimeQuestion = BaseQuestion.extend({
  type: z.literal("time"),
  config: z
    .object({
      default: z.string().optional(),
      step: z.number().optional(),
    })
    .optional(),
});
export type TimeQuestion = z.infer<typeof TimeQuestion>;

export const DateTimeQuestion = BaseQuestion.extend({
  type: z.literal("datetime"),
  config: z
    .object({
      default: z.string().optional(),
    })
    .optional(),
});
export type DateTimeQuestion = z.infer<typeof DateTimeQuestion>;

export const TagsQuestion = BaseQuestion.extend({
  type: z.literal("tags"),
  config: z
    .object({
      default: z.array(z.string()).optional(),
      placeholder: z.string().optional(),
      maxTags: z.number().optional(),
      suggestions: z.array(z.string()).optional(),
    })
    .optional(),
});
export type TagsQuestion = z.infer<typeof TagsQuestion>;

export const NestedQuestion = z.discriminatedUnion("type", [
  StringQuestion,
  TextareaQuestion,
  PasswordQuestion,
  NumberQuestion,
  StringSelectQuestion,
  NumberSelectQuestion,
  MultiSelectQuestion,
  RadioQuestion,
  CheckboxGroupQuestion,
  BooleanQuestion,
  SegmentedQuestion,
  SliderQuestion,
  RatingQuestion,
  ColorQuestion,
  DateQuestion,
  TimeQuestion,
  DateTimeQuestion,
  TagsQuestion,
]);
export type NestedQuestion = z.infer<typeof NestedQuestion>;

export const RepeatableGroupQuestion = BaseQuestion.extend({
  type: z.literal("repeatable-group"),
  config: z.object({
    count: z.number().int().min(1),
    itemLabel: z.string().optional(),
    questions: z.array(NestedQuestion).min(1),
  }),
});
export type RepeatableGroupQuestion = z.infer<typeof RepeatableGroupQuestion>;

export const Question = z.discriminatedUnion("type", [
  StringQuestion,
  TextareaQuestion,
  PasswordQuestion,
  NumberQuestion,
  StringSelectQuestion,
  NumberSelectQuestion,
  MultiSelectQuestion,
  RadioQuestion,
  CheckboxGroupQuestion,
  BooleanQuestion,
  SegmentedQuestion,
  SliderQuestion,
  RatingQuestion,
  ColorQuestion,
  DateQuestion,
  TimeQuestion,
  DateTimeQuestion,
  TagsQuestion,
  RepeatableGroupQuestion,
]);
export type Question = z.infer<typeof Question>;
export type QuestionType = Question["type"];
export type QuestionId = Question["id"];

export const FormDoc = z.object({
  title: z.string(),
  description: z.string().optional(),
  questions: z.array(Question),
});
export type FormDoc = z.infer<typeof FormDoc>;

export const Calculation = z.object({
  formula: z.string(),
  result: z
    .union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])),
    ])
    .optional(),
});
export type Calculation = z.infer<typeof Calculation>;

export const Calculations = z.record(z.string(), Calculation);
export type Calculations = z.infer<typeof Calculations>;

export const AnswerValue = z
  .union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
    z.array(
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string()),
      ]),
    ),
    z.null(),
  ])
  .optional();
export type AnswerValue = z.infer<typeof AnswerValue>;

export const FormAnswers = z.record(z.string(), AnswerValue);
export type FormAnswers = z.infer<typeof FormAnswers>;

export const Values = FormAnswers;
export type Values = FormAnswers;

export const ExperimentTemplate = z.object({
  clientForm: FormDoc,
  labForm: FormDoc,
  calculations: Calculations,
  values: Values.optional(),
});
export type ExperimentTemplate = z.infer<typeof ExperimentTemplate>;
