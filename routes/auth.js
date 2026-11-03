const express = require("express");
const { check, body } = require("express-validator");
const { rateLimit } = require("express-rate-limit");

const authController = require("../controllers/auth");
const User = require("../models/user");

const router = express.Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get("/login", authController.getLogin);

router.post(
  "/login",
  loginLimiter,
  [
    body("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .normalizeEmail(),
    body(
      "password",
      "Please enter a valid password. Password must be at least 5 characters long and only contain letters and numbers",
    )
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
  ],
  authController.postLogin,
);

router.get("/signup", authController.getSignup);

router.post(
  "/signup",
  signupLimiter,
  [
    check("email")
      .isEmail()
      .withMessage("Please enter a valid email")
      .custom((value) => {
        return User.findOne({ email: value }).then((userDoc) => {
          if (userDoc) {
            return Promise.reject(
              "E-mail already exists, please try another one!",
            );
          }
        });
      })
      .normalizeEmail(),
    body(
      "password",
      "Please enter a valid password with only numbers and text and at least 5 characters long",
    )
      .isLength({ min: 5 })
      .isAlphanumeric()
      .trim(),
    body("confirmPassword")
      .trim()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Passwords have to match!");
        }
        return true;
      }),
  ],
  authController.postSignup,
);

router.post("/logout", authController.postLogout);

router.get("/reset", authController.getReset);

router.post("/reset", passwordResetLimiter, authController.postReset);

router.get("/reset/:token", authController.getNewPassword);

router.post(
  "/new-password",
  passwordResetLimiter,
  authController.postNewPassword,
);

module.exports = router;
