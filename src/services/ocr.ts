import Tesseract from 'tesseract.js';

export async function extractTextFromImage(file: File): Promise<string> {
  try {
    const imageUrl = URL.createObjectURL(file);
    
    // Recognize text using Tesseract.js with Simplified Chinese and English
    const result = await Tesseract.recognize(
      imageUrl,
      'chi_sim+eng',
      {
        logger: m => console.log('OCR Progress:', m) // Optional: logs progress to console
      }
    );
    
    URL.revokeObjectURL(imageUrl);
    return result.data.text || '';
  } catch (error) {
    console.error("OCR Error:", error);
    return '';
  }
}
