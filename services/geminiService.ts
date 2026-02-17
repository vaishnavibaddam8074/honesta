import { GoogleGenAI, Type } from "@google/genai";

function cleanJsonResponse(text: string): string {
  if (!text) return "{}";
  // Remove markdown formatting if present
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
  
  const promptText = `Act as a helpful campus assistant. 
  Analyze this image of a lost item. 
  Generate 2 or 3 VERY SIMPLE verification questions.
  Questions must be:
  - Easy for everyone to understand (Simple English).
  - Related to obvious features (Color, Brand, Shape, or unique stickers/scratches).
  - Not too technical.
  
  Return ONLY JSON format: 
  { 
    "title": "Short Item Name", 
    "questions": ["Simple Question 1", "Simple Question 2"], 
    "answers": ["Brief Answer 1", "Brief Answer 2"] 
  }`;

  try {
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
              description: "2 or 3 simple questions"
            },
            answers: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "2 or 3 brief answers"
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
    
    return {
      title: data.title || "Found Item",
      questions: data.questions || ["What color is it?", "What brand is it?"],
      answers: data.answers || ["any", "any"]
    };
  } catch (error) {
    console.error("AI Generation Failed:", error);
    // Reliable simple fallback
    return {
      title: "Found Item",
      questions: [
        "What is the main color of this item?",
        "Is there any name or logo written on it?",
        "Describe any one small detail (like a scratch or sticker)."
      ],
      answers: ["any", "any", "any"]
    };
  }
}

export async function verifyAnswers(questions: string[], userAnswers: string[], correctAnswers: string[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `You are a fair judge. 
  Questions: ${JSON.stringify(questions)}
  User Answers: ${JSON.stringify(userAnswers)}
  Correct Reference: ${JSON.stringify(correctAnswers)}
  
  Determine if the user's answers are substantially correct. 
  Ignore minor spelling mistakes or case sensitivity (e.g., 'blue' is 'Blue').
  Be lenient if they described the same thing.
  
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
    console.error("AI Verification Failed:", error);
    // Local fallback matching
    let matches = 0;
    userAnswers.forEach((ans, i) => {
      const u = (ans || "").toLowerCase().trim();
      const c = (correctAnswers[i] || "").toLowerCase().trim();
      if (u && (u === c || u.includes(c) || c.includes(u))) matches++;
    });
    return matches >= Math.max(1, Math.floor(questions.length / 2));
  }
}