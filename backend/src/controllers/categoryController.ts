import { Request, Response, NextFunction } from 'express';
import CategoryModel, { ICategory as ICat, ICategory } from '../models/categoriesModel.js';
import RecurringCategoryModel from '../models/recurringCategoriesModel.js';
import TransactionLogModel from '../models/transactionLogModel.js';
import NoteModel from '../models/notesModel.js';
import { Model } from 'mongoose';
import AutoDebitModel from '../models/autoDebitModel.js';

interface CategoryInput {
    name: string;
    amount: number;
    isRepeat: boolean;
    isAddToSavings: boolean;
    isUsedForExpense: boolean;
}

interface AutoDebitInput {
    amount: number;
    categoryToDeduct: string;
    debitDateTime: Date;
}

interface UpdateAutoDebitInput {
    _id: string;
    amount?: number;
    categoryToDeduct?: string;
    debitDateTime?: Date;
}

interface UpdateCategoriesRequestBody {
    mode: 'permanent' | 'temporary';
    categories: CategoryInput[];
}

interface DeleteCategoriesRequestBody {
    names: string[];
}

interface UpdateSingleCategoryInput {
    name: string;
    amount: number;
    type: 'add' | 'subtract';
}

/**
 * Clears existing entries and initializes both Category and RecurringCategory collections.
 * Ensures "loan" category exists and names are unique.
 */
export async function initiateCategories(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const inputs: CategoryInput[] = req.body;

        if (!inputs.some((c) => c.name.toLowerCase() === 'loan' || !inputs.some((c) => c.name.toLowerCase() === 'savings'))) {
            res.status(400).json({ message: 'The "loan" or "savings" category is required.' });
            return;
        }

        const seen = new Set<string>();
        for (const cat of inputs) {
            const key = cat.name.trim().toLowerCase();
            if (seen.has(key)) {
                res.status(400).json({ message: `Duplicate category: ${cat.name}` });
                return;
            }
            seen.add(key);
        }

        await Promise.all([
            CategoryModel.deleteMany({}),
            RecurringCategoryModel.deleteMany({}),
            TransactionLogModel.deleteMany({}),
            NoteModel.deleteMany({}),
            AutoDebitModel.deleteMany({}),
        ]);

        const docs = inputs.map((c) => {
            let isUsedForExpense = c.isUsedForExpense ?? true;
            let isAddToSavings = c.isAddToSavings ?? true;

            if (c.name.trim().toLowerCase() === 'loan') {
                isUsedForExpense = false;
                isAddToSavings = false;
            }
            if (c.name.trim().toLowerCase() === 'savings') isUsedForExpense = true;

            return {
                name: c.name.trim(),
                amount: c.amount,
                isAddToSavings: isAddToSavings,
                isUsedForExpense: isUsedForExpense
            };
        });

        const categories = await CategoryModel.insertMany(docs);

        // Log category creation
        for (const cat of categories) {
            await TransactionLogModel.create({
                categoryId: cat._id,
                categoryName: cat.name,
                changeType: 'add',
                changeAmount: cat.amount,
                previousAmount: 0,
                newAmount: cat.amount,
                transaction_note: 'Category created'
            });
        }

        const recurringDocs = docs.filter((c) => c.name.trim().toLowerCase() !== 'loan');
        const recurring = await RecurringCategoryModel.insertMany(recurringDocs);

        res.status(201).json({
            message: 'Categories initialized successfully.',
            count: categories.length,
        });
        return;
    } catch (err) {
        console.error('initiateCategories message:', err);
        res.status(500).json({
            message: 'Something went wrong!'
        })
        return;
    }
}

