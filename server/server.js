require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const nodemailer = require("nodemailer");
const jwt = require("jsonwebtoken");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const aiRoutes = require("./routes/aiRoutes");
const fs = require("fs");
const path = require("path");
const connectDB = require("./config/db");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("./models/User");
const Session = require("./models/Session");

const asyncHandler =
  (fn) =>
  async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      console.error("Async handler error:", error);
      throw error;
    }
  };

function hasEmailCredentials() {
  const user =
    process.env.SMTP_USER ||
    process.env.EMAIL_USERNAME ||
    process.env.EMAIL_USER ||
    "";
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || "";
  return Boolean(user && pass);
}

const sendEmail = asyncHandler(async (data) => {
  if (!hasEmailCredentials()) {
    throw new Error(
      "Email credentials are not configured. Set SMTP_USER/SMTP_PASS or EMAIL_USERNAME/EMAIL_PASSWORD.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || process.env.EMAIL_PORT || 587),
    secure:
      process.env.SMTP_SECURE === "true" ||
      process.env.EMAIL_SECURE === "true" ||
      false,
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user:
        process.env.SMTP_USER ||
        process.env.EMAIL_USERNAME ||
        process.env.EMAIL_USER,
      pass: process.env.SMTP_PASS || process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: data.from || '"AETHRIX AI" <aiaethrix@gmail.com>',
    to: data.to,
    subject: data.subject,
    text: data.message,
    html: data.html,
  };

  await transporter.sendMail(mailOptions);
  // debug: email send confirmed (removed verbose log for production)
  // console.log('Email sent');
});

const app = express();

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});

const corsOptions = {
  origin: true,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "3mb" }));
app.use(morgan("dev")); // Optional: Use morgan for request logging in development
// Allow larger JSON payloads for interview chunk uploads (base64 blobs)
app.use("/api/interviews", express.json({ limit: "50mb" }));

// Return JSON error instead of HTML when JSON parsing fails (PowerShell/curl quoting issues)
app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res
      .status(413)
      .json({
        error:
          "Request payload is too large. Please use a smaller image or file.",
      });
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ error: "Invalid JSON body" });
  }
  next(err);
});

connectDB()
  .then(() => {
    // Connected to MongoDB (suppressing verbose log in production)
    // console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  });

const PORT = process.env.PORT || 4000;
const sessionCookieName = "aethrix_session";
const authTokenCookieName = "aethrix_token";
const sessionDurationMs = 3 * 60 * 60 * 1000;
const jwtSecret = process.env.JWT_SECRET || "aethrix-jwt-secret-dev";

// In-memory store for OTPs and temporary registrations
const pending = new Map(); // email -> { otp, expiresAt, user }

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isPasswordStrong(password) {
  if (typeof password !== "string") return false;
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  return true;
}

function sanitizeUser(user) {
  const raw = user.toObject ? user.toObject() : user;
  const { password, __v, ...safeUser } = raw;
  return safeUser;
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(valueParts.join("="));
  }
  return null;
}

function setSessionCookie(res, sessionId, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append(
    "Set-Cookie",
    `${sessionCookieName}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`,
  );
}

function setAuthTokenCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.append(
    "Set-Cookie",
    `${authTokenCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`,
  );
}

function clearSessionCookie(res) {
  res.append(
    "Set-Cookie",
    `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
  res.append(
    "Set-Cookie",
    `${authTokenCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
  );
}

function signJwt(payload, expiresIn = "7d") {
  return jwt.sign(payload, jwtSecret, { expiresIn });
}

function verifyJwt(token) {
  return jwt.verify(token, jwtSecret);
}

function getAuthToken(req) {
  const cookieToken = getCookie(req, authTokenCookieName);
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.authorization || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

async function createSession(res, email, userData = {}) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + sessionDurationMs;
  await Session.create({ sessionId, email: email.toLowerCase(), expiresAt });
  setSessionCookie(res, sessionId, expiresAt);

  const token = signJwt(
    {
      sub: email.toLowerCase(),
      role: userData.role || "candidate",
      userId: userData._id || email,
    },
    "7d",
  );
  setAuthTokenCookie(res, token, expiresAt);
  return expiresAt;
}

async function getSessionUser(req) {
  const authToken = getAuthToken(req);
  if (authToken) {
    try {
      const decoded = verifyJwt(authToken);
      const user = await User.findOne(
        { email: String(decoded.sub || "").toLowerCase() },
        "-password",
      );
      if (user) {
        return {
          user,
          session: null,
          tokenExpiresAt: decoded.exp ? decoded.exp * 1000 : null,
        };
      }
    } catch (error) {
      // Fall back to the session-cookie flow if the JWT is missing or invalid.
    }
  }

  const sessionId = getCookie(req, sessionCookieName);
  if (!sessionId) return null;

  const session = await Session.findOne({ sessionId });
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    await Session.deleteOne({ sessionId });
    return null;
  }

  const user = await User.findOne({ email: session.email }, "-password");
  if (!user) {
    await Session.deleteOne({ sessionId });
    return null;
  }

  return { user, session };
}

