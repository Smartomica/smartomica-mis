import HtmlToDocx from "@turbodocx/html-to-docx";

export async function generateDocx(htmlContent: string): Promise<Buffer> {
  // Trim content to avoid leading whitespace issues
  const cleanContent = htmlContent.trim();

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Document</title>
</head>
<body>
${cleanContent}
</body>
</html>`;

  const buffer = await HtmlToDocx(fullHtml, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
    // Set standard margins (1440 twips = 1 inch) to ensure consistent layout
    margins: {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440,
    },
  });

  // Ensure returning a Buffer
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any);
}