export async function addNewCategories(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const inputs: CategoryInput[] = req.body;

        if (!Array.isArray(inputs) || inputs.length === 0) {
            res.status(400).json({ message: 'Input must be a non-empty array' });
            return;
        }

        const categoryCount = await CategoryModel.countDocuments();
        const recurringCount = await RecurringCategoryModel.countDocuments();

        if (categoryCount === 0 || recurringCount === 0) {
            res.status(400).json({
                message:
                    'Categories not initialized yet. Please call initiateCategories API first.',
            });
            return;
        }

        const seen = new Set<string>();
        for (const cat of inputs) {
            const key = cat.name.trim().toLowerCase();
            if (seen.has(key)) {
                res.status(400).json({ message: `Duplicate category in input: ${cat.name}` });
            }
            seen.add(key);
        }

        const namesToCheck = inputs.map(c => c.name.trim());

        const regexQueries = namesToCheck.map(name => new RegExp(`^${name}$`, 'i'));

        const existingCategories = await CategoryModel.find({
            name: { $in: regexQueries },
        }).lean();

        const existingRecurring = await RecurringCategoryModel.find({
            name: { $in: regexQueries },
        }).lean();

        if (existingCategories.length > 0 || existingRecurring.length > 0) {
            const existingNames = [
                ...existingCategories.map(c => c.name),
                ...existingRecurring.map(c => c.name),
            ];
            res.status(400).json({
                message: `Categories already exist: ${[...new Set(existingNames)].join(', ')}`,
            });
            return;
        }

        const normalDocs = inputs
            .filter(c => !c.isRepeat)
            .map(c => {
                let isUsedForExpense = c.isUsedForExpense ?? true;
                let isAddToSavings = c.isAddToSavings ?? true;

                if (c.name.trim().toLowerCase() === 'loan') {
                    isUsedForExpense = false;
                    isAddToSavings = false;
                }
                if (c.name.trim().toLowerCase() === 'savings') isUsedForExpense = true;

                return {
                    name: c.name.trim(),
                    amount: c.amount,
                    isAddToSavings: isAddToSavings,
                    isUsedForExpense: isUsedForExpense
                };
            });

        const recurringDocs = inputs
            .filter(c => c.isRepeat)
            .map(c => {
                let isUsedForExpense = c.isUsedForExpense ?? true;
                let isAddToSavings = c.isAddToSavings ?? true;

                if (c.name.trim().toLowerCase() === 'loan') {
                    isUsedForExpense = false;
                    isAddToSavings = false;
                }
                if (c.name.trim().toLowerCase() === 'savings') isUsedForExpense = true;

                return {
                    name: c.name.trim(),
                    amount: c.amount,
                    isAddToSavings: isAddToSavings,
                    isUsedForExpense: isUsedForExpense
                };
            });

        const insertOps: Promise<any>[] = [];

        let insertedNormal: any[] = [];
        let insertedRecurring: any[] = [];

        if (normalDocs.length > 0) {
            const normal = await CategoryModel.insertMany(normalDocs);
            insertedNormal = normal;
        }
        if (recurringDocs.length > 0) {
            const recurring = await CategoryModel.insertMany(recurringDocs);
            await RecurringCategoryModel.insertMany(recurringDocs);
            insertedRecurring = recurring;
        }

        const allInserted = [...insertedNormal, ...insertedRecurring];
        for (const cat of allInserted) {
            await TransactionLogModel.create({
                categoryId: cat._id,
                categoryName: cat.name,
                changeType: 'add',
                changeAmount: cat.amount,
                previousAmount: 0,
                newAmount: cat.amount,
                transaction_note: 'Category created'
            });
        }

        res.status(201).json({
            message: 'New categories added successfully',
            count: inputs.length,
        });
        return;
    } catch (err) {
        console.error('addNewCategories message:', err);
        res.status(500).json({
            message: 'Something went wrong!'
        })
        return;
    }
}

