import * as XLSX from "xlsx";
import mammoth from "mammoth";

export async function extractTextFromFile(
  buffer: Buffer,
  fileName: string
): Promise<{ text: string; isPasswordProtected: boolean }> {
  const ext = fileName.split(".").pop()?.toLowerCase();

  try {
    switch (ext) {
      case "xlsx":
      case "xls":
        return extractExcel(buffer);
      case "pdf":
        return extractPdf(buffer);
      case "docx":
      case "doc":
        return extractWord(buffer);
      case "txt":
      case "csv":
      case "tsv":
      case "log":
      case "md":
      case "html":
      case "htm":
      case "xml":
      case "json":
        return { text: buffer.toString("utf-8"), isPasswordProtected: false };
      default:
        return { text: "", isPasswordProtected: false };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes("password") ||
      errorMessage.includes("encrypted") ||
      errorMessage.includes("Password")
    ) {
      return { text: "", isPasswordProtected: true };
    }

    console.error(`Failed to extract text from ${fileName}:`, error);
    return { text: "", isPasswordProtected: false };
  }
}

function extractExcel(buffer: Buffer): { text: string; isPasswordProtected: boolean } {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const texts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    texts.push(`[${sheetName}]\n${csv}`);
  }

  return { text: texts.join("\n\n"), isPasswordProtected: false };
}

async function extractPdf(buffer: Buffer): Promise<{ text: string; isPasswordProtected: boolean }> {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();
    const text = result.text ?? "";
    return { text, isPasswordProtected: false };
  } catch (error) {
    console.error("PDF extraction failed (may not be supported in this environment):", error);
    return { text: "", isPasswordProtected: false };
  }
}

async function extractWord(buffer: Buffer): Promise<{ text: string; isPasswordProtected: boolean }> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value, isPasswordProtected: false };
}
