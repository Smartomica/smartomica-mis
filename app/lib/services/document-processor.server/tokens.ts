export function estimateTokensNeeded(
  files: Array<{ size: number }>,
  mode: string,
): number {
  // Simple estimation: 1 token per 4 characters, with overhead for processing
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const baseTokens = Math.ceil(totalSize / 4);

  // Add overhead based on mode
  const overhead = mode === "ocr" ? 1.2 : 2.0; // Translation needs more tokens
  return Math.ceil(baseTokens * overhead) * 1e-4;
}

export function estimateTokensUsed(input: string, output: string): number {
  // Simple estimation: 1 token per 4 characters for both input and output
  const inputTokens = Math.ceil(input.length / 4);
  const outputTokens = Math.ceil(output.length / 4);
  return inputTokens + outputTokens;
}
