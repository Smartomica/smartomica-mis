export function clearMarkdownAroundJson(extractedTextString: string): string {
  let extractedText, llmError, llmComment;
  try {
    extractedText = new RegExp("^```(json|JSON)(.*)```$", "s")
      .exec(extractedTextString)
      ?.at(2)
      ?.trim();

    const extractedObject = JSON.parse(extractedText!);

    extractedText = extractedObject.text;
    llmError = extractedObject.error;
    llmComment = extractedObject.comment;
  } catch (error) {
    console.log(error);
    extractedText = extractedTextString;
  }

  if (llmError) {
    throw new Error(llmError);
  }

  return extractedText;
}
