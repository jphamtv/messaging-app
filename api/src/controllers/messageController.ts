import { Response, RequestHandler } from "express";
import { body, validationResult } from "express-validator";
import {
  create,
  markAsRead,
  deleteById,
  findByConversationId,
} from "../models/messageModel";
import { findById } from "../models/conversationModel";
import { findBotById } from "../models/authModel";
import { AuthRequest } from "../types";
import { getFileUrl } from "../middleware/uploadMiddleware";
import { notifyNewMessage } from "../services/socketService";
import { generateBotResponse } from "../services/openaiService";
import { notifyTypingStarted, notifyTypingStopped } from "../services/socketService";

export const getConversationMessages = [
  async (req: AuthRequest, res: Response) => {
    try {
      const conversation = await findById(req.params.conversationId);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Authorization check
      const isParticipant = conversation.participants.some(
        p => p.userId === req.user.id
      );
      
      if (!isParticipant) {
        return res.status(403).json({
          error: "FORBIDDEN",
          message: "Not authorized to view these messages"
        });
      }

      res.json({ messages: conversation.messages });
    } catch (err) {
      console.error('Get messages error:', err);
      res.status(500).json({ message: 'Error getting messages' });
    }
  }
] as unknown as RequestHandler[];

export const createMessage = [
  body("text")
    .if((value, { req }) => !req.file) // Only apply this validation if there's no image file
    .trim()
    .isLength({ min: 1, max: 5000 })
    .withMessage("Message must be between 1 and 5000 characters"),
  body("text")
    .if((value, { req }) => req.file) // Apply this validation if there's an image file
    .optional() // Make text optional
    .isLength({ max: 5000 }) // Still enforce text length if provided
    .withMessage("Message text cannot exceed 5000 characters"),
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { text } = req.body;
      const conversationId = req.params.conversationId;
      const senderId = req.user.id;

      // Allow either, text, image, or both
      if (!text && !req.file) {
        return res.status(400).json({ message: 'Message must contain text or an image' });
      }

      // Process image if present
      let imageUrl = null;
      if (req.file) {
        imageUrl = getFileUrl(req.file.filename, 'message');
      }

      const message = await create({
        text: text || "", 
        imageUrl,
        conversation: { connect: { id: conversationId } },
        sender: { connect: { id: senderId } }
      });

      // Notify about new message via socket
      notifyNewMessage(message, conversationId, senderId);

      // Send response immediately with user's message
      res.json({ message });

      // Get conversation for bot check
      const conversation = await findById(conversationId);
      if (!conversation) {
        console.error('Conversation not found for bot processing')
        return;
      }

      // Look for bot participant
      const botParticipant = conversation.participants.find(
        p => p.user.isBot === true && p.user.id !== senderId
      );

      if (botParticipant && senderId !== botParticipant.user.id) {
        (async () => {
          const botId = botParticipant.user.id;
          try {
            // Get bot user with its system prompt
            const botUser = await findBotById(botId);
            if (!botUser) return;
  
            // Get conversation history (last 10 messages for context)
            const messageHistory = await findByConversationId(conversationId);
    
            // Format history for OpenAI API
            const conversationHistory = messageHistory
              .map(msg => ({
                role: msg.sender.id === botUser.id ? 'assistant' : 'user',
                content: msg.text
              }))
              .reverse();
            
            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 1500) + 750));
            
            // Send typing indicator via socket
            notifyTypingStarted(botId, conversationId);
  
            // Generate bot response
            const botResponse = await generateBotResponse(
              botUser.botSystemPrompt || "You are a helpful assistant",
              botUser.botQuotes || [],
              conversationHistory
            );

            await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 3000) + 1500));
      
            // Stop typing indicator
            notifyTypingStopped(botId, conversationId);
      
            // Save bot message response as message
            const botMessage = await create({
              text: botResponse,
              conversation: { connect: { id: conversationId } },
              sender: { connect: { id: botUser.id } }
            });
        
            // Notify about bot message
            notifyNewMessage(botMessage, conversationId, botId);
          } catch (err) {
            console.error("Bot response error:", err);
            // Cannot access botUser here as it's scoped to the try block
            notifyTypingStopped(botId, conversationId);
          }
        })();
      }

    } catch (err) {
      console.error("Create message error: ", err);
      res.status(500).json({ message: "Error creating message" });
    }
  }
] as unknown as RequestHandler[];

export const markMessageAsRead = [
  async (req: AuthRequest, res: Response) => {
    try {
      const messageId = req.params.id;
      const message = await markAsRead(messageId);
      res.json({ message });
    } catch (err) {
      console.error("Mark as read error: ", err);
      res.status(500).json({ message: "Error marking message as read" });
    }
  }
] as unknown as RequestHandler[];

export const deleteMessage = [
  async (req: AuthRequest, res: Response) => {
    try {
      const messageId = req.params.id;
      await deleteById(messageId);
      res.json({ message: "Message deleted successfully" });
    } catch (err) {
      console.error("Delete message error: ", err);
      res.status(500).json({ message: "Error deleting message" });
    }
  }
] as unknown as RequestHandler[];