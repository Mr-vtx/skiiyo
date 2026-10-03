"use strict";

import { Resend } from "resend";

let _resend;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "noreply@tymbis.com";
const APP = process.env.APP_NAME ?? "YourApp";
const URL = process.env.APP_URL ?? "http://localhost:8080";

async function sendEmail({ to, subject, html }) {
  const client = getResend();

  if (!client) {
    console.log(`Email not sent (RESEND_API_KEY not set) — to=${to} subject="${subject}"`);
    return null;
  }

  let result;
  try {
    result = await client.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error(`Email to ${to} threw:`, err.message);
    return null;
  }

  if (result?.error) {
    console.error(
      `Email to ${to} failed (${result.error.name}):`,
      result.error.message,
    );
    return null;
  }

  return result;
}

export const emailService = {
  // ==== Welcome ============================================
  async sendWelcome({ email, username }) {
    return sendEmail({
      to: email,
      subject: `Welcome to ${APP}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2>Welcome, ${username}!</h2>
          <p>Your account has been created successfully.</p>
          <a href="${URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;
            background:#000;color:#fff;border-radius:6px;text-decoration:none;">
            Get Started
          </a>
        </div>
      `,
    });
  },

  // ==== Password Reset =====================================
  async sendPasswordReset({ email, username, resetToken }) {
    const resetUrl = `${URL}/reset-password?token=${resetToken}`;

    return sendEmail({
      to: email,
      subject: `Reset your password`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2>Password Reset</h2>
          <p>Hi ${username},</p>
          <p>You requested a password reset. This link expires in 15 minutes.</p>
          <a href="${resetUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;
            background:#000;color:#fff;border-radius:6px;text-decoration:none;">
            Reset Password
          </a>
          <p style="margin-top:16px;font-size:12px;color:#888;">
            If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    });
  },

  // ==== Email Verification =================================
  async sendVerification({ email, username, verifyToken }) {
    const verifyUrl = `${URL}/verify-email?token=${verifyToken}`;

    return sendEmail({
      to: email,
      subject: `Verify your email`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2>Email Verification</h2>
          <p>Hi ${username},</p>
          <p>Please verify your email to activate your account.</p>
          <a href="${verifyUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;
            background:#000;color:#fff;border-radius:6px;text-decoration:none;">
            Verify Email
          </a>
        </div>
      `,
    });
  },
};
