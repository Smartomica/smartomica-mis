import z from "zod";

const llmSchema = z.object({
  error: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  lng: z.string().optional().nullable(),

  text: z.string().transform(function (val) {
    return val.replaceAll("\n", "");
  }),
});

export type LLMResult = z.infer<typeof llmSchema>;

export function clearMarkdownAroundJson(
  extractedTextString: string,
): LLMResult {
  let extractedObject;

  // Fixes json in markdown code blocks
  try {
    const regexExtracted = new RegExp("^```(json|JSON)(.*)```$", "s")
      .exec(extractedTextString)
      ?.at(2)
      ?.trim();

    if (!regexExtracted) throw new Error("No JSON found after regex cleansing");

    extractedObject = llmSchema.parse(JSON.parse(regexExtracted));

    return extractedObject;
  } catch (error) {
    console.log(error);
  }

  // Fixes plain json without code blocks
  try {
    extractedObject = llmSchema.parse(JSON.parse(extractedTextString));
    return extractedObject;
  } catch (error) {
    console.log(error);
  }

  if (extractedObject?.error) {
    throw new Error(extractedObject.error);
  }

  return {
    text: extractedTextString,
    error: null,
    comment: null,
    lng: null,
  };
}
