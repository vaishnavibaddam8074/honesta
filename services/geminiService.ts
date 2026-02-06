import { GoogleGenAI, Type } from "@google/genai";

export async function generateVerificationQuestions(base64Image: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Analyze this lost item image and generate:
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
              items: { type: Type.STRING }
            },
            answers: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["title", "questions", "answers"]
        }
      }
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    return {
      title: "Found Item",
      questions: ["Describe the specific color or marking of this item."],
      answers: ["any"]
    };
  }
}

export async function verifyAnswers(questions: string[], userAnswers: string[], correctAnswers: string[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Verify if the user answers match the correct reference answers for a lost item claim. 
  Be flexible with natural language (e.g., 'blue' matches 'dark blue', 'samsung' matches 'samsung galaxy').
  Questions: ${JSON.stringify(questions)}
  User Answers: ${JSON.stringify(userAnswers)}
  Correct Reference: ${JSON.stringify(correctAnswers)}
  If the answers show clear knowledge of the item, return isCorrect: true. Otherwise, false.`;

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
    console.error("Gemini Verification Error:", error);
    // Safety fallback: partial string matching if AI fails
    return userAnswers.some((ans, i) => 
      ans.toLowerCase().includes(correctAnswers[i].toLowerCase()) || 
      correctAnswers[i].toLowerCase().includes(ans.toLowerCase())
    );
  }
}