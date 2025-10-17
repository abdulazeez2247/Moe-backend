const { OpenAI } = require("openai");
const Question = require("../models/Question");
const logger = require("../config/logger");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const buildSystemPrompt = (platform, version) => {
  const basePrompt = `You are Moe, a Mission-Oriented Expert for woodworking software. Provide precise, step-by-step instructions. Format answers in clear Markdown. Be concise but thorough.`;
  if (!platform || platform === "generic") return basePrompt;
  return `${basePrompt} The user is specifically using ${platform} ${
    version ? "version " + version : ""
  }. Tailor your instructions to this software's interface and terminology.`;
};

const callGPT = async (messages, model) => {
  try {
    const completion = await openai.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.1,
      max_tokens: 1500,
    });

    const usage = completion.usage;
    const answer = completion.choices[0]?.message?.content;

    if (!answer || answer.trim() === "") {
      throw new Error("Empty response from OpenAI API");
    }

    return { answer, usage };
  } catch (error) {
    logger.error("OpenAI API Error:", error);
    throw new Error(`Failed to get answer from AI: ${error.message}`);
  }
};

const generateAnswer = async (
  questionText,
  platform,
  version,
  model,
  fileContext = null
) => {
  try {
    const systemPrompt = buildSystemPrompt(platform, version);
    const userMessage = fileContext
      ? `${questionText}\n\nRelevant file context:\n${fileContext}`
      : questionText;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];

    const { answer, usage } = await callGPT(messages, model);
    const sources = [];

    const tokens = usage
      ? {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0,
          total_tokens: usage.total_tokens || 0,
        }
      : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return { text: answer, tokens, sources };
  } catch (error) {
    logger.error("Error in generateAnswer:", error);
    throw error;
  }
};

module.exports = { generateAnswer };
