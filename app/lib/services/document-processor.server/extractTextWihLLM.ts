import type OpenAI from "openai";
import { OPENROUTER_MODEL_VISION } from "~/env.server";
import { resolveMisPrompt } from "./resolveMisPrompt";
import { ProcessingMode } from "~/generated/client/enums";
import { Lang } from "./const";

export async function extractText(
  openai: OpenAI,
  ...imageUrls: string[]
): Promise<string> {
  const imageMessages = imageUrls.map(function (imageUrl) {
    return {
      type: "image_url",
      image_url: {
        url: imageUrl,
      },
    } as const;
  });

  const ocrPrompt = await resolveMisPrompt(
    ProcessingMode.OCR,
    Lang.Auto,
    Lang.EN,
  );

  const response = await openai.chat.completions.create({
    model: OPENROUTER_MODEL_VISION,
    messages: [
      ...ocrPrompt,
      {
        role: "user",
        content: imageMessages,
      },
    ],
    max_tokens: 4000,
  });

  return response.choices[0]?.message?.content || "";
}
