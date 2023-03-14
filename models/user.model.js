const mongoose = require("mongoose");
const Stock = require("./stock");

const User = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  quote: { type: String },
  isVerified: { type: Boolean, default: false },

  stock: {
    items: [
      {
        stockId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Stock",
          required: true,
        },
      },
    ],
  },
});

User.methods.addStock = async function (company, date, value, vol) {
  const newStock = await Stock.create({
    company: company,
    DOP: date,
    VOP: value,
    stockVolume: vol,
  });

  this.stock.items.push({ stockId: newStock._id });
  return await this.save();
};

const model = mongoose.model("UserData", User);

module.exports = model;