async function sendWithConfiguredMailProvider(email, otp) {
  const provider = (process.env.EMAIL_PROVIDER || "smtp").toLowerCase();
  const hasGmailConfig = Boolean(
    process.env.EMAIL_USERNAME && process.env.EMAIL_PASSWORD,
  );
  const hasSmtpConfig = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );

  if (!hasGmailConfig && !hasSmtpConfig && !hasEmailCredentials()) {
    return null;
  }

  if (provider === "gmail" && hasGmailConfig) {
    return await sendWithGmail(email, otp);
  }

  if (provider === "smtp" && hasSmtpConfig) {
    return await sendWithSmtp(email, otp);
  }

  if (hasSmtpConfig) {
    return await sendWithSmtp(email, otp);
  }

  if (hasGmailConfig) {
    return await sendWithGmail(email, otp);
  }

  return null;
}

function buildOtpEmailText(otp) {
  return [
    "AETHRIX AI Secure Verification",
    "",
    "Use the verification code below to continue.",
    `Code: ${otp}`,
    "",
    "This code expires in 5 minutes.",
    "If you did not request this email, you can ignore it safely.",
    "",
    "© 2026 AETHRIX AI",
  ].join("\n");
}

function buildOtpEmailHtml(otp) {
  return `
        <div style="font-family: Inter, Arial, sans-serif; background:#f4f7fb; padding:24px; color:#10233f;">
          <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 14px 36px rgba(15,23,42,0.10);">
            <div style="background:linear-gradient(135deg,#0f172a,#2563eb); padding:28px 30px; color:#ffffff;">
              <h2 style="margin:0 0 8px; font-size:26px;">AETHRIX AI</h2>
              <p style="margin:0; font-size:14px; opacity:0.95;">Secure verification for your account</p>
            </div>
            <div style="padding:30px;">
              <h3 style="margin:0 0 10px; font-size:21px; color:#10233f;">Your verification code</h3>
              <p style="margin:0 0 18px; line-height:1.7; color:#475569;">Use the secure code below to continue with your sign-in or registration. This code expires in 5 minutes.</p>
              <div style="display:inline-block; padding:16px 24px; border-radius:14px; background:#eff6ff; border:1px solid #bfdbfe; font-size:32px; font-weight:800; letter-spacing:5px; color:#1d4ed8;">${otp}</div>
              <p style="margin:18px 0 0; font-size:13px; color:#64748b;">If you did not request this code, you can safely ignore this message.</p>
            </div>
            <div style="padding:0 30px 24px; font-size:12px; color:#94a3b8;">
              <p style="margin:0;">© 2026 AETHRIX AI. All rights reserved.</p>
            </div>
          </div>
        </div>
    `;
}

async function sendWithGmail(email, otp) {
  await sendEmail({
    to: email,
    subject: "AETHRIX AI secure verification code",
    message: buildOtpEmailText(otp),
    html: buildOtpEmailHtml(otp),
  });
  return { provider: "gmail", messageId: null, preview: null };
}

async function sendWithSmtp(email, otp) {
  

  const transporter = nodemailer.createTransport({
   service: 'gmail',    
    auth: {
      user: 'aiaethrix@gmail.com',
      pass: 'kumn elqp wvja nrsb',
    },
  });

  const info = await transporter.sendMail({
    from: `"AETHRIX AI" <${process.env.SMTP_USER || process.env.EMAIL_USERNAME || process.env.EMAIL_USER}>`,
    to: email,
    subject: "AETHRIX AI secure verification code",
    text: buildOtpEmailText(otp),
    html: buildOtpEmailHtml(otp),
  });

  return {
    provider: "smtp",
    messageId: info.messageId || null,
    preview: nodemailer.getTestMessageUrl(info),
  };
}

