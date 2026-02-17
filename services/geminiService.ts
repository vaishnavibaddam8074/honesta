import { GoogleGenAI, Type } from "@google/genai";

function cleanJsonResponse(text: string): string {
  if (!text) return "{}";
  // Remove markdown formatting if present
  let cleaned = text.replace(/```json\n?|```/g, "").trim();
  // Find the first { and last }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }
  return cleaned;
}

export async function generateVerificationQuestions(base64Image: string) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const promptText = `Analyze this lost item image accurately.
  Generate exactly 3 verification questions and their correct answers.
  Return only JSON: { "title": "Item Name", "questions": ["Q1", "Q2", "Q3"], "answers": ["A1", "A2", "A3"] }
  Focus on unique identifiers like color shades, logos, text, or damage marks.`;

  try {
    // Ensure image data is correctly formatted for Gemini
    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: imageData,
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
              description: "Must contain exactly 3 questions"
            },
            answers: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Must contain exactly 3 answers"
            }
          },
          required: ["title", "questions", "answers"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Empty AI response");

    const jsonStr = cleanJsonResponse(text);
    const data = JSON.parse(jsonStr);
    
    // Safety trimming/padding to ensure exactly 3
    if (!data.questions) data.questions = ["Please describe the item."];
    if (!data.answers) data.answers = ["any"];
    
    return {
      title: data.title || "Found Item",
      questions: data.questions.slice(0, 3),
      answers: data.answers.slice(0, 3)
    };
  } catch (error) {
    console.error("AI Question Generation Failure:", error);
    // Return a logical fallback rather than crashing
    return {
      title: "Found Item",
      questions: ["Describe a unique identifier of this item.", "What is the primary color?", "Where exactly was it found?"],
      answers: ["any", "any", "any"]
    };
  }
}

export async function verifyAnswers(questions: string[], userAnswers: string[], correctAnswers: string[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `Task: Ownership Validation. 
  Determine if the user's answers match the correct reference answers sufficiently.
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
    
    const text = response.text;
    if (!text) throw new Error("Empty AI response");
    
    const jsonStr = cleanJsonResponse(text);
    return JSON.parse(jsonStr).isCorrect;
  } catch (error) {
    console.error("AI Verification Failure:", error);
    // Simple local fallback comparison
    return userAnswers.some((ans, i) => {
      const u = (ans || "").toLowerCase().trim();
      const c = (correctAnswers[i] || "").toLowerCase().trim();
      return u !== "" && (u === c || u.includes(c) || c.includes(u));
    });
  }
}