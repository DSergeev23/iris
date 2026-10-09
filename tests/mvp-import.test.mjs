import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { importPlan } from "../scripts/import-mvp-rehabilitation.mjs";

const screensBuffer = await readFile(new URL("../data/mvp-rehabilitation/screens.json", import.meta.url));
const screens = JSON.parse(screensBuffer);
const department = JSON.parse(await readFile(new URL("../data/mvp-rehabilitation/department.json", import.meta.url), "utf8"));

test("MVP rehabilitation import preserves every reachable transition and video", () => {
  assert.equal(createHash("sha256").update(screensBuffer).digest("hex"), "edafd323c24e2af909eab98c505f35470f4c555002b5bbae16a78cea1f4f2f03");
  const plan = importPlan(screens, department);
  const keys = new Set(plan.steps.map((step) => step.key));
  const videos = new Set(plan.videos.map((video) => video.filename));

  assert.equal(plan.sourceScreens, 48);
  assert.equal(plan.steps.length, 42);
  assert.equal(plan.steps.reduce((count, step) => count + step.buttons.length, 0), 94);
  assert.equal(plan.steps.filter((step) => step.video).length, 15);
  assert.equal(videos.size, 8);
  assert.equal(plan.welcomeText, screens.start_prompt.text);
  assert.deepEqual(plan.unused.sort(), ["call_center_schedule", "exercise_guidelines", "greeting_message", "thank_you_message", "unknown_command"]);

  for (const step of plan.steps) {
    const sourceButtons = screens[step.key].buttons || [];
    assert.equal(step.buttons.length, sourceButtons.length, `${step.key}: button count`);
    assert.deepEqual(step.buttons.map((button) => button.next), sourceButtons.map((button) => {
      if (/^overall_satisfaction_[1-5]$/.test(button.next)) return "overall_satisfaction";
      if (/^feedback_text_[1-5]$/.test(button.next)) return "feedback_text";
      return button.next;
    }), `${step.key}: target order`);
    assert.deepEqual(step.buttons.map((button) => button.title), sourceButtons.map((button) =>
      button.text.replace(/\*(.+?)\*/g, "$1").trim().replace(/^[⏹⏩⏪✅❗📌📞👉👇🧾📹⏰📃❓🔄◀️]+\s*/u, "")), `${step.key}: button labels`);
    for (const value of [step.title, step.displayTitle, step.description, ...step.buttons.map((button) => button.title)]) {
      assert.doesNotMatch(value, /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u, `${step.key}: valid Unicode`);
    }
    assert.equal(step.description, screens[step.key].text.replace(/\*(.+?)\*/g, "$1").trim(), step.key);
    assert.equal(step.displayTitle, (screens[step.key].caption?.replaceAll("👇", "").trim() || (step.video ? step.video.replace(/\.mp4$/i, "") : "ИРИС")), `${step.key}: patient heading`);
    assert.equal(step.feedbackInput, step.key === "feedback_text", `${step.key}: feedback box`);
    assert.equal(step.resumeOnReentry, step.key === "stage_selection", `${step.key}: reentry point`);
    if (step.video) assert.ok(videos.has(step.video), step.key);
    for (const button of step.buttons) {
      if (button.next !== "restart") assert.ok(keys.has(button.next), `${step.key} → ${button.next}`);
    }
  }
  assert.equal(plan.steps[0].key, "operation_question");
  assert.ok(plan.steps.find((step) => step.key === "goodbye_message")?.buttons.some((button) => button.next === "restart"));
});
