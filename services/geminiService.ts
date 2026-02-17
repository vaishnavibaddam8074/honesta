import { GoogleGenAI, Type } from "@google/genai";

function cleanJsonResponse(text: string): string {
  if (!text) return "{}";
  let cleaned = text.replace(/```json\n?|```/g, "").trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return cleaned;
}

export async function generateVerificationQuestions(base64Image: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const promptText = `Analyze this image. 
  Generate exactly 2 SIMPLE questions that anyone could understand to verify ownership.
  Focus on:
  1. Primary color or Brand.
  2. One obvious shape or detail.
  
  Return ONLY JSON: 
  { 
    "title": "Short Item Name", 
    "questions": ["Simple Q1", "Simple Q2"], 
    "answers": ["Short A1", "Short A2"] 
  }`;

  try {
    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageData } },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: { type: Type.ARRAY, items: { type: Type.STRING } },
            answers: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["title", "questions", "answers"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No AI text");

    const data = JSON.parse(cleanJsonResponse(text));
    return {
      title: data.title || "Found Item",
      questions: data.questions || ["What color is this item?", "What is the brand?"],
      answers: data.answers || ["any", "any"]
    };
  } catch (error) {
    return {
      title: "Found Item",
      questions: ["What is the primary color of this item?", "Describe one unique feature or brand name visible on it."],
      answers: ["any", "any"]
    };
  }
}

export async function verifyAnswers(questions: string[], userAnswers: string[], correctAnswers: string[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Questions: ${JSON.stringify(questions)}
  User Answers: ${JSON.stringify(userAnswers)}
  Correct Reference: ${JSON.stringify(correctAnswers)}
  Is the user likely the owner? (Ignore minor typos).
  Return JSON: { "isCorrect": boolean }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { isCorrect: { type: Type.BOOLEAN } },
          required: ["isCorrect"]
        }
      },
    });
    
    return JSON.parse(cleanJsonResponse(response.text)).isCorrect;
  } catch (error) {
    let matches = 0;
    userAnswers.forEach((ans, i) => {
      const u = (ans || "").toLowerCase().trim();
      const c = (correctAnswers[i] || "").toLowerCase().trim();
      if (u && (u === c || u.includes(c) || c.includes(u))) matches++;
    });
    return matches >= 1;
  }
}