async function sendWithEthereal(email, otp) {
  const testAccount = await nodemailer.createTestAccount();
  const testTransport = nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });

  const info = await testTransport.sendMail({
    from: `"AETHRIX AI" <${testAccount.user}>`,
    to: email,
    subject: "AETHRIX AI secure verification code (test)",
    text: buildOtpEmailText(otp),
    html: buildOtpEmailHtml(otp),
  });

  return nodemailer.getTestMessageUrl(info);
}

app.post("/api/auth/send-otp", async (req, res) => {
  const { name, email, password, role, gender } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const normalizedEmail = email.toLowerCase();
  const otp = generateOtp();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  pending.set(normalizedEmail, {
    otp,
    expiresAt,
    user: { name, email: normalizedEmail, password, role, gender },
  });
  try {
    const configuredMail = await sendWithConfiguredMailProvider(
      normalizedEmail,
      otp,
    );
    if (configuredMail) {
      return res.json({
        ok: true,
        provider: configuredMail.provider,
        messageId: configuredMail.messageId,
      });
    }

    const previewUrl = await sendWithEthereal(normalizedEmail, otp);
    // console.log('Email preview URL:', previewUrl);
    return res.json({ ok: true, provider: "ethereal" });
  } catch (err) {
    console.error("send-otp error:", err);
    const errorMessage = String(err.message || err);
    return res.json({
      ok: false,
      error: errorMessage,
    });
  }
});

app.post(
  "/api/auth/send-login-otp",
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });

    const otp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    pending.set(email.toLowerCase(), {
      otp,
      expiresAt,
      user: user.toObject(),
      login: true,
    });
    try {
      const configuredMail = await sendWithConfiguredMailProvider(email, otp);
      if (configuredMail) {
        return res.json({
          ok: true,
          provider: configuredMail.provider,
          messageId: configuredMail.messageId,
        });
      }

      const previewUrl = await sendWithEthereal(email, otp);
      // console.log('Email preview URL:', previewUrl);
      return res.json({ ok: true, provider: "ethereal" });
    } catch (err) {
      console.error("send-login-otp error:", err);
      const errorMessage = String(err.message || err);
      return res.json({
        ok: false,
        error: errorMessage,
      });
    }
  }),
);

app.post(
  "/api/auth/verify-login-otp",
  asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ error: "Missing fields" });

    const entry = pending.get(email.toLowerCase());
    if (!entry || !entry.login)
      return res
        .status(400)
        .json({ error: "No pending login OTP for this email" });
    if (Date.now() > entry.expiresAt) {
      pending.delete(email.toLowerCase());
      return res.status(400).json({ error: "OTP expired" });
    }
    if (entry.otp !== otp.toString())
      return res.status(400).json({ error: "Invalid OTP" });

    pending.delete(email.toLowerCase());
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });

    const expiresAt = await createSession(res, user.email, user.toObject());
    await User.updateOne(
      { email: user.email },
      { sessionExpiresAt: expiresAt },
    );
    const safeUser = { ...sanitizeUser(user), sessionExpiresAt: expiresAt };
    return res.json({ ok: true, user: safeUser });
  }),
);