export async function updateCategories(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { mode, categories }: UpdateCategoriesRequestBody = req.body;

        if (!Array.isArray(categories) || categories.length === 0) {
            res.status(400).json({ message: 'Categories array is required and cannot be empty.' });
            return;
        }

        if (mode !== 'permanent' && mode !== 'temporary') {
            res.status(400).json({ message: 'Mode must be either "permanent" or "temporary".' });
            return;
        }

        const modelToUpdate = (mode === 'permanent'
            ? RecurringCategoryModel
            : CategoryModel) as Model<ICategory>;

        const seen = new Set<string>();
        for (const cat of categories) {
            const key = cat.name.trim().toLowerCase();
            if (seen.has(key)) {
                res.status(400).json({ message: `Duplicate category in input: ${cat.name}` });
                return;
            }
            seen.add(key);
        }

        const updatedDocs: (ICategory | null)[] = [];
        for (const cat of categories) {
            const existing = await modelToUpdate.findOne({ name: new RegExp(`^${cat.name.trim()}$`, 'i') });
            if (existing) {
                const previousAmount = existing.amount;
                const newAmount = cat.amount;
                const changeAmount = Math.abs(newAmount - previousAmount);
                const changeType = newAmount >= previousAmount ? 'add' : 'subtract';

                existing.amount = newAmount;

                if (cat.name.trim().toLowerCase() === 'loan') {
                    existing.isUsedForExpense = false;
                    existing.isAddToSavings = false;
                } else if (cat.name.trim().toLowerCase() === 'savings') {
                    existing.isUsedForExpense = true;
                } else if ('isUsedForExpense' in cat) {
                    existing.isUsedForExpense = cat.isUsedForExpense;
                }

                await existing.save();

                if (mode === 'permanent' && 'isRepeat' in cat) {
                    await RecurringCategoryModel.findOneAndUpdate(
                        { name: new RegExp(`^${cat.name.trim()}$`, 'i') },
                        { status: cat.isRepeat }
                    );
                }

                updatedDocs.push(existing);

                if (changeAmount !== 0) {
                    await TransactionLogModel.create({
                        categoryId: existing._id,
                        categoryName: existing.name,
                        changeType,
                        changeAmount,
                        previousAmount,
                        newAmount,
                        transaction_note: changeType === 'add'
                            ? `money added to ${existing.name} ${mode === 'permanent' ? ' (recurring)' : ''}`
                            : `money deducted from ${existing.name} ${mode === 'permanent' ? ' (recurring)' : ''}`
                    });
                }
            } else {
                updatedDocs.push(null);
            }
        }

        const notFound = categories
            .map((c, idx) => ({ cat: c, updated: updatedDocs[idx] }))
            .filter(({ updated }) => !updated)
            .map(({ cat }) => cat.name);

        if (notFound.length > 0) {
            res.status(404).json({
                message: `Categories not found for update: ${notFound.join(', ')}`,
            });
            return;
        }

        res.status(200).json({
            message: `Categories updated successfully in ${mode} mode.`,
            updatedCount: updatedDocs.length,
        });
    } catch (err) {
        console.error('updateCategories message:', err);
        res.status(500).json({
            message: 'Something went wrong!'
        });
    }
}
interface UpdateSingleCategoryInput {
    name: string;
    amount: number;
    type: 'add' | 'subtract';
    transaction_note?: string;
}

export async function updateSingleCategory(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { name, amount, type }: UpdateSingleCategoryInput = req.body;

        if (!name || typeof amount !== 'number' || !['add', 'subtract'].includes(type)) {
            res.status(400).json({ message: 'Invalid input: name, amount, and type ("add" or "subtract") are required.' });
            return;
        }

        if (amount < 0) {
            res.status(400).json({ message: 'Amount must be non-negative.' });
            return;
        }

        const category = await CategoryModel.findOne({ name: new RegExp(`^${name.trim()}$`, 'i') });

        if (!category) {
            res.status(404).json({ message: `Category "${name}" not found.` });
            return;
        }

        const previousAmount = category.amount;
        let newAmount: number;

        if (type === 'add') {
            newAmount = previousAmount + amount;
        } else {
            newAmount = previousAmount - amount;
            if (newAmount < 0) {
                res.status(400).json({
                    message: `Subtraction would result in negative amount for category "${name}".`,
                });
                return;
            }
        }

        category.amount = newAmount;
        await category.save();

        const { transaction_note } = req.body;

        await TransactionLogModel.create({
            categoryId: category._id,
            categoryName: category.name,
            changeType: type,
            changeAmount: amount,
            previousAmount,
            newAmount,
            transaction_note: transaction_note || undefined
        });

        res.status(200).json({
            message: `Category "${name}" updated successfully.`,
            category: { name: category.name, amount: category.amount },
        });
        return;
    } catch (err) {
        console.error('updateSingleCategory message:', err);
        res.status(500).json({
            message: 'Something went wrong!'
        })
        return;
    }
}

/**
 * Fetches all categories from the CategoryModel.
 */
