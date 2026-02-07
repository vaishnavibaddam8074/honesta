import { GoogleGenAI, Type } from "@google/genai";

function cleanJsonResponse(text: string): string {
  return text.replace(/```json\n?|```/g, "").trim();
}

export async function generateVerificationQuestions(base64Image: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const promptText = `Analyze this lost item image.
  Return JSON: { "title": "Category Name", "questions": ["Q1", "Q2", "Q3"], "answers": ["A1", "A2", "A3"] }
  IMPORTANT: Provide EXACTLY 3 specific questions about hidden details like serial numbers, marks, or specific textures.
  Do not exceed 3 questions.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image.split(',')[1],
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
              items: { type: Type.STRING },
              description: "Maximum 3 questions"
            },
            answers: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Maximum 3 answers"
            }
          },
          required: ["title", "questions", "answers"],
        },
      },
    });

    const jsonStr = cleanJsonResponse(response.text || "{}");
    const data = JSON.parse(jsonStr);
    
    // Safety check to force max 3
    if (data.questions && data.questions.length > 3) {
      data.questions = data.questions.slice(0, 3);
      data.answers = data.answers.slice(0, 3);
    }
    
    return data;
  } catch (error) {
    console.error("AI Generation Error:", error);
    return {
      title: "Found Item",
      questions: ["Please describe a unique physical detail of this item."],
      answers: ["any"]
    };
  }
}

export async function verifyAnswers(questions: string[], userAnswers: string[], correctAnswers: string[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Act as a validator. Match user answers to references. 
  Questions: ${JSON.stringify(questions)}
  User Answers: ${JSON.stringify(userAnswers)}
  Correct Reference: ${JSON.stringify(correctAnswers)}
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
    
    const jsonStr = cleanJsonResponse(response.text || "{\"isCorrect\":false}");
    return JSON.parse(jsonStr).isCorrect;
  } catch (error) {
    return userAnswers.some((ans, i) => {
      const u = ans.toLowerCase().trim();
      const c = (correctAnswers[i] || "").toLowerCase().trim();
      return u !== "" && (u === c || u.includes(c));
    });
  }
}