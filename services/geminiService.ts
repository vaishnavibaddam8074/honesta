
import { GoogleGenAI, Type } from "@google/genai";

const getAI = () => {
  const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export async function generateVerificationQuestions(base64Image: string) {
  const ai = getAI();
  const prompt = `Analyze this lost item image and generate:
  1. A CATEGORY title (e.g., "Pen", "Bag", "Smartphone").
  2. Dynamic Verification Questions:
     - If the item is low-value (Pen, Pencil, basic Bottle, small stationery), ask exactly 1 question about COLOR.
     - If the item is high-value or tech (Phone, Laptop, Watch, Wallet), ask 2-3 specific questions (Color, Brand, Model, or distinct markings).
  CRITICAL: The public sees a very dark B&W photo. Ask questions that cannot be guessed from a dark silhouette.
  Provide output in JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "1 question for low-value, 2-3 for high-value."
            },
            answers: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Factual reference answers."
            }
          },
          required: ["title", "questions", "answers"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      title: "Lost Item",
      questions: ["What color is this item?"],
      answers: [""]
    };
  }
}

export async function verifyAnswers(questions: string[], userAnswers: string[], correctAnswers: string[]) {
  const ai = getAI();
  const prompt = `Verify these answers for ownership of a lost item. 
  Be smart: "dark blue" is same as "blue".
  Questions: ${JSON.stringify(questions)}
  User Answers: ${JSON.stringify(userAnswers)}
  Correct Reference: ${JSON.stringify(correctAnswers)}
  Return JSON with boolean 'isCorrect'.`;

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
          required: ["isCorrect"]
        }
      }
    });
    return JSON.parse(response.text).isCorrect;
  } catch (error) {
    return false;
  }
}