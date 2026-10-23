const path = require("path");
const fs = require("fs");

require("dotenv").config({
  path: path.join(__dirname, ".env.local"),
});

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const flash = require("connect-flash");
const multer = require("multer");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");

const User = require("./models/user");

const fileStorage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PNG and JPEG images are allowed."), false);
  }
};

const MONGODB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@phenomenal.xisxj.mongodb.net/${process.env.MONGO_DB}?appName=phenomenal`;

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
});
const csrfProtection = csrf();

app.set("view engine", "ejs");
app.set("views", "views");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const errorController = require("./controllers/error");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(
  multer({
    storage: fileStorage,
    fileFilter,
    limits: {
      fileSize: 3 * 1024 * 1024, // bucket's 3 MB limit
    },
  }).single("image"),
);
app.use(express.static(path.join(__dirname, "public")));

const accessLogStream = fs.createWriteStream(
  path.join(__dirname, "access.log"),
  { flags: "a" },
);

// Security middleware to set various HTTP headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        imgSrc: [
          "'self'",
          "data:",
          "https://sbmnsrmfurmpvnjmmihm.supabase.co",
        ],
      },
    },
  })
); 
app.use(compression()); // Compression middleware to gzip responses
app.use(morgan("combined", { stream: accessLogStream })); // Logging middleware to log HTTP requests

app.use("/images", express.static(path.join(__dirname, "images")));
app.use(
  session({
    secret: "phenomenal servers",
    resave: false,
    saveUninitialized: false,
    store: store,
  }),
);
app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
  if (!req.session.userId) {
    return next();
  }
  User.findById(req.session.userId)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      next(new Error(err));
    });
});

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn;
  res.locals.user = req.user || null;
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use("/admin", adminRoutes);
app.use(authRoutes);
app.use(shopRoutes);
app.use("/500", errorController.get500);
app.use(errorController.get404);
app.use((error, req, res) => {
  res.status(500).render("500", {
    pageTitle: "Error!",
    path: "/500",
    error: error,
    isAuthenticated: req.session.isLoggedIn,
  });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(process.env.PORT || 3000, () => {
      console.log(`server is running and connected to Database!`);
    });
  })
  .catch((err) => console.log(err));
