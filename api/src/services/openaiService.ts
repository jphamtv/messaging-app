import OpenAI from "openai";
import dotenv from "dotenv";
import { logger } from "../utils/logger";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function generateBotResponse(
  systemPrompt: string,
  quotes: string[],
  conversationHistory: Array<{ role: string, content: string }>,
  maxTokens: number = 150
): Promise<string> {
  try {
    // Select up to 15 random quotes if available
    const selectedQuotes = quotes && quotes.length > 0
      ? quotes.sort(() => 0.5 - Math.random()).slice(0, 15)
      : [];
    
    // Enhance system prompt with quotes
    const enhancedPrompt = selectedQuotes.length > 0
      ? `${systemPrompt}\n\nOccasionally incorporate these quotes (make sure to remove the quotations) when appropriate:\n${selectedQuotes.join('\n')}`
      : systemPrompt;
    
    // Format messages for text-only processing
    const messages = [
      {
        role: "developer",
        content: enhancedPrompt
      },
      ...conversationHistory.map(message => ({
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content
      }))
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages as any,
      max_tokens: maxTokens,
      temperature: 0.75,
    });

    return response.choices[0].message.content || "I'm having trouble connecting right now.";
  } catch (err) {
    logger.error(`Error generating bot response: ${err}`);
    return "I'm unable to respond right now. Please try again later."
  }
}