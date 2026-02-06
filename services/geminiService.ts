import { GoogleGenAI, Type } from "@google/genai";

export async function generateVerificationQuestions(base64Image: string) {
  // Use process.env.API_KEY directly as required by guidelines
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const promptText = `Analyze this lost item image and generate:
  1. A CATEGORY title (e.g., "Pen", "Bag", "Smartphone").
  2. Dynamic Verification Questions:
     - If the item is low-value (stationary, etc.), ask 1 question about COLOR or distinct physical mark.
     - If the item is high-value (Phone, Wallet, Electronics), ask 2-3 specific questions (Color, Brand, Model, Case type).
  CRITICAL: The public only sees a very dark B&W photo. Ask questions about details NOT visible in the dark silhouette.
  Provide output in JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1], // Extract base64 part
            },
          },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            answers: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "questions", "answers"],
          propertyOrdering: ["title", "questions", "answers"]
        },
      },
    });

    // Use .text property as per guidelines
    const jsonStr = response.text || "{}";
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    // Fallback if AI service fails
    return {
      title: "Found Item",
      questions: ["Please describe the specific color or any unique identification marks of this item."],
      answers: ["any"]
    };
  }
}

export async function verifyAnswers(questions: string[], userAnswers: string[], correctAnswers: string[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Act as an ownership verifier for a lost and found system.
  Match the user's answers against the correct reference answers.
  User's responses are valid if they show specific knowledge of the item.
  Be flexible with natural language: "navy" matches "blue", "apple" matches "iphone".
  
  Questions: ${JSON.stringify(questions)}
  User Answers: ${JSON.stringify(userAnswers)}
  Correct Reference: ${JSON.stringify(correctAnswers)}
  
  Return isCorrect: true only if most key details match.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isCorrect: { type: Type.BOOLEAN }
          },
          required: ["isCorrect"],
          propertyOrdering: ["isCorrect"]
        }
      },
    });
    
    const jsonStr = response.text || "{\"isCorrect\":false}";
    return JSON.parse(jsonStr).isCorrect;
  } catch (error) {
    console.error("Gemini Verification Error:", error);
    // Fallback: simple string matching
    return userAnswers.some((ans, i) => {
      const u = ans.toLowerCase().trim();
      const c = (correctAnswers[i] || "").toLowerCase().trim();
      if (!u || !c) return false;
      return u === c || u.includes(c) || c.includes(u);
    });
  }
}