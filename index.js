const express = require("express");
const app = express();
const router = express.Router();
const cors = require("cors");
const mongoose = require("mongoose");
const UserModel = require("./models/user.model");
const StockModel = require("./models/stock");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const sendEmail = require("./models/email");
const Token = require("./models/token");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
require("dotenv").config();

app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3030;
mongoose.connect(
  "mongodb+srv://dracula:twRgpnkO5kqs79zR@cluster0.bcjdqnj.mongodb.net/?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// app.use("/api/password-reset", passwordResetRoutes);

//register........................................................................................

app.post("/api/register", async (req, res) => {
  console.log(req.body);
  try {
    const newPassword = await bcrypt.hash(req.body.password, 10);
    const user = await UserModel.create({
      name: req.body.name,
      email: req.body.email,
      password: newPassword,
      isVerified: false,
    });
    const token = await new Token({
      userId: user._id,
      token: crypto.randomBytes(32).toString("hex"),
    }).save();

    const message = `${process.env.BASE_URL}/verify/${user.id}/${token.token}`;

    await sendEmail(user.email, "Verify Email", message);

    res.json(
      "An email has been sent to your account. Please verify your email address."
    );
  } catch (err) {
    res.status(400).json("An error occurred while registering.");
  }
});
//register end...................................................................................................................

//verify email begin..................................................................................................................

app.get("/verify/:id/:token", async (req, res) => {
  try {
    const user = await UserModel.findOne({ _id: req.params.id });
    if (!user) return res.status(400).send("Invalid link");

    const token = await Token.findOne({
      userId: user._id,
      token: req.params.token,
    });
    if (!token) return res.status(400).json("Invalid link");

    await user.updateOne({ isVerified: true });
    await Token.findByIdAndRemove(token._id);

    res.json("Email verified successfully");
  } catch (error) {
    res.status(400).json("An error occurred while verifying email.");
  }
});

//verify email end.......................................................................................................................

//login begin......................................................................................................................
app.post("/api/login", async (req, res) => {
  try {
    const user = await UserModel.findOne({ email: req.body.email });
    console.log(req.body.email);
    if (!user) {
      return res.json({ status: "error", error: "Invalid login" });
    }

    const isPasswordValid = await bcrypt.compare(
      req.body.password,
      user.password
    );

    if (!isPasswordValid) {
      return res.json({
        status: "error",
        error: "Password is incorrect",
        user: false,
      });
    }

    if (user.isVerified == false) {
      let token = await Token.findOne({ userId: user._id });
      if (token) {
        const url = `${process.env.BASE_URL}/verify/${user.id}/${token.token}`;
        await sendEmail(user.email, "Verify Email", url);
        return res.json({ status: "error", error: "Not Verified" });
      }

      return res
        .status(400)
        .send({ message: "An Email sent to your account please verify" });
    }
    console.log("pass verified");
    const token = jwt.sign(
      {
        name: user.name,
        email: user.email,
      },
      "secret123"
    );
    console.log(token);

    return res.json({ status: "ok", user: token });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});
//login end.......................................................................................................................

//password reset begin....................................................................................................

app.post("/api/password-reset", async (req, res) => {
  try {
    let user = await UserModel.findOne({ email: req.body.email });
    if (!user)
      return res
        .status(409)
        .send({ message: "User with given email does not exist!" });

    let token = await Token.findOne({ userId: user._id });
    if (!token) {
      token = await new Token({
        userId: user._id,
        token: crypto.randomBytes(32).toString("hex"),
      }).save();
    }

    const url = `${process.env.BASE_URL}/password-reset/${user._id}/${token.token}/`;
    await sendEmail(user.email, "Password Reset", url);

    res
      .status(200)
      .send({ message: "Password reset link sent to your email account" });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

// verify password reset link
app.get("/api/password-reset/:id/:token", async (req, res) => {
  try {
    const user = await UserModel.findOne({ _id: req.params.id });
    console.log(user);
    if (!user) return res.status(400).send({ message: "Invalid link" });

    const token = await Token.findOne({
      userId: user._id,
      token: req.params.token,
    });
    if (!token) return res.status(400).send({ message: "Invalid link" });
    console.log("valid url");
    res.status(200).send("Valid Url");
  } catch (error) {
    console.log("server error");
    res.status(500).send({ message: "Internal Server Error" });
  }
});

//  set new password
app.post("/api/password-reset/:id/:token", async (req, res) => {
  try {
    const user = await UserModel.findOne({ _id: req.params.id });
    if (!user) return res.status(400).send({ message: "Invalid link" });

    const token = await Token.findOne({
      userId: user._id,
      token: req.params.token,
    });
    if (!token) return res.status(400).send({ message: "Invalid link" });

    if (!user.isVerified) {
      user.isVerified = true;

      const salt = await bcrypt.genSalt(Number(process.env.SALT));
      const hashPassword = await bcrypt.hash(req.body.password, salt);

      user.password = hashPassword;
      await user.save();
      await token.remove();
    }
    res.status(200).send({ message: "Password reset successfully" });
  } catch (error) {
    res.status(500).send({ message: "Internal Server Error" });
  }
});

//password reset end...................................................................................................................................

//add stock to portfolio begin...............................................................................................................

app.post("/api/add-stock", async (req, res) => {
  const token = req.headers["x-access-token"];

  try {
    // verify the JWT token
    const decodedToken = jwt.verify(token, "secret123");
    const email = decodedToken.email;

    console.log(decodedToken);
    console.log(email);

    console.log(req.body.DOP);

    const user = await UserModel.findOne({ email: email });
    console.log(user);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.stock) {
      user.stock = { items: [] };
    }

    await user.addStock(
      req.body.company,
      req.body.DOP,
      req.body.VOP,
      req.body.stockVolume
    );

    // return success response
    return res.json({ status: "ok" });
  } catch (error) {
    console.log(error);

    res.json(error);
  }
});

//add stock end......................................................................................................................

//get user data  begin..............................................................................................................

app.get("/api/get-user", async (req, res) => {
  const token = req.headers["x-access-token"];

  try {
    // verify the JWT token
    const decodedToken = jwt.verify(token, "secret123");
    const email = decodedToken.email;

    console.log(decodedToken);
    console.log(email);

    const user = await UserModel.findOne({ email: email });
    console.log(user);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const stockDetails = await UserModel.aggregate([
      { $match: { email: email } }, // Match user's email
      { $unwind: "$stock.items" }, // Unwind the stock array
      {
        $lookup: {
          from: "stocks", // Specify the name of the stock collection
          localField: "stock.items.stockId",
          foreignField: "_id",
          as: "stockDetails",
        },
      },
      { $unwind: "$stockDetails" },

      {
        $project: {
          _id: 0,
          stockId: "$stock.items.stockId",
          company: "$stockDetails.company",
          DOP: "$stockDetails.DOP",
          VOP: "$stockDetails.VOP",
          stockVolume: "$stockDetails.stockVolume",
        },
      },
    ]);

    // return success response
    console.log(stockDetails);
    console.log(typeof stockDetails);
    console.log(stockDetails.details);
    console.log(user);
    if (stockDetails.length > 0) {
      return res.status(200).json({ user: user, stocks: stockDetails });
    } else {
      return res.status(200).json({ user: user, stocks: [] });
    }
  } catch (error) {
    console.log(error);

    res.json(error);
  }
});
//get user data end................................................................................................................

//delete stock from portfolio begin...................................................................................................

app.post("/api/delete", async (req, res) => {
  console.log("hiii");
  try {
    console.log("hiii");
    console.log(req.body);
    const { id } = req.body;

    const deletedStock = await StockModel.findById({ _id: id });
   

    if (!deletedStock) {
      return res.status(400).json({ msg: "No such Stock" });
    }

    await StockModel.deleteOne({ _id: id });
    return res.json({ msg: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ msg: "Server error" });
  }
});

//delete stock from portfolio end.............................................................................................

//server starting codeeee......................................................................

app.listen(PORT, () => {
  console.log(`server started on port ${PORT}`);
});
//server started.....................................................................................
