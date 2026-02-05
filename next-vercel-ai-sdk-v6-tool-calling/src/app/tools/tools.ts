import { tool } from "ai";
import z from "zod";

export const createTools = () => ({
  getCurrentTime: tool({
    description:
      "Get the current date and time. Use this when the user asks about the current time, date, or day of the week.",
    inputSchema: z.object({}),
    execute: async () => {
      const now = new Date();
      return {
        timestamp: now.toISOString(),
        date: now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        time: now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    },
  }),
  randomNumber: tool({
    description:
      "Generate a random integer between min and max (inclusive). Use this when the user asks for a random number, dice roll, or random selection.",
    inputSchema: z.object({
      min: z.number().describe("The minimum value (inclusive)"),
      max: z.number().describe("The maximum value (inclusive)"),
    }),
    execute: async ({ min, max }) => {
      min = Math.ceil(Number(min));
      max = Math.floor(Number(max));
      if (isNaN(min) || isNaN(max) || min > max) {
        throw new Error("Invalid min or max value.");
      }
      return Math.floor(Math.random() * (max - min + 1)) + min;
    },
  }),
  mathEval: tool({
    description:
      "Evaluate a mathematical expression. Use this when the user asks to calculate or evaluate a math expression. Only supports numbers and basic operators: + - * / % ( ) .",
    inputSchema: z.object({
      expression: z
        .string()
        .describe(
          "The mathematical expression to evaluate (e.g., '2 + 2', '(10 * 5) / 2')",
        ),
    }),
    execute: async ({ expression }) => {
      // Only allow numbers, spaces, and math symbols: + - * / % ( ) .
      if (!/^[\d\s+\-*/%.()]+$/.test(expression)) {
        throw new Error("Invalid characters in expression.");
      }
      return Function('"use strict";return (' + expression + ")")();
    },
  }),
  getLocation: tool({
    description:
      "Get the user's current geographic location (latitude and longitude). Use this when the user asks about their location, where they are, or needs location-based information.",
    inputSchema: z.object({}),
    needsApproval: true,
    execute: async () => {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject("Geolocation not supported.");
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          (err) => reject(err.message || "Geolocation error"),
        );
      });
    },
  }),
});