app.post(
  "/api/auth/forgot-password",
  asyncHandler(async (req, res) => {
    const { email, name, role } = req.body;
    if (!email || !name) {
      return res
        .status(400)
        .json({ error: "Email and full name are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user)
      return res.status(404).json({ error: "No account found for that email" });

    if (
      String(user.name).trim().toLowerCase() !==
      String(name).trim().toLowerCase()
    ) {
      return res
        .status(400)
        .json({ error: "The provided name does not match our records" });
    }

    if (role && user.role !== role) {
      return res
        .status(400)
        .json({ error: "The provided role does not match our records" });
    }

    const otp = generateOtp();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    pending.set(normalizedEmail, {
      otp,
      expiresAt,
      user: user.toObject(),
      resetPassword: true,
    });

    try {
      const configuredMail = await sendWithConfiguredMailProvider(
        normalizedEmail,
        otp,
      );
      if (configuredMail) {
        return res.json({
          ok: true,
          message: "A reset code has been sent to your email.",
          provider: configuredMail.provider,
        });
      }

      const previewUrl = await sendWithEthereal(normalizedEmail, otp);
      return res.json({
        ok: true,
        message: "A reset code has been sent to your email.",
        provider: "ethereal",
        preview: previewUrl,
      });
    } catch (err) {
      console.error("forgot-password error:", err);
      return res
        .status(500)
        .json({ ok: false, error: String(err.message || err) });
    }
  }),
);

app.post(
  "/api/auth/reset-password",
  asyncHandler(async (req, res) => {
    const { email, otp, password, confirmPassword } = req.body;
    if (!email || !otp || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ error: "Email, OTP, password, and confirmation are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (!isPasswordStrong(password)) {
      return res
        .status(400)
        .json({
          error:
            "Password must be at least 8 characters and include uppercase, lowercase, and a number",
        });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const entry = pending.get(normalizedEmail);
    if (!entry || !entry.resetPassword) {
      return res
        .status(400)
        .json({ error: "No password reset is pending for this email" });
    }

    if (Date.now() > entry.expiresAt) {
      pending.delete(normalizedEmail);
      return res.status(400).json({ error: "OTP expired" });
    }

    if (entry.otp !== otp.toString()) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await User.updateOne(
      { email: normalizedEmail },
      { password: passwordHash },
    );
    pending.delete(normalizedEmail);

    return res.json({ ok: true, message: "Password updated successfully" });
  }),
);

app.post(
  "/api/auth/verify-otp",
  asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ error: "Missing fields" });

    const normalizedEmail = email.toLowerCase();
    const entry = pending.get(normalizedEmail);
    if (!entry)
      return res
        .status(400)
        .json({ error: "No pending registration for this email" });
    if (Date.now() > entry.expiresAt) {
      pending.delete(normalizedEmail);
      return res.status(400).json({ error: "OTP expired" });
    }
    if (entry.otp !== otp.toString())
      return res.status(400).json({ error: "Invalid OTP" });

    const userData = entry.user;
    pending.delete(normalizedEmail);

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(userData.password, 10);
    const newUser = new User({
      ...userData,
      email: normalizedEmail,
      password: passwordHash,
    });
    await newUser.save();

    const expiresAt = await createSession(
      res,
      newUser.email,
      newUser.toObject(),
    );
    newUser.sessionExpiresAt = expiresAt;
    await newUser.save();
    const safeUser = sanitizeUser(newUser);
    return res.json({ ok: true, user: safeUser });
  }),
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: "user not found" });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      return res.status(401).json({ error: "Invalid email or password" });

    const otp = generateOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    pending.set(email.toLowerCase(), {
      otp,
      expiresAt,
      user: user.toObject(),
      login: true,
    });

    try {
      const configuredMail = await sendWithConfiguredMailProvider(email, otp);
      if (configuredMail) {
        return res.json({
          ok: true,
          twoFactor: true,
          message: "OTP sent to your email. Please enter it to complete login.",
          provider: configuredMail.provider,
          messageId: configuredMail.messageId,
        });
      }

      const previewUrl = await sendWithEthereal(email, otp);
      // console.log('Email preview URL:', previewUrl);
      return res.json({
        ok: true,
        twoFactor: true,
        message: "OTP sent to your email. Please enter it to complete login.",
        provider: "ethereal",
        preview: previewUrl,
      });
    } catch (err) {
      console.error("login error:", err);
      const errorMessage = String(err.message || err);
      return res.status(500).json({ ok: false, error: errorMessage });
    }
  }),
);

