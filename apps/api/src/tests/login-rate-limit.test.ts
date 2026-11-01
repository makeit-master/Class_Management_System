
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import express from "express";

import { loginLimiter } from "../routes/auth.routes.js";

test("SEC-10: login rate limiter blocks request 11", async () => {
  const app = express();

  // Use the actual login limiter, without the database,
  // authentication logic, or existing API server.
  app.post("/test-login", loginLimiter, (_req, res) => {
    res.status(200).json({
      success: true,
      data: {
        message: "Request accepted",
      },
    });
  });

  // Port 0 lets the operating system choose a free port.
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Unable to determine test server port.");
    }

    const url = `http://127.0.0.1:${address.port}/test-login`;

    // First 10 requests should be accepted.
    for (let i = 1; i <= 10; i++) {
      const response = await fetch(url, {
        method: "POST",
      });

      assert.equal(
        response.status,
        200,
        `Request ${i} should return HTTP 200`,
      );

      console.log(`[PASS] Request ${i}: HTTP 200`);
    }

    // The 11th request should be rate limited.
    const blockedResponse = await fetch(url, {
      method: "POST",
    });

    assert.equal(
      blockedResponse.status,
      429,
      "Request 11 should return HTTP 429",
    );

    const body = (await blockedResponse.json()) as {
      success: boolean;
      error?: {
        code?: string;
        message?: string;
      };
    };

    assert.equal(body.success, false);
    assert.equal(body.error?.code, "RATE_LIMITED");

    // Check that standardized rate-limit headers exist.
    assert.ok(
      blockedResponse.headers.has("ratelimit"),
      "RateLimit header should exist",
    );

    console.log("[PASS] Request 11: HTTP 429");
    console.log("[PASS] Error code: RATE_LIMITED");
    console.log("[PASS] RateLimit header present");
    console.log("[PASS] SEC-10 completed");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