export async function getAllCategories(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { type = '' } = req.query;

        const [categoriesCount, recurringCount] = await Promise.all([
            CategoryModel.countDocuments(),
            RecurringCategoryModel.countDocuments(),
        ]);

        if (categoriesCount === 0 && recurringCount === 0) {
            console.log('Initializing default categories...');

            const baseCategories = [
                { name: 'loan', amount: 0 },
                { name: 'savings', amount: 0 },
            ];

            const recurringCategories = [
                { name: 'savings', amount: 0 },
            ];

            await Promise.all([
                CategoryModel.insertMany(baseCategories),
                RecurringCategoryModel.insertMany(recurringCategories),
            ]);

            console.log('Default categories initialized.');
        }

        let categories = [];
        if (type === 'recurring') {
            categories = await RecurringCategoryModel.find().lean();
        } else {
            const rawCategories = await CategoryModel.find().lean();

            // Calculate trends for savings and loan (last 48 hours)
            const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

            categories = await Promise.all(rawCategories.map(async (cat) => {
                const name = cat.name.toLowerCase();
                if (name === 'savings' || name === 'loan') {
                    const latestLog = await TransactionLogModel.findOne({
                        categoryName: cat.name,
                        createdAt: { $gte: twoDaysAgo }
                    })
                        .sort({ createdAt: -1 })
                        .lean();

                    if (latestLog) {
                        return {
                            ...cat,
                            trend: {
                                direction: latestLog.changeType === 'add' ? 'up' : 'down',
                                changeType: latestLog.changeType
                            }
                        };
                    }
                }
                return cat;
            }));
        }

        res.status(200).json({
            message: 'Fetched all categories successfully.',
            count: categories.length,
            categories,
        });
        return;
    } catch (err) {
        console.error('getAllCategories message:', err);
        res.status(500).json({
            message: 'Something went wrong!',
        });
        return;
    }
}

/**
 * Fetches paginated transaction logs.
 */
export async function getTransactionLogs(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const logs = await TransactionLogModel.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .lean();

        const total = await TransactionLogModel.countDocuments();

        res.status(200).json({
            message: 'Fetched logs successfully.',
            logs,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (err) {
        console.error('getTransactionLogs error:', err);
        res.status(500).json({ message: 'Failed to fetch logs' });
    }
}

/**
 * Fetches graph data: daily savings/loan amounts from transaction logs.
 * Fills gaps between dates with the last known value (forward fill).
 * Does not backfill before the first transaction.
 */
export async function getGraphData(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        // Get savings and loan logs sorted by date
        const savingsLogs = await TransactionLogModel.find({ categoryName: { $regex: /^savings$/i } })
            .sort({ createdAt: 1 })
            .lean();

        const loanLogs = await TransactionLogModel.find({ categoryName: { $regex: /^loan$/i } })
            .sort({ createdAt: 1 })
            .lean();

        // Helper to get date string in IST timezone using original format
        const getDateString = (date: Date): string => {
            return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).toLocaleDateString('en-IN');
        };

        // Group by date (IST), keeping last entry per day, then fill gaps
        const groupByDate = (logs: any[]) => {
            if (logs.length === 0) return [];

            // Group logs by date, keeping last entry per day
            const map = new Map<string, number>();
            for (const log of logs) {
                const dateStr = getDateString(new Date(log.createdAt));
                map.set(dateStr, log.newAmount);
            }

            // Get sorted dates
            const dates = Array.from(map.keys()).sort((a, b) => {
                // Parse dates in en-IN format (DD/MM/YYYY) for proper sorting
                const [dayA, monthA, yearA] = a.split('/').map(Number);
                const [dayB, monthB, yearB] = b.split('/').map(Number);
                const dateA = new Date(yearA, monthA - 1, dayA);
                const dateB = new Date(yearB, monthB - 1, dayB);
                return dateA.getTime() - dateB.getTime();
            });
            if (dates.length === 0) return [];

            // Fill gaps from first transaction date to TODAY with last known values
            const result: { date: string; amount: number }[] = [];
            
            // Parse first date
            const [dayFirst, monthFirst, yearFirst] = dates[0].split('/').map(Number);
            const firstDate = new Date(yearFirst, monthFirst - 1, dayFirst);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0); // Reset to start of day

            let currentDate = new Date(firstDate);
            let lastAmount = map.get(dates[0])!;

            while (currentDate <= today) {
                const dateStr = currentDate.toLocaleDateString('en-IN');
                if (map.has(dateStr)) {
                    lastAmount = map.get(dateStr)!;
                }
                result.push({ date: dateStr, amount: lastAmount });

                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
            }

            return result;
        };

        res.status(200).json({
            message: 'Graph data fetched.',
            savings: groupByDate(savingsLogs),
            loan: groupByDate(loanLogs),
        });
    } catch (err) {
        console.error('getGraphData error:', err);
        res.status(500).json({ message: 'Failed to fetch graph data' });
    }
}