app.get(
  "/api/auth/me",
  asyncHandler(async (req, res) => {
    const sessionData = await getSessionUser(req);
    if (!sessionData) {
      clearSessionCookie(res);
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const { user, session, tokenExpiresAt } = sessionData;
    const sessionExpiresAt = session?.expiresAt || tokenExpiresAt;
    res.json({ ok: true, user: { ...sanitizeUser(user), sessionExpiresAt } });
  }),
);

app.post(
  "/api/auth/session/extend",
  asyncHandler(async (req, res) => {
    const sessionData = await getSessionUser(req);
    if (!sessionData) {
      clearSessionCookie(res);
      return res.status(401).json({ ok: false, error: "Not authenticated" });
    }

    const expiresAt = Date.now() + sessionDurationMs;
    if (sessionData.session) {
      sessionData.session.expiresAt = expiresAt;
      await sessionData.session.save();
      setSessionCookie(res, sessionData.session.sessionId, expiresAt);
    }

    const token = signJwt(
      {
        sub: sessionData.user.email,
        role: sessionData.user.role,
        userId: sessionData.user._id,
      },
      "7d",
    );
    setAuthTokenCookie(res, token, expiresAt);
    await User.updateOne(
      { email: sessionData.user.email },
      { sessionExpiresAt: expiresAt },
    );
    res.json({
      ok: true,
      user: { ...sanitizeUser(sessionData.user), sessionExpiresAt: expiresAt },
    });
  }),
);

app.post(
  "/api/auth/logout",
  asyncHandler(async (req, res) => {
    const sessionId = getCookie(req, sessionCookieName);
    if (sessionId) {
      await Session.deleteOne({ sessionId });
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  }),
);

app.get(
  "/api/users",
  asyncHandler(async (req, res) => {
    const usersList = await User.find({}, "-password");
    res.json({ ok: true, users: usersList });
  }),
);

app.get(
  "/api/users/:email",
  asyncHandler(async (req, res) => {
    const user = await User.findOne(
      { email: req.params.email.toLowerCase() },
      "-password",
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true, user });
  }),
);

app.post(
  "/api/users",
  asyncHandler(async (req, res) => {
    const { name, email, password, role, gender } = req.body;
    if (!name || !email || !password || !role) {
      return res
        .status(400)
        .json({ error: "Name, email, password, and role are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password: passwordHash,
      role,
      gender,
    });
    await newUser.save();

    const { password: pw, ...safeUser } = newUser.toObject();
    res.status(201).json({ ok: true, user: safeUser });
  }),
);

app.put(
  "/api/users/:email",
  asyncHandler(async (req, res) => {
    const updates = { ...req.body };
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    if (updates.email) {
      updates.email = updates.email.toLowerCase();
    }

    if (updates.scheduleEvents && !Array.isArray(updates.scheduleEvents)) {
      return res.status(400).json({ error: "scheduleEvents must be an array" });
    }

    const user = await User.findOneAndUpdate(
      { email: req.params.email.toLowerCase() },
      updates,
      {
        returnDocument: "after",
        projection: "-password",
      },
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true, user });
  }),
);

app.delete(
  "/api/users/:email",
  asyncHandler(async (req, res) => {
    const user = await User.findOneAndDelete({
      email: req.params.email.toLowerCase(),
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ ok: true });
  }),
);

// Test endpoint
app.get("/api/test", (req, res) => {
  // test endpoint hit (log suppressed)
  // console.log('✅ Test endpoint hit!');
  res.json({ ok: true, message: "Server is working" });
});

app.get(
  "/api/system/status",
  asyncHandler(async (req, res) => {
    const [userCount, activeSessions] = await Promise.all([
      User.countDocuments(),
      Session.countDocuments({ expiresAt: { $gt: Date.now() } }),
    ]);

    const firebaseConfigured = Boolean(
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
    );

    res.json({
      ok: true,
      status: {
        server: {
          running: true,
          uptimeSeconds: Math.round(process.uptime()),
          nodeVersion: process.version,
          memoryUsedMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        database: {
          connected: mongoose.connection.readyState === 1,
          readyState: mongoose.connection.readyState,
          userCount,
          activeSessions,
        },
        firebase: {
          configured: firebaseConfigured,
          projectId: process.env.FIREBASE_PROJECT_ID || null,
          authDomain: process.env.FIREBASE_AUTH_DOMAIN || null,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || null,
        },
      },
    });
  }),
);

// Serve uploaded interview chunks
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Upload a partial or final interview recording (base64 payload)
app.post(
  "/api/interviews/:sessionId/upload",
  asyncHandler(async (req, res) => {
    const { filename, data, candidateEmail, partial } = req.body || {};
    if (!data)
      return res.status(400).json({ ok: false, error: "Missing data" });

    const uploadsDir = path.join(__dirname, "uploads");
    await fs.promises.mkdir(uploadsDir, { recursive: true });

    const safeName = String(
      filename || `${req.params.sessionId}-${Date.now()}.webm`,
    ).replace(/[^a-zA-Z0-9-_\.]/g, "_");
    const filePath = path.join(uploadsDir, safeName);

    // data is expected to be a base64-encoded string (no data: prefix)
    const buffer = Buffer.from(String(data), "base64");
    await fs.promises.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${encodeURIComponent(safeName)}`;

    // Optionally, we could persist metadata to the database here (sessionId, candidateEmail, partial, filePath)
    return res.json({ ok: true, url: publicUrl, file: safeName });
  }),
);

// AI Routes
app.use("/api/ai", aiRoutes);

const server = app.listen(PORT, () => {
  // Auth server running (log suppressed in production)
  // console.log(`Auth server running on port ${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the other server or set a different PORT in server/.env.`,
    );
    process.exit(1);
  }

  console.error("Server startup error:", error);
  process.exit(1);
});
