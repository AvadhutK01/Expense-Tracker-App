import { Request, Response } from 'express';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import Category from '../models/categoriesModel.js';
import TransactionLog from '../models/transactionLogModel.js';
import NoteModel from '../models/notesModel.js';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define tools
const functionDeclarations: FunctionDeclaration[] = [
  {
    name: 'getCategories',
    description: 'Get all the categories and their current amounts from the database. Use this to summarize data.',
  },
  {
    name: 'getRecentTransactions',
    description: 'Get the 10 most recent transactions (additions or subtractions).',
  },
  {
    name: 'modifyCategoryAmount',
    description: 'Add or reduce money from a category.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        categoryName: {
          type: Type.STRING,
          description: 'The name of the category (e.g., Food, Travel, Salary). It must closely match an existing category.',
        },
        amount: {
          type: Type.NUMBER,
          description: 'The amount to add or subtract.',
        },
        action: {
          type: Type.STRING,
          description: 'Whether to add or subtract.',
          enum: ['add', 'subtract'],
        },
        note: {
          type: Type.STRING,
          description: 'A note explaining the transaction.',
        },
      },
      required: ['categoryName', 'amount', 'action', 'note'],
    },
  },
  {
    name: 'getNote',
    description: 'Get the current user note from the database.',
  },
  {
    name: 'updateNote',
    description: 'Update the user note in the database. Use this when the user wants to take a note, save a reminder, or update their existing note.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        content: {
          type: Type.STRING,
          description: 'The new content of the note.',
        },
      },
      required: ['content'],
    },
  },
];

export const chatWithAi = async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, history } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      return;
    }

    const chat = ai.chats.create({
      model: 'gemini-3.5-flash-lite',
      config: {
        systemInstruction: `
        You are a helpful and professional financial assistant for an Expense Tracker app. 
        You can answer questions about the user's expenses and income, and manage their notes.
        If the user asks you to add or reduce money, you MUST use the modifyCategoryAmount tool. 
        If the user asks to save a note or reminder, you MUST use the updateNote tool.
        Always be polite and keep your answers concise.
        If a category doesn't exist when trying to modify, explain that to the user.
        The project currency is INR (₹/Rs) only. Always format your amounts using this currency.
        IMPORTANT: Always format your responses using clean Markdown. Use **bolding** for amounts or key terms, and use lists or bullet points for readability. DO NOT use raw text dumps.
        `,
        tools: [{ functionDeclarations }],
        temperature: 0.2,
      },
      history: history || [], // Expected format: [{role: 'user', parts: [{text: '...'}]}, {role: 'model', parts: [{text: '...'}]}]
    });

    let response = await chat.sendMessage({ message });

    // Handle function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const call of response.functionCalls) {
        let toolResult: any = {};

        if (call.name === 'getCategories') {
          const categories = await Category.find();
          toolResult = { categories };
        } else if (call.name === 'getRecentTransactions') {
          const logs = await TransactionLog.find().sort({ createdAt: -1 }).limit(10);
          toolResult = { logs };
        } else if (call.name === 'getNote') {
          const note = await NoteModel.findOne();
          toolResult = { note: note ? note.content : 'No note exists yet.' };
        } else if (call.name === 'updateNote') {
          const args = call.args as any;
          const { content } = args;
          let note = await NoteModel.findOne();
          if (!note) {
            note = await NoteModel.create({ content });
          } else {
            note.content = content;
            await note.save();
          }
          toolResult = { success: true, message: 'Note updated successfully.', note: note.content };
        } else if (call.name === 'modifyCategoryAmount') {
          const args = call.args as any;
          const { categoryName, amount, action, note } = args;

          // Find closest category by name (case insensitive)
          const category = await Category.findOne({ name: { $regex: new RegExp(categoryName, 'i') } });

          if (!category) {
            toolResult = { error: `Category '${categoryName}' not found.` };
          } else {
            const previousAmount = category.amount;
            const newAmount = action === 'add' ? previousAmount + amount : previousAmount - amount;

            if (newAmount < 0) {
              toolResult = { error: `Insufficient funds in category '${category.name}'. Current amount: ${previousAmount}.` };
            } else {
              category.amount = newAmount;
              await category.save();

              await TransactionLog.create({
                categoryId: category._id,
                categoryName: category.name,
                changeType: action,
                changeAmount: amount,
                previousAmount,
                newAmount,
                transaction_note: note,
              });

              toolResult = { success: true, message: `Successfully ${action}ed ${amount} to/from ${category.name}. New balance: ${newAmount}.` };
            }
          }
        }

        // Send tool response back to Gemini
        response = await chat.sendMessage({
          message: [{
            functionResponse: {
              name: call.name,
              response: toolResult
            }
          }]
        });
      }
    }

    res.status(200).json({ text: response.text });
  } catch (error) {
    console.error('AI Chat Error:', error);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
};

export const getSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
      return;
    }

    const categories = await Category.find();
    const logs = await TransactionLog.find().sort({ createdAt: -1 }).limit(10);
    const note = await NoteModel.findOne();

    const prompt = `
    You are a financial advisor. Please summarize the following financial data concisely, giving insights on where the user is spending most and overall health.
    The project currency is INR (₹/Rs) only. Always format your amounts using this currency.
    IMPORTANT: Always format your response using clean Markdown. Use headings, **bolding** for amounts or key terms, and bullet points. DO NOT use plain text blocks.
        
    Categories and balances: ${JSON.stringify(categories)}
    Recent transactions: ${JSON.stringify(logs)}
    User's current note/reminders: ${note ? note.content : 'None'}
    `;

    const chat = ai.chats.create({
      model: 'gemini-3.5-flash-lite',
      config: { temperature: 0.2 },
    });

    const response = await chat.sendMessage({ message: prompt });

    res.status(200).json({ summary: response.text });
  } catch (error) {
    console.error('AI Summary Error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
};