export async function payLoanAmount(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { name, amount }: CategoryInput = req.body;

        if (!name || typeof name !== 'string') {
            res
                .status(400)
                .json({ message: 'Invalid input: "name" (string) is required.' });
            return;
        }
        if (typeof amount !== 'number' || isNaN(amount)) {
            res
                .status(400)
                .json({ message: 'Invalid input: "amount" (number) is required.' });
            return;
        }
        if (amount <= 0) {
            res
                .status(400)
                .json({ message: '"amount" must be greater than zero.' });
            return;
        }

        const category = await CategoryModel.findOne({
            name: new RegExp(`^${name.trim()}$`, 'i'),
        });
        if (!category) {
            res
                .status(404)
                .json({ message: `Category "${name}" not found.` });
            return;
        }

        const loanCat = await CategoryModel.findOne({
            name: new RegExp(`^loan$`, 'i'),
        });
        if (!loanCat) {
            res
                .status(500)
                .json({ message: 'Internal message: "loan" category missing.' });
            return;
        }

        if (category.amount < amount) {
            res.status(400).json({
                message: `Insufficient funds in "${category.name}". Current: ${category.amount}, requested: ${amount}.`,
            });
            return;
        }
        if (loanCat.amount < amount) {
            res.status(400).json({
                message: `Insufficient funds in "loan". Current: ${loanCat.amount}, requested: ${amount}.`,
            });
            return;
        }

        const prevCatAmount = category.amount;
        const prevLoanAmount = loanCat.amount;

        category.amount -= amount;
        loanCat.amount -= amount;

        await Promise.all([
            category.save(),
            loanCat.save(),
            TransactionLogModel.create({
                categoryId: category._id,
                categoryName: category.name,
                changeType: 'subtract',
                changeAmount: amount,
                previousAmount: prevCatAmount,
                newAmount: category.amount,
                transaction_note: `Paid loan from ${category.name}`
            }),
            TransactionLogModel.create({
                categoryId: loanCat._id,
                categoryName: loanCat.name,
                changeType: 'subtract',
                changeAmount: amount,
                previousAmount: prevLoanAmount,
                newAmount: loanCat.amount,
                transaction_note: `Loan payment received from ${category.name}`
            })
        ]);

        res.status(200).json({
            message: `Paid ${amount} from "${category.name}" and "loan" successfully.`,
            categories: [
                { name: category.name, amount: category.amount },
                { name: loanCat.name, amount: loanCat.amount },
            ],
        });
        return;
    } catch (err) {
        console.error('payLoanAmount message:', err);
        res.status(500).json({
            message: 'Something went wrong!'
        })
        return;
    }
}

export async function cronController(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const allCategories = await CategoryModel.find().lean();

        let totalToSave = 0;
        for (const cat of allCategories) {
            const name = cat.name.trim().toLowerCase();
            const isAddToSavings = cat.isAddToSavings || false;
            if (name !== 'loan' && name !== 'savings' && isAddToSavings) {
                totalToSave += cat.amount;
            }
        }

        const savingsCategory = await CategoryModel.findOneAndUpdate(
            { name: /^savings$/i },
            { $inc: { amount: totalToSave } },
            { new: true }
        );

        if (!savingsCategory) {
            console.warn('[Update] No "savings" category found to update.');
        } else {
            console.log(`[Update] Transferred ${totalToSave} to "savings". New amount: ${savingsCategory.amount}`);
        }

        await CategoryModel.updateMany(
            { name: { $nin: [/^savings$/i, /^loan$/i] } },
            { $set: { amount: 0 } }
        );
        console.log('[Update] Reset amounts of all categories except "savings" and "loan" to 0.');

        const recurringCats = await RecurringCategoryModel.find({ status: true }).lean();

        for (const rec of recurringCats) {
            const updated = await CategoryModel.findOneAndUpdate(
                { name: new RegExp(`^${rec.name.trim()}$`, 'i') },
                { $inc: { amount: rec.amount } },
                { new: true }
            );

            if (!updated) {
                console.warn(
                    `[Recurring Update] No matching category for "${rec.name}". Skipped.`
                );
            } else {
                console.log(
                    `[Recurring Update] "${rec.name}" increased by ${rec.amount}. New amount: ${updated.amount}`
                );
                await TransactionLogModel.create({
                    categoryId: updated._id,
                    categoryName: updated.name,
                    changeType: 'add',
                    changeAmount: rec.amount,
                    previousAmount: updated.amount - rec.amount,
                    newAmount: updated.amount,
                    transaction_note: 'Monthly recurring update'
                });
            }
        }
        res.status(200).json({
            message: "cron ran succesfully!"
        });
        return;
    } catch (err) {
        console.error('Error running monthly recurring update:', err);
        res.status(500).json({
            message: 'Something went wrong!'
        })
        return;
    }
}

