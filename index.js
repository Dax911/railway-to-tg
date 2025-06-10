const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const fs = require("fs");
const { Telegraf } = require("telegraf");

// Load environment variables
if (fs.existsSync(".env")) {
  dotenv.config();
}

// Validate required environment variables
const requiredEnvVars = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PORT = process.env.PORT || 5000;

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Add request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Enhanced message sending with error handling
async function sendMessage(message, buttonText = null, buttonUrl = null) {
  try {
    const options = {
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };

    // Add inline keyboard if button details provided
    if (buttonText && buttonUrl) {
      options.reply_markup = {
        inline_keyboard: [
          [
            {
              text: buttonText,
              url: buttonUrl,
            },
          ],
        ],
      };
    }

    await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, options);
    console.log("Message sent successfully");
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

// Enhanced status emoji mapping for all Railway events
const statusEmojis = {
  SUCCESS: "✅",
  BUILDING: "⚒️", 
  DEPLOYING: "🚀",
  CRASHED: "❌",
  FAILED: "💥",
  QUEUED: "⏳",
  REMOVED: "🗑️",
  REMOVING: "🔄",
  SKIPPED: "⏭️",
  INITIALIZED: "🎯",
  WAITING: "⏸️",
  SLEEPING: "😴",
  "AWAITING_APPROVAL": "⏰"
};

// Handle all deployment events
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;
    
    console.log("Received webhook:", JSON.stringify(data, null, 2));

    if (data.type === "DEPLOY") {
      const emoji = statusEmojis[data.status] || "ℹ️";
      const message = `<b>🚂 Railway Deployment</b>

<b>Project:</b> <code>${data.project?.name || "Unknown"}</code>
${emoji} <b>Status:</b> <code>${data.status}</code>
🌳 <b>Environment:</b> <code>${data.environment?.name || "Unknown"}</code>
👨‍💻 <b>Creator:</b> <code>${data.deployment?.creator?.name || "Unknown"}</code>
🕐 <b>Time:</b> <code>${new Date().toLocaleString()}</code>`;

      const projectId = data.project?.id;
      const buttonUrl = projectId 
        ? `https://railway.app/project/${projectId}/deployments`
        : "https://railway.app";

      await sendMessage(message, "View Project", buttonUrl);
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "healthy", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Railway to Telegram Webhook Service",
    endpoints: {
      webhook: "POST /webhook",
      health: "GET /health"
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  process.exit(0);
});

// Start server
app.listen(PORT, (err) => {
  if (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
  console.log(`🚀 Railway-to-Telegram webhook server listening on port ${PORT}`);
  console.log(`📡 Webhook URL: /webhook`);
  console.log(`❤️ Health check: /health`);
});
