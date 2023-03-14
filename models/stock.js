const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
  company: { type: String, required: true },
  DOP: { type: String, required: true },
  VOP: { type: Number, required: true },
  stockVolume: { type: Number, required: true },
});

module.exports = mongoose.model("Stock", stockSchema);