export const bankEmiDebitCron = async (req: Request,
    res: Response,
    next: NextFunction) => {
    try {
        const debitAmount = 965;

        const updatedSavings = await CategoryModel.findOneAndUpdate(
            { name: /^savings$/i },
            { $inc: { amount: -debitAmount } },
            { new: true }
        );

        if (!updatedSavings) {
            console.warn('[Bank EMI Debit] "savings" category not found.');
        } else {
            console.log(`[Bank EMI Debit] Debited ${debitAmount} from "savings". New amount: ${updatedSavings.amount}`);
        }

        const updatedLoan = await CategoryModel.findOneAndUpdate(
            { name: /^loan$/i },
            { $inc: { amount: -debitAmount } },
            { new: true }
        );

        if (!updatedLoan) {
            console.warn('[Bank EMI Debit] "loan" category not found.');
        } else {
            console.log(`[Bank EMI Debit] Debited ${debitAmount} from "loan". New amount: ${updatedLoan.amount}`);
            await TransactionLogModel.create({
                categoryId: updatedLoan._id,
                categoryName: updatedLoan.name,
                changeType: 'subtract',
                changeAmount: debitAmount,
                previousAmount: updatedLoan.amount + debitAmount,
                newAmount: updatedLoan.amount,
                transaction_note: 'Bank EMI debit'
            });
            // Also log for savings
            if (updatedSavings) {
                await TransactionLogModel.create({
                    categoryId: updatedSavings._id,
                    categoryName: updatedSavings.name,
                    changeType: 'subtract',
                    changeAmount: debitAmount,
                    previousAmount: updatedSavings.amount + debitAmount,
                    newAmount: updatedSavings.amount,
                    transaction_note: 'Bank EMI debit'
                });
            }
        }
        res.status(200).json({
            message: "cron ran succesfully!"
        });
        return;
    } catch (err) {
        console.error('Error running bank EMI debit cron:', err);
        console.error('Error running monthly recurring update:', err);
        res.status(500).json({
            message: 'Something went wrong!'
        })
        return;
    }
};

export async function deleteCategory(
    req: Request<{}, {}, DeleteCategoriesRequestBody>,
    res: Response,
    next: NextFunction
) {
    try {
        const { names } = req.body;

        if (!Array.isArray(names) || names.length === 0) {
            res.status(400).json({ message: 'Invalid input: "names" must be a non-empty array of strings.' });
            return;
        }

        const lowerNames = names.map((n) => n.trim().toLowerCase()).filter(Boolean);

        if (lowerNames.length === 0) {
            res.status(400).json({ message: 'All category names are empty or invalid.' });
            return;
        }

        const protectedCats = ['loan', 'savings'];
        if (lowerNames.some((n) => protectedCats.includes(n))) {
            res.status(400).json({
                message: 'Cannot delete protected categories: "loan" or "savings".',
            });
            return;
        }

        const regexList = lowerNames.map((n) => new RegExp(`^${n}$`, 'i'));

        // Fetch category IDs before deleting to clean up logs
        const categoriesToDelete = await CategoryModel.find({ name: { $in: regexList } }).select('_id');
        const categoryIds = categoriesToDelete.map(c => c._id);

        const [deletedFromMain, deletedFromRecurring] = await Promise.all([
            CategoryModel.deleteMany({ name: { $in: regexList } }),
            RecurringCategoryModel.deleteMany({ name: { $in: regexList } }),
            TransactionLogModel.deleteMany({ categoryId: { $in: categoryIds } })
        ]);
        const totalDeleted = (deletedFromMain?.deletedCount || 0) + (deletedFromRecurring?.deletedCount || 0);

        if (totalDeleted === 0) {
            res.status(404).json({ message: 'No matching categories found to delete.' });
            return;
        }

        res.status(200).json({
            message: `Deleted ${totalDeleted} categories successfully.`,
            deletedFrom: {
                CategoryModel: deletedFromMain?.deletedCount || 0,
                RecurringCategoryModel: deletedFromRecurring?.deletedCount || 0,
            },
        });
        return;
    } catch (err) {
        console.error('deleteCategory message:', err);
        res.status(500).json({
            message: 'Something went wrong while deleting categories.',
        });
        return;
    }
}

