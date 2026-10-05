import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  questionBank,
  shuffleArray,
  sampleWithoutReplacement,
  selectGameQuestions,
  shuffleQuestionChoices,
  calculateInitialScores,
  calculateChallengeScores,
  completionPayload,
  gameReducer,
  emptyGame,
} from "../src/lib/game.js";

test("approved bank: exactly 80 stable IDs, exact categories, four distinct choices and Chinese explanations", () => {
  assert.deepEqual(
    questionBank.map((q) => q.id),
    Array.from({ length: 80 }, (_, i) => i + 1),
  );
  for (const q of questionBank) {
    assert.equal(q.category, q.id <= 30 ? "vocabulary" : "grammar");
    assert.equal(
      q.sourceType,
      q.id <= 15 || (q.id >= 31 && q.id <= 55) ? "original" : "new",
    );
    assert.equal(new Set(q.choices.map((c) => c.id)).size, 4);
    assert.ok(q.choices.some((c) => c.id === q.correctChoiceId));
    assert.match(q.explanation, /[\u4e00-\u9fff]/);
  }
});
// Fingerprint established after mechanically comparing the import with the teacher's source.
// Any change to wording, distractors, correct answers or explanations requires deliberate review.
test("approved content fingerprint remains unchanged", () => {
  assert.equal(
    createHash("sha256").update(JSON.stringify(questionBank)).digest("hex"),
    "7d113d33f42fa95f4b228523f44c595dd352224f96589c4096f62ecea7dbd1e0",
  );
});
test("1,000 randomized games all satisfy 10+10 vocabulary and 5+5 grammar without duplicates", () => {
  const orders = new Set();
  for (let i = 0; i < 1000; i++) {
    const questions = selectGameQuestions();
    assert.equal(questions.length, 30);
    assert.equal(new Set(questions.map((q) => q.id)).size, 30);
    assert.ok(questions.slice(0, 20).every((q) => q.category === "vocabulary"));
    assert.ok(questions.slice(20).every((q) => q.category === "grammar"));
    for (const [category, source, count] of [
      ["vocabulary", "original", 10],
      ["vocabulary", "new", 10],
      ["grammar", "original", 5],
      ["grammar", "new", 5],
    ]) {
      assert.equal(
        questions.filter(
          (q) => q.category === category && q.sourceType === source,
        ).length,
        count,
      );
    }
    orders.add(questions.map((q) => q.id).join(","));
  }
  assert.ok(orders.size > 990);
});
test("choice shuffling preserves answer identity and never mutates the bank", () => {
  const before = JSON.stringify(questionBank);
  for (const q of questionBank) {
    const correctText = q.choices.find((c) => c.id === q.correctChoiceId).text;
    const positions = new Set();
    for (let i = 0; i < 40; i++) {
      const shuffled = shuffleQuestionChoices(q);
      assert.equal(shuffled.correctChoiceId, q.correctChoiceId);
      assert.equal(
        shuffled.choices.find((c) => c.id === shuffled.correctChoiceId).text,
        correctText,
      );
      positions.add(
        shuffled.choices.findIndex((c) => c.id === q.correctChoiceId),
      );
    }
    assert.equal(positions.size, 4);
  }
  assert.equal(JSON.stringify(questionBank), before);
});
test("shuffle and sampling use copies; invalid sample sizes are rejected", () => {
  const source = [1, 2, 3, 4];
  assert.deepEqual(
    shuffleArray(source, () => 0),
    [2, 3, 4, 1],
  );
  assert.deepEqual(source, [1, 2, 3, 4]);
  assert.equal(sampleWithoutReplacement(source, 0).length, 0);
  assert.throws(() => sampleWithoutReplacement(source, 5), RangeError);
  assert.throws(() => sampleWithoutReplacement(source, -1), RangeError);
});
function started(questions = selectGameQuestions()) {
  const requested = gameReducer(emptyGame(), {
    type: "START_REQUEST",
    identity: { seatNo: "12", name: "Explorer" },
  });
  return gameReducer(requested, {
    type: "START_SUCCESS",
    gameId: "original-game-id",
    questions,
  });
}
function answerAndLock(state, wrongIds = new Set()) {
  for (const q of state.questions.slice(
    state.checkpoint * 5,
    state.checkpoint * 5 + 5,
  )) {
    state = gameReducer(state, {
      type: "SELECT",
      id: q.id,
      choiceId: wrongIds.has(q.id)
        ? q.choices.find((c) => c.id !== q.correctChoiceId).id
        : q.correctChoiceId,
    });
  }
  return gameReducer(state, {
    type: "LOCK_CHECKPOINT",
    checkpoint: state.checkpoint,
  });
}
function firstAttempt(wrongIndexes = []) {
  let state = started();
  const wrongIds = new Set(wrongIndexes.map((i) => state.questions[i].id));
  for (let checkpoint = 0; checkpoint < 6; checkpoint++) {
    state = answerAndLock(state, wrongIds);
    assert.equal(state.phase, "CHECKPOINT");
    state = gameReducer(state, { type: "CONTINUE", checkpoint });
  }
  return state;
}
test("game cannot begin without a valid ID or an explicit start request", () => {
  const state = emptyGame();
  assert.equal(
    gameReducer(state, {
      type: "START_SUCCESS",
      gameId: "abc",
      questions: selectGameQuestions(),
    }),
    state,
  );
  const pending = gameReducer(state, {
    type: "START_REQUEST",
    identity: { seatNo: "12", name: "A" },
  });
  for (const gameId of [null, "", "   ", 123])
    assert.equal(
      gameReducer(pending, { type: "START_SUCCESS", gameId }),
      pending,
    );
});
test("five answers required; answers lock and previous checkpoints cannot be edited; duplicate taps are harmless", () => {
  let state = started();
  assert.equal(
    gameReducer(state, { type: "LOCK_CHECKPOINT", checkpoint: 0 }),
    state,
  );
  assert.equal(
    gameReducer(state, {
      type: "SELECT",
      id: state.questions[6].id,
      choiceId: state.questions[6].correctChoiceId,
    }),
    state,
  );
  assert.equal(
    gameReducer(state, {
      type: "SELECT",
      id: state.questions[0].id,
      choiceId: "unknown",
    }),
    state,
  );
  state = answerAndLock(state);
  const firstQuestion = state.questions[0];
  assert.equal(
    gameReducer(state, {
      type: "SELECT",
      id: firstQuestion.id,
      choiceId: firstQuestion.choices[1].id,
    }),
    state,
  );
  assert.equal(
    gameReducer(state, { type: "LOCK_CHECKPOINT", checkpoint: 0 }),
    state,
  );
  state = gameReducer(state, { type: "CONTINUE", checkpoint: 0 });
  assert.equal(state.checkpoint, 1);
  assert.equal(gameReducer(state, { type: "CONTINUE", checkpoint: 0 }), state);
  assert.equal(
    gameReducer(state, {
      type: "SELECT",
      id: firstQuestion.id,
      choiceId: firstQuestion.choices[1].id,
    }),
    state,
  );
});
test("23 initial + 5 rescued = 28 mastery; only seven initial mistakes get one retry", () => {
  let state = firstAttempt([0, 1, 2, 3, 20, 21, 22]);
  assert.equal(state.phase, "MISTAKE_INTRO");
  const initial = calculateInitialScores(state.questions, state.answers);
  assert.equal(initial.vocabularyCorrect, 16);
  assert.equal(initial.grammarCorrect, 7);
  assert.equal(initial.initialCorrect, 23);
  assert.equal(initial.initialWrong, 7);
  assert.deepEqual(
    state.challengeQuestions.map((q) => q.id),
    initial.mistakes.map((q) => q.id),
  );
  state = gameReducer(state, { type: "BEGIN_CHALLENGE" });
  assert.equal(
    gameReducer(state, {
      type: "SUBMIT_CHALLENGE",
      id: state.challengeQuestions[0].id,
    }),
    state,
  );
  for (let i = 0; i < 7; i++) {
    const q = state.challengeQuestions[i];
    const choiceId =
      i < 5
        ? q.correctChoiceId
        : q.choices.find((c) => c.id !== q.correctChoiceId).id;
    state = gameReducer(state, {
      type: "SELECT_CHALLENGE",
      id: q.id,
      choiceId,
    });
    state = gameReducer(state, { type: "SUBMIT_CHALLENGE", id: q.id });
    assert.equal(
      gameReducer(state, { type: "SUBMIT_CHALLENGE", id: q.id }),
      state,
    );
  }
  assert.equal(state.phase, "FINAL_RESULT");
  assert.equal(Object.keys(state.challengeAnswers).length, 7);
  assert.deepEqual(calculateChallengeScores(initial, state.challengeAnswers), {
    challengeCorrect: 5,
    finalMasteryCorrect: 28,
  });
  assert.deepEqual(completionPayload(state), {
    action: "complete",
    gameId: "original-game-id",
    vocabularyScore: "16/20",
    grammarScore: "7/10",
    initialScore: "23/30",
    mistakeCount: 7,
    mistakeChallengeScore: "5/7",
    finalMasteryScore: "28/30",
  });
  assert.equal(
    calculateInitialScores(state.questions, state.answers).initialCorrect,
    23,
  );
});
test("perfect 30/30 skips challenge; zero mistakes produces 0/0", () => {
  const state = firstAttempt();
  assert.equal(state.phase, "FINAL_RESULT");
  assert.equal(state.challengeQuestions.length, 0);
  assert.equal(completionPayload(state).mistakeChallengeScore, "0/0");
  assert.equal(completionPayload(state).finalMasteryScore, "30/30");
});
test("all-wrong case and unrecovered mistakes remain valid; no third attempt", () => {
  const state = firstAttempt(Array.from({ length: 30 }, (_, i) => i));
  const initial = calculateInitialScores(state.questions, state.answers);
  assert.equal(initial.initialCorrect, 0);
  assert.equal(state.challengeQuestions.length, 30);
  assert.equal(calculateChallengeScores(initial, {}).finalMasteryCorrect, 0);
});
test("Play Again clears answers and scores but retains identity for the new start; Exit clears everything", () => {
  const finished = firstAttempt();
  let state = gameReducer(finished, {
    type: "START_REQUEST",
    identity: finished.identity,
  });
  assert.deepEqual(state.identity, finished.identity);
  assert.equal(state.gameId, null);
  assert.deepEqual(state.answers, {});
  assert.deepEqual(state.challengeAnswers, {});
  state = gameReducer(state, {
    type: "START_SUCCESS",
    gameId: "new-game-id",
    questions: selectGameQuestions(),
  });
  assert.equal(state.checkpoint, 0);
  assert.equal(state.phase, "VOCABULARY");
  assert.equal(state.gameId, "new-game-id");
  assert.deepEqual(gameReducer(state, { type: "EXIT" }), emptyGame());
});
