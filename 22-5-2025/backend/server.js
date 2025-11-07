const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

console.log("🔑 API Key loaded?", !!process.env.OPENAI_API_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.post("/api/generate-reading-material", async (req, res) => {
  const model = req.body.model || "openai/gpt-4o";
  const task = req.body.task || "task1";
  const difficulty = req.body.difficulty || "Normal";
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY is missing!");
    return res.status(500).json({ error: "Missing API key" });
  }

  // 🎯 Dynamic difficulty per task
    const taskLevelMap = {
    task1: {
      level: "IELTS 5.0–5.5 (Beginner)",
      paraphrase: "Use mostly direct wording. A few paraphrases are okay but not required.",
      wordLimit: "around 120–160 words",
      answerStyle: "Keep each option short, ideally under 10 words.",
      questionCount: 5  
    },
    task2: {
      level: "IELTS 6.0–6.5 (Intermediate)",
      paraphrase: "Use some paraphrasing. Avoid copying exact wording from the passage.",
      wordLimit: "around 200–250 words",
      answerStyle: "Options should be 1 concise sentence (max 12 words).",
      questionCount: 10
    },
    task3: {
      level: "IELTS 6.5–7.0 (Upper-intermediate)",
      paraphrase: "Frequent paraphrasing, subtle meaning differences.",
      wordLimit: "around 280–350 words",
      answerStyle: "Options can be up to 15 words.",
      questionCount: 10
    },
    task4: {
      level: "IELTS 7.0–8.0 (Advanced)",
      paraphrase: "Strong paraphrasing and inference, options can rephrase ideas heavily.",
      wordLimit: "around 350–450 words",
      answerStyle: "Options can be complex sentences (under 20 words).",
      questionCount: 10
    },
  };

  const current = taskLevelMap[task] || taskLevelMap.task1;

  const generatePrompt = `
  You are an IELTS reading and listening practice content generator.

  Generate ONE reading passage (${current.wordLimit}), difficulty: ${current.level}.
  Use natural, clear English that sounds like a real IELTS Listening transcript or Reading text.
  Make sure it's easy to follow and not too academic.

  Then create **${current.questionCount} multiple-choice questions (A–D options)**.

  Each question must have:
  - one correct answer (use "correctIndex")
  - short options (${current.answerStyle})
  - Questions should relate directly to the paragraph content.

  Paraphrasing rules: ${current.paraphrase}

  Return your answer STRICTLY in JSON format:
  {
    "paragraph": "string",
    "questions": [
      {
        "question": "string",
        "options": ["string", "string", "string", "string"],
        "correctIndex": number
      }
    ]
  }

  Make sure:
  - Paragraph is continuous text, no line breaks.
  - JSON format must be valid and parseable.
  `;



  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model,
        messages: [
          { role: "system", content: "You are a professional IELTS content generator." },
          { role: "user", content: generatePrompt },
        ],
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const raw = response.data.choices?.[0]?.message?.content || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      console.error("❌ JSON parse error:", err);
      return res.status(500).json({ error: "Invalid JSON format from AI", raw });
    }

    res.json(parsed);
  } catch (error) {
    console.error("❌ Error generating reading material:", error.response?.data || error);
    res.status(500).json({ error: "Failed to generate reading material" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