export async function revertLatestTransaction(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const latestLog = await TransactionLogModel.findOne().sort({ createdAt: -1 });

        if (!latestLog) {
            res.status(404).json({ message: 'No transaction logs found to revert.' });
            return;
        }

        const category = await CategoryModel.findById(latestLog.categoryId);
        if (!category) {
            res.status(404).json({ message: 'Associated category not found.' });
            return;
        }

        category.amount = latestLog.previousAmount;
        await category.save();

        await TransactionLogModel.findByIdAndDelete(latestLog._id);

        res.status(200).json({
            message: `Reverted latest transaction for category "${category.name}".`,
            revertedTransaction: {
                category: category.name,
                revertedToAmount: category.amount,
                originalChange: {
                    type: latestLog.changeType,
                    amount: latestLog.changeAmount,
                    previousAmount: latestLog.previousAmount,
                    newAmount: latestLog.newAmount,
                },
            },
        });
    } catch (err) {
        console.error('revertLatestTransaction error:', err);
        res.status(500).json({ message: 'Something went wrong while reverting transaction.' });
    }
}

export const createOrUpdateNote = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        let { content } = req.body;

        if (!content || typeof content !== 'string' || !content.trim()) {
            content = " ";
        }

        const existingNote = await NoteModel.findOne();

        if (!existingNote) {
            const newNote = await NoteModel.create({ content });
            res.status(201).json({
                message: 'Note created successfully.',
                note: newNote,
            });
            return;
        }

        existingNote.content = content.trim();
        await existingNote.save();

        res.status(200).json({
            message: 'Note updated successfully.',
            note: existingNote,
        });
        return;
    } catch (err) {
        console.error('createOrUpdateNote error:', err);
        res.status(500).json({
            message: 'Something went wrong while creating or updating note.',
        });
        return;
    }
};

export const getNote = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const note = await NoteModel.findOne();

        if (!note) {
            res.status(200).json({ message: 'Note fetched successfully.' });
            return;
        }

        res.status(200).json({
            message: 'Note fetched successfully.',
            note,
        });
    } catch (err) {
        console.error('getNote error:', err);
        res.status(500).json({
            message: 'Something went wrong while fetching note.',
        });
        return;
    }
};

export async function borrowMoney(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const { name, amount }: { name: string; amount: number } = req.body;

        if (!name || typeof name !== 'string') {
            res.status(400).json({ message: 'Invalid input: "name" (string) is required.' });
            return;
        }

        if (typeof amount !== 'number' || isNaN(amount)) {
            res.status(400).json({ message: 'Invalid input: "amount" (number) is required.' });
            return;
        }

        if (amount <= 0) {
            res.status(400).json({ message: '"amount" must be greater than zero.' });
            return;
        }

        const category = await CategoryModel.findOne({
            name: new RegExp(`^${name.trim()}$`, 'i'),
        });

        if (!category) {
            res.status(404).json({ message: `Category "${name}" not found.` });
            return;
        }

        const loanCat = await CategoryModel.findOne({
            name: /^loan$/i,
        });

        if (!loanCat) {
            res.status(500).json({ message: 'Internal error: "loan" category missing.' });
            return;
        }

        const prevCatAmount = category.amount;
        const prevLoanAmount = loanCat.amount;

        category.amount += amount;
        loanCat.amount += amount;

        await Promise.all([
            category.save(),
            loanCat.save(),
            TransactionLogModel.create({
                categoryId: category._id,
                categoryName: category.name,
                changeType: 'add',
                changeAmount: amount,
                previousAmount: prevCatAmount,
                newAmount: category.amount,
                transaction_note: `Borrowed money to ${category.name}`
            }),
            TransactionLogModel.create({
                categoryId: loanCat._id,
                categoryName: loanCat.name,
                changeType: 'add',
                changeAmount: amount,
                previousAmount: prevLoanAmount,
                newAmount: loanCat.amount,
                transaction_note: `Loan amount increased due to borrowing in ${category.name}`
            })
        ]);

        res.status(200).json({
            message: `Lent ${amount} to "${category.name}" and incremented "loan" by the same amount.`,
            categories: [
                { name: category.name, amount: category.amount },
                { name: loanCat.name, amount: loanCat.amount },
            ],
        });
        return;
    } catch (err) {
        console.error('lendMoney message:', err);
        res.status(500).json({ message: 'Something went wrong!' });
        return;
    }
}

