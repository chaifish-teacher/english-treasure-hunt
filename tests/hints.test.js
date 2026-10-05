import test from "node:test";
import assert from "node:assert/strict";
import hints from "../src/data/hints.json" with { type: "json" };
import { questionBank } from "../src/lib/game.js";

test("all 80 approved questions have a Chinese hint separate from final explanations", () => {
  assert.deepEqual(
    Object.keys(hints).map(Number),
    questionBank.map((q) => q.id),
  );
  for (const q of questionBank) {
    assert.match(hints[q.id].hint, /[\u4e00-\u9fff]/);
    assert.match(hints[q.id].supportHint, /[\u4e00-\u9fff]/);
    assert.notEqual(hints[q.id].supportHint, hints[q.id].hint);
    assert.notEqual(hints[q.id].hint, q.explanation);
    assert.ok(
      !hints[q.id].hint
        .toLowerCase()
        .includes(
          q.choices.find((c) => c.id === q.correctChoiceId).text.toLowerCase(),
        ),
    );
  }
});
test("all 30 vocabulary translations preserve blanks instead of supplying their answers", () => {
  for (const q of questionBank) {
    if (q.category === "vocabulary") {
      const translation = hints[q.id].translation;
      assert.match(translation, /[\u4e00-\u9fff]/);
      assert.equal(
        translation.includes("______"),
        q.question.includes("______"),
      );
    } else assert.equal(hints[q.id].translation, undefined);
  }
});
