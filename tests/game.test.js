import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  questionBank,
  shuffleArray,
  sampleWithoutReplacement,
  selectGameQuestions,
  shuffleQuestionChoices,
  completionPayload,
  checkpointMistakes,
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
    if (state.phase === "CHECKPOINT_RETRY") {
      for (const q of checkpointMistakes(state)) {
        state = gameReducer(state, {
          type: "SELECT_CORRECTION",
          checkpoint,
          id: q.id,
          choiceId: q.correctChoiceId,
        });
      }
      state = gameReducer(state, { type: "SUBMIT_CORRECTIONS", checkpoint });
    }
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
test("30 answers go straight to results, with original scores and no challenge credit", () => {
  const state = firstAttempt([0, 1, 2, 3, 20, 21, 22]);
  assert.equal(state.phase, "FINAL_RESULT");
  assert.deepEqual(completionPayload(state), {
    action: "complete",
    gameId: "original-game-id",
    vocabularyScore: "16/20",
    grammarScore: "7/10",
    initialScore: "23/30",
    mistakeCount: 7,
    mistakeChallengeScore: "0/0",
    finalMasteryScore: "23/30",
  });
  for (const type of [
    "BEGIN_CHALLENGE",
    "SELECT_CHALLENGE",
    "SUBMIT_CHALLENGE",
  ]) {
    assert.equal(
      gameReducer(state, { type, id: state.questions[0].id }),
      state,
    );
  }
});
test("perfect 30/30 retains every answered question and submits the same total", () => {
  const state = firstAttempt();
  assert.equal(state.phase, "FINAL_RESULT");
  assert.equal(state.questions.length, 30);
  assert.equal(Object.keys(state.answers).length, 30);
  assert.equal(completionPayload(state).mistakeChallengeScore, "0/0");
  assert.equal(completionPayload(state).finalMasteryScore, "30/30");
});
test("all 30 wrong answers still go straight to results and retain every answer", () => {
  const state = firstAttempt(Array.from({ length: 30 }, (_, i) => i));
  assert.equal(state.phase, "FINAL_RESULT");
  assert.equal(Object.keys(state.answers).length, 30);
  assert.equal(completionPayload(state).initialScore, "0/30");
  assert.equal(completionPayload(state).mistakeCount, 30);
  assert.equal(completionPayload(state).mistakeChallengeScore, "0/0");
  assert.equal(completionPayload(state).finalMasteryScore, "0/30");
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

test("every five-question checkpoint triggers correction at exactly 3, 4 or 5 mistakes, never 0–2", () => {
  for (let checkpoint = 0; checkpoint < 6; checkpoint++) {
    for (let count = 0; count <= 5; count++) {
      let state = {
        ...started(),
        checkpoint,
        phase: checkpoint < 4 ? "VOCABULARY" : "GRAMMAR",
      };
      const wrong = new Set(
        state.questions
          .slice(checkpoint * 5, checkpoint * 5 + count)
          .map((q) => q.id),
      );
      state = answerAndLock(state, wrong);
      assert.equal(checkpointMistakes(state).length, count);
      assert.equal(state.phase, count >= 3 ? "CHECKPOINT_RETRY" : "CHECKPOINT");
    }
  }
});

test("correction locks first answers, accepts only current missed questions, requires all answers, and allows one retry", () => {
  let state = started();
  const wrong = new Set(state.questions.slice(0, 3).map((q) => q.id));
  state = answerAndLock(state, wrong);
  const firstAnswers = { ...state.answers };
  assert.equal(gameReducer(state, { type: "CONTINUE", checkpoint: 0 }), state);
  assert.equal(
    gameReducer(state, { type: "SUBMIT_CORRECTIONS", checkpoint: 0 }),
    state,
  );
  const q = state.questions[0];
  for (const action of [
    { type: "SELECT", id: q.id, choiceId: q.correctChoiceId },
    {
      type: "SELECT_CORRECTION",
      checkpoint: 0,
      id: state.questions[4].id,
      choiceId: state.questions[4].correctChoiceId,
    },
    {
      type: "SELECT_CORRECTION",
      checkpoint: 1,
      id: q.id,
      choiceId: q.correctChoiceId,
    },
    { type: "SELECT_CORRECTION", checkpoint: 0, id: q.id, choiceId: "invalid" },
  ])
    assert.equal(gameReducer(state, action), state);
  for (const missed of checkpointMistakes(state)) {
    state = gameReducer(state, {
      type: "SELECT_CORRECTION",
      checkpoint: 0,
      id: missed.id,
      choiceId: missed.correctChoiceId,
    });
  }
  const submitted = gameReducer(state, {
    type: "SUBMIT_CORRECTIONS",
    checkpoint: 0,
  });
  assert.equal(submitted.phase, "CHECKPOINT");
  assert.deepEqual(submitted.answers, firstAnswers);
  assert.equal(Object.keys(submitted.correctionAnswers).length, 3);
  assert.deepEqual(submitted.correctionDraft, {});
  assert.equal(
    gameReducer(submitted, { type: "SUBMIT_CORRECTIONS", checkpoint: 0 }),
    submitted,
  );
  assert.equal(
    gameReducer(submitted, {
      type: "SELECT_CORRECTION",
      checkpoint: 0,
      id: q.id,
      choiceId: q.correctChoiceId,
    }),
    submitted,
  );
  const next = gameReducer(submitted, { type: "CONTINUE", checkpoint: 0 });
  assert.equal(next.checkpoint, 1);
  assert.deepEqual(next.correctionAnswers, submitted.correctionAnswers);
});

test("a still-wrong correction is accepted once without another correction round or extra points", () => {
  let state = started();
  state = answerAndLock(
    state,
    new Set(state.questions.slice(0, 5).map((q) => q.id)),
  );
  for (const q of checkpointMistakes(state)) {
    state = gameReducer(state, {
      type: "SELECT_CORRECTION",
      checkpoint: 0,
      id: q.id,
      choiceId: state.answers[q.id],
    });
  }
  state = gameReducer(state, { type: "SUBMIT_CORRECTIONS", checkpoint: 0 });
  assert.equal(state.phase, "CHECKPOINT");
  assert.equal(checkpointMistakes(state).length, 5);
  assert.equal(
    gameReducer(state, { type: "LOCK_CHECKPOINT", checkpoint: 0 }),
    state,
  );
});

test("successful corrections on all six checkpoints never change original scores or completion payload", () => {
  const state = firstAttempt(Array.from({ length: 30 }, (_, i) => i));
  assert.equal(state.phase, "FINAL_RESULT");
  assert.equal(Object.keys(state.correctionAnswers).length, 30);
  assert.ok(
    state.questions.every(
      (q) => state.correctionAnswers[q.id] === q.correctChoiceId,
    ),
  );
  assert.equal(completionPayload(state).initialScore, "0/30");
  assert.equal(completionPayload(state).finalMasteryScore, "0/30");
  assert.equal(completionPayload(state).mistakeCount, 30);
  const restarted = gameReducer(state, {
    type: "START_REQUEST",
    identity: state.identity,
  });
  assert.deepEqual(restarted.correctionAnswers, {});
  assert.deepEqual(restarted.correctionDraft, {});
  assert.deepEqual(gameReducer(state, { type: "EXIT" }), emptyGame());
});