export async function getAllAutoDebits(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const autoDebits = await AutoDebitModel.find().populate('categoryToDeduct').lean();

        res.status(200).json({
            message: 'Fetched all auto-debit records successfully.',
            count: autoDebits.length,
            autoDebits,
        });
    } catch (err) {
        console.error('getAllAutoDebits error:', err);
        res.status(500).json({ message: 'Something went wrong while fetching auto-debits.' });
    }
}

export async function createManyAutoDebits(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const inputs: AutoDebitInput[] = req.body;

        if (!Array.isArray(inputs) || inputs.length === 0) {
            res.status(400).json({ message: 'Input must be a non-empty array.' });
            return;
        }

        const categoryNames = inputs.map((i) => i.categoryToDeduct.trim().toLowerCase());
        const categories = await CategoryModel.find({
            name: { $in: categoryNames.map((n) => new RegExp(`^${n}$`, 'i')) },
        }).lean();

        const foundNames = categories.map((c) => c.name.toLowerCase());
        const missingNames = categoryNames.filter((n) => !foundNames.includes(n));

        if (missingNames.length > 0) {
            res.status(400).json({
                message: `Invalid or missing categories: ${missingNames.join(', ')}`,
            });
            return;
        }

        const categoryMap = new Map(
            categories.map((c) => [c.name.toLowerCase(), c._id])
        );

        const docs = inputs.map((input) => ({
            amount: input.amount,
            categoryToDeduct: categoryMap.get(input.categoryToDeduct.trim().toLowerCase()),
            debitDateTime: new Date(input.debitDateTime),
        }));

        const inserted = await AutoDebitModel.insertMany(docs);

        res.status(201).json({
            message: 'Auto-debits created successfully.',
            count: inserted.length,
            autoDebits: inserted,
        });
    } catch (err) {
        console.error('createManyAutoDebits error:', err);
        res.status(500).json({ message: 'Something went wrong while creating auto-debits.' });
    }
}

export async function updateManyAutoDebits(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        const updates: UpdateAutoDebitInput[] = req.body;

        if (!Array.isArray(updates) || updates.length === 0) {
            res.status(400).json({ message: 'Input must be a non-empty array.' });
            return;
        }

        const categoryNames: string[] = Array.from(
            new Set(
                updates
                    .map((u) => u.categoryToDeduct?.trim().toLowerCase())
                    .filter((n): n is string => typeof n === 'string' && n.length > 0)
            )
        );

        const categoryMap = new Map<string, string>();

        if (categoryNames.length > 0) {
            const categories = await CategoryModel.find({
                name: { $in: categoryNames.map((n) => new RegExp(`^${n}$`, 'i')) },
            }).lean();

            const foundNames = categories.map((c) => c.name.toLowerCase());
            const missing = categoryNames.filter((n) => !foundNames.includes(n));

            if (missing.length > 0) {
                res.status(400).json({
                    message: `Invalid categories in updates: ${missing.join(', ')}`,
                });
                return;
            }

            for (const cat of categories) {
                categoryMap.set(cat.name.toLowerCase(), cat._id.toString());
            }
        }

        const updatePromises = updates.map(async (update) => {
            const { _id, amount, categoryToDeduct, debitDateTime } = update;
            const updateFields: any = {};

            if (amount !== undefined) updateFields.amount = amount;
            if (categoryToDeduct)
                updateFields.categoryToDeduct = categoryMap.get(categoryToDeduct.trim().toLowerCase());
            if (debitDateTime) updateFields.debitDateTime = new Date(debitDateTime);

            return AutoDebitModel.findByIdAndUpdate(_id, updateFields, { new: true });
        });

        const updatedDocs = await Promise.all(updatePromises);

        const notFound = updatedDocs.filter((doc) => !doc).length;
        if (notFound > 0) {
            res.status(404).json({
                message: `${notFound} auto-debit records not found for update.`,
            });
            return;
        }

        res.status(200).json({
            message: 'Auto-debit records updated successfully.',
            updatedCount: updatedDocs.length,
            updatedDocs,
        });
    } catch (err) {
        console.error('updateManyAutoDebits error:', err);
        res.status(500).json({ message: 'Something went wrong while updating auto-debits.' });
    }
}