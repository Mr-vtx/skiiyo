"use strict";

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    username: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      minlength: [4, "Username must be at least 4 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers and underscores",
      ],
    },
    // Lowercased mirror of `username`, used only for uniqueness checks and
    // lookups — `username` keeps whatever casing the user chose to display.
    // Kept in sync via the pre("validate") hook below for document saves;
    // callers that use findOneAndUpdate (no document hooks) must set it
    // explicitly — see userService.updateProfile.
    usernameLower: {
      type: String,
      required: true,
      select: false,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    avatar: {
      type: String,
      default: null,
    },
    // Cloudinary public_id for the current avatar, so we can delete the old
    // image when a new one is uploaded. Not user-editable directly.
    avatarPublicId: {
      type: String,
      default: null,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },

    googleId: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      select: false,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: { type: String, select: false, default: null },
    emailVerificationExpires: { type: Date, select: false, default: null },
    dateOfBirth: { type: Date, default: null },
    passwordResetToken: { type: String, select: false, default: null },
    passwordResetExpires: { type: Date, select: false, default: null },

    // Free-form per-user preferences (notification toggles, UI prefs, etc).
    // Whole-object replace on update — see userService.updateSettings.
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    bio: {
      type: String,
      maxlength: [200, "Bio cannot exceed 200 characters"],
      default: null,
    },
    country: { type: String, default: null },
    city: { type: String, default: null },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    
    fcmTokens: {
      type: [String],
      default: [],
      select: false,
    },

    isActive: { type: Boolean, default: true },
    lastSeen: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);


userSchema.index({ country: 1 });
userSchema.index({ project: 1, email: 1 }, { unique: true });
userSchema.index({ project: 1, usernameLower: 1 }, { unique: true });
userSchema.index(
  { project: 1, googleId: 1 },
  { unique: true, sparse: true }, // sparse: password-only users have no googleId
);

userSchema.pre("validate", function () {
  if (this.isModified("username") && this.username) {
    this.usernameLower = this.username.toLowerCase();
  }
});

userSchema.pre("save", async function () {
  if (!this.isModified("password") || !this.password) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationExpires;
  delete obj.avatarPublicId;
  delete obj.fcmTokens;
  delete obj.__v;
  return obj;
};

userSchema.virtual("age").get(function () {
  if (!this.dateOfBirth) return null;
  const diff = Date.now() - this.dateOfBirth.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
});

export default mongoose.model("User", userSchema);
