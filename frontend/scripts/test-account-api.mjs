import assert from "node:assert/strict";
import { test } from "node:test";
import { AccountApiError, accountRequest, saveAccountLesson } from "../artifacts/workforce/src/lib/account-api.ts";

test("account requests include same-origin cookies and CSRF headers", async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  let request;
  globalThis.document = { cookie: "csrf_token=csrf%20value" };
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ item_id: "step-python" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const response = await saveAccountLesson("step python", {
      status: "completed",
      item_type: "pathway_step",
      title: "Practice Python",
      skills: ["Python"],
    });
    assert.equal(response.item_id, "step-python");
    assert.equal(request.url, "/api/py/me/lessons/step%20python/completion");
    assert.equal(request.options.credentials, "include");
    assert.equal(request.options.headers.get("X-CSRF-Token"), "csrf value");
    assert.deepEqual(JSON.parse(request.options.body), {
      status: "completed",
      item_type: "pathway_step",
      title: "Practice Python",
      skills: ["Python"],
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});

test("account requests expose backend errors rather than returning success-shaped data", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(
    JSON.stringify({ detail: "Session expired." }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );

  try {
    await assert.rejects(
      accountRequest("/auth/me"),
      (error) => error instanceof AccountApiError
        && error.status === 401
        && error.message === "Session expired.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
