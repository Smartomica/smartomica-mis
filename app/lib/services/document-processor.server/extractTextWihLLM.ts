import type OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/index.mjs";
import { ProcessingMode } from "~/generated/client/enums";
import { LOCAL_LLM_MODE, MODEL_VISION } from "~/lib/openAi/config.server";
import { clearMarkdownAroundJson, type LLMResult } from "./clearMarkdown";
import { Lang } from "./const";
import { resolveMisPrompt } from "./resolveMisPrompt";

export async function extractText(
  openai: OpenAI,
  ...imageUrls: string[]
): Promise<LLMResult> {
  const imageMessages = imageUrls.map(
    function (imageUrl): ChatCompletionContentPart {
      return {
        type: "image_url",
        image_url: {
          url: imageUrl,
        },
      };
    },
  );

  const imageBlobMessages = !LOCAL_LLM_MODE
    ? []
    : await Promise.all(
        imageUrls.map(
          async function (imageUrl): Promise<ChatCompletionContentPart> {
            const imageBase64Response = await fetch(imageUrl);
            const imageBlob = await imageBase64Response.blob();
            const imageBase64 = await blobToBase64(imageBlob);
            return {
              type: "image_url",
              image_url: { url: imageBase64 },
            };
          },
        ),
      );

  const ocrPrompt = await resolveMisPrompt(
    ProcessingMode.OCR,
    Lang.Auto,
    Lang.EN,
  );

  const response = await openai.chat.completions.create({
    model: MODEL_VISION,
    messages: [
      ...ocrPrompt,
      {
        role: "user",
        content: LOCAL_LLM_MODE ? imageBlobMessages : imageMessages,
      },
    ],
    max_tokens: 30 * 1e3,
  });

  console.log({ response });
  return clearMarkdownAroundJson(response.choices[0]?.message?.content || "");
}

async function blobToBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64String = buffer.toString("base64");
  return `data:${blob.type};base64,${base64String}`;
}
