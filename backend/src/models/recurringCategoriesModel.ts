import mongoose from 'mongoose';

export interface ICategory extends mongoose.Document {
  name: string;
  amount: number;
  status: boolean;
}

const CategorySchema = new mongoose.Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Category = mongoose.model<ICategory>('RecurringCategory', CategorySchema);
export default Category;
