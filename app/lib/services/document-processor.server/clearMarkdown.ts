export function clearMarkdownAroundJson(extractedTextString: string): string {
  let extractedText = extractedTextString,
    llmError,
    llmComment;
  try {
    extractedText = JSON.parse(extractedTextString).text;
  } catch {}

  try {
    const regexExtracted = new RegExp("^```(json|JSON)(.*)```$", "s")
      .exec(extractedTextString)
      ?.at(2)
      ?.trim();

    if (!regexExtracted) throw new Error("No JSON found after regex cleansing");

    const extractedObject = JSON.parse(regexExtracted);

    // It should be HTML inside
    extractedText = extractedObject.text.replaceAll("\n", "");
    llmError = extractedObject.error;
    llmComment = extractedObject.comment;
  } catch (error) {
    console.log(error);
  }

  if (llmError) {
    throw new Error(llmError);
  }

  return extractedText;
}
