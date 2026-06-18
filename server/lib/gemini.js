require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getModel(temperature = 0.65) {
  return genAI.getGenerativeModel({
    model: "models/gemini-2.5-flash",
    generationConfig: { temperature },
  });
}

module.exports = { getModel };
