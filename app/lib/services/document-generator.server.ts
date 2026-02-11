import HTMLtoDOCX from "html-to-docx";

export async function generateDocx(htmlContent: string): Promise<Buffer> {
  // Simple styling for the document
  const header = "<p>Translated Document</p>";
  
  // Wrap content if it's not a full HTML document
  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Document</title>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;

  const buffer = await HTMLtoDOCX(fullHtml, null, {
    table: { row: { cantSplit: true } },
    footer: true,
    pageNumber: true,
  });

  return buffer;
}
