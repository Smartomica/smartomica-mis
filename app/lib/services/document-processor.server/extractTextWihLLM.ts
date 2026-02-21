import type OpenAI from "openai";
import { OPENROUTER_MODEL_VISION } from "~/env.server";

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

  const response = await openai.chat.completions.create({
    model: OPENROUTER_MODEL_VISION,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all text from this image(s). Return only the extracted text, no markdown formatting or comments. Only in the original languages. No complicated guesses. Use - instead",
          },
          ...imageMessages,
        ],
      },
    ],
    max_tokens: 4000,
  });

  return response.choices[0]?.message?.content || "";
}
