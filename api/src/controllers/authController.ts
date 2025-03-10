import { Request, Response, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { body, validationResult } from "express-validator";
import { jwtConfig } from "../config/jwtConfig";
import { findByEmail, create } from "../models/authModel";
import { AuthRequest, LoginResponse } from "../types";

const validateUser = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage(`Username must between 3 and 20 characters`)
    .matches(/^[a-z0-9 '-_]+$/i)
    .withMessage("Username contains invalid characters"),
  body("email").trim().isEmail().withMessage(`Invalid email`),
  body("password")
    .trim()
    .isLength({ min: 8 })
    .withMessage(`Password must be longer than 8 characters`),
];

const generateToken = (id: string) => {
  return jwt.sign({ id }, jwtConfig.secret as jwt.Secret, {
    expiresIn: jwtConfig.expiresIn as jwt.SignOptions["expiresIn"],
  });
};

export const registerUser = [
  ...validateUser,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { username, email, password } = req.body;

      const existingUser = await findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await create(username, email, hashedPassword);

      // Generate token for the new user
      const token = generateToken(user.id);

      res.status(201).json({
        message: "Account created successfully",
        token,
        user
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Error registering user" });
    }
  },
] as RequestHandler[];

export const loginUser = async (
  req: AuthRequest,
  res: Response<LoginResponse | { message: string }>,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication failed",
      });
    }

    const token = generateToken(req.user.id);

    res.json({
      message: "Logged in successfully",
      token,
      user: req.user
    });
  } catch (err) {
    console.error("Login error", err);
    res.status(500).json({ message: "Error during login" });
  }
};

export const logoutUser = (_req: Request, res: Response) => {
  res.json({ message: "Logged out successfully" });
};

export const verifyUser = [
  async (
    req: AuthRequest,
    res: Response<LoginResponse>,
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: "Authentication failed",
          token: "",
          user: null,
        });
      }
  
      // Generate a fresh token
      const token = generateToken(req.user.id);
  
      res.json({
        message: "Token verified",
        token,
        user: req.user
      });
    } catch (err) {
      console.error("Verification error: ", err);
      res.status(500).json({
        message: "Error during verification",
        token: "",
        user: null,
      });
    }
  }
] as unknown as RequestHandler[];