import { GoogleGenAI, Type } from "@google/genai";

export async function generateVerificationQuestions(base64Image: string) {
  try {
    // Moved inside to catch environment/key reference errors
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
    const ai = new GoogleGenAI({ apiKey: apiKey || '' });
    
    const prompt = `Analyze this lost item image and generate:
    1. A CATEGORY title (e.g., "Pen", "Bag", "Smartphone").
    2. Dynamic Verification Questions:
       - If the item is low-value (stationary, etc.), ask 1 question about COLOR or distinct physical mark.
       - If the item is high-value (Phone, Wallet, Electronics), ask 2-3 specific questions (Color, Brand, Model, Case type).
    CRITICAL: The public only sees a very dark B&W photo. Ask questions about details NOT visible in the dark silhouette.
    Provide output in JSON format.`;

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

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    // Return a safe fallback so the upload doesn't fail
    return {
      title: "Found Item",
      questions: ["Please describe the specific color or any unique identification marks of this item."],
      answers: ["any"]
    };
  }
}

export async function verifyAnswers(questions: string[], userAnswers: string[], correctAnswers: string[]) {
  try {
    const apiKey = typeof process !== 'undefined' ? process.env.API_KEY : '';
    const ai = new GoogleGenAI({ apiKey: apiKey || '' });

    const prompt = `Act as an ownership verifier for a lost and found system.
    Match the user's answers against the correct reference answers.
    User's responses are valid if they show specific knowledge of the item.
    Be flexible with natural language: "navy" matches "blue", "apple" matches "iphone".
    
    Questions: ${JSON.stringify(questions)}
    User Answers: ${JSON.stringify(userAnswers)}
    Correct Reference: ${JSON.stringify(correctAnswers)}
    
    Return isCorrect: true only if most key details match.`;

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
    
    return JSON.parse(response.text || '{"isCorrect":false}').isCorrect;
  } catch (error) {
    console.error("Gemini Verification Error:", error);
    // Simple fallback string matching if AI is unreachable
    return userAnswers.some((ans, i) => {
      const u = ans.toLowerCase().trim();
      const c = (correctAnswers[i] || "").toLowerCase().trim();
      return u === c || u.includes(c) || c.includes(u);
    });
  }
}