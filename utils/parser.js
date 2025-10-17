const fs = require("fs").promises;
const path = require("path");
const mammoth = require("mammoth");
const logger = require("../config/logger");

const parseTextFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf8");
    return data.toString();
  } catch (error) {
    logger.error("Error reading text file:", error);
    throw new Error("Could not read the uploaded file.");
  }
};

const parseDocx = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (error) {
    logger.error("Error parsing DOCX:", error);
    throw new Error("Failed to process the Word document.");
  }
};

const parseXML = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, "utf8");
    const simplifiedXml = data
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return simplifiedXml.substring(0, 10000);
  } catch (error) {
    logger.error("Error parsing XML:", error);
    throw new Error("Failed to process the XML file.");
  }
};

const parseMozaikFile = async (filePath, originalName) => {
  const ext = path.extname(originalName).toLowerCase();

  try {
    let extractedText = "Unsupported file type for text extraction.";

    switch (ext) {
      case ".txt":
      case ".log":
        extractedText = await parseTextFile(filePath);
        break;
      case ".docx":
        extractedText = await parseDocx(filePath);
        break;
      case ".xml":
        extractedText = await parseXML(filePath);
        break;
      case ".cab":
      case ".cabx":
      case ".mzb":
        extractedText =
          "Binary project file uploaded. Filename and type provided as context.";
        break;
    }

    const truncatedText =
      extractedText.length > 12000
        ? extractedText.substring(0, 12000) + "..."
        : extractedText;
    return `File: ${originalName}\nType: ${ext}\nExtracted Content:\n${truncatedText}`;
  } catch (error) {
    logger.error("File parsing error:", error);
    throw error;
  }
};

module.exports = { parseMozaikFile };
