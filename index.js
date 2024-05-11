const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();

const port = process.env.PORT || 5000;

// middleware package
app.use(cookieParser());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://hj-hotel-b96ba.web.app/",
      "https://hj-hotel-b96ba.firebaseapp.com/",
    ],
    credentials: true,
  })
);
app.use(express.json());

// custom middleware (token veryfying)
async function veryfyToken(req, res, next) {
  const token = req.cookies?.token;
  // console.log(token);
  if (!token) {
    return res.status(401).send({ message: "unauthorized" });
  } else {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRETE, (err, decoded) => {
      if (err) {
        // console.log(err);
        return res.status(401).send({ message: "unauthorized" });
      } else {
        // console.log("value in the token", decoded);
        req.user = decoded;
        next();
      }
    });
  }
}

// mondoDB
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6iad9fh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // app cookes related api
    // cookie option
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    };
    // setting cookies from login page from the client side
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRETE, {
        expiresIn: "1h",
      });
      res.cookie("token", token, cookieOptions).send({ success: true });
    });

    // deleting token
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("user from logout: ", user);
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });
    // database related api will be here
    // Get the database and collection on which to run the operation
    const database = client.db("hj-hotels");
    const roomsCollection = database.collection("rooms");
    const reviewsCollection = database.collection("reviews");
    const bookingsCollection = database.collection("bookings");
    // reading all rooms
    app.get("/rooms", async (req, res) => {
      const query = {
        status: req.query.status,
        price: {
          $lte: parseInt(req.query.price),
        },
      };
      const result = await roomsCollection.find(query).toArray();
      res.send(result);
    });
    // reading single room
    app.get("/rooms/:id", async (req, res) => {
      const result = await roomsCollection.findOne({
        _id: new ObjectId(req.params.id),
      });
      res.send(result);
    });
    // updating rooms collection
    app.patch("/rooms/:id", async (req, res) => {
      const filter = { _id: new ObjectId(req.params.id) };
      const updateRoom = {
        $set: req.body,
      };
      const options = { upsert: true };
      const result = await roomsCollection.updateOne(
        filter,
        updateRoom,
        options
      );
      res.send(result);
    });
    // reading all premium rooms
    app.get("/featuredrooms", async (req, res) => {
      const result = await roomsCollection.find({ featured: true }).toArray();
      res.send(result);
    });
    // reading all reviews by descending order
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection
        .find()
        .sort({ timestamp: -1 })
        .toArray();

      res.send(result);
    });
    // craeting bookings
    app.post("/bookings", async (req, res) => {
      const result = await bookingsCollection.insertOne(req.body);
      res.send(result);
    });
    // reading all bookings according to logged in and varified user
    app.get("/bookings/:email", veryfyToken, async (req, res) => {
      const query = {
        user_email: req.params.email,
      };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });
    // deleting booking
    app.delete("/bookings/:id", veryfyToken, async (req, res) => {
      const query = {
        _id: new ObjectId(req.params.id),
      };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
