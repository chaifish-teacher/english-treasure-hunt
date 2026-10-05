import bank from "../data/questions.json" with { type: "json" };
export const questionBank = bank;

export function shuffleArray(items, random = Math.random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function sampleWithoutReplacement(items, count, random = Math.random) {
  if (!Number.isInteger(count) || count < 0 || count > items.length)
    throw new RangeError("Invalid sample size");
  return shuffleArray(items, random).slice(0, count);
}
export function shuffleQuestionChoices(question, random = Math.random) {
  return { ...question, choices: shuffleArray(question.choices, random) };
}
export function selectGameQuestions(random = Math.random) {
  const sample = (category, sourceType, count) =>
    sampleWithoutReplacement(
      bank.filter(
        (q) => q.category === category && q.sourceType === sourceType,
      ),
      count,
      random,
    );
  return [
    ...shuffleArray(
      [
        ...sample("vocabulary", "original", 10),
        ...sample("vocabulary", "new", 10),
      ],
      random,
    ),
    ...shuffleArray(
      [...sample("grammar", "original", 5), ...sample("grammar", "new", 5)],
      random,
    ),
  ].map((q) => shuffleQuestionChoices(q, random));
}
export function calculateInitialScores(questions, answers) {
  const correct = (q) => answers[q.id] === q.correctChoiceId;
  const vocabularyCorrect = questions.filter(
    (q) => q.category === "vocabulary" && correct(q),
  ).length;
  const grammarCorrect = questions.filter(
    (q) => q.category === "grammar" && correct(q),
  ).length;
  const mistakes = questions.filter((q) => !correct(q));
  return {
    vocabularyCorrect,
    grammarCorrect,
    initialCorrect: vocabularyCorrect + grammarCorrect,
    initialWrong: mistakes.length,
    mistakes,
  };
}
export function completionPayload(state) {
  const initial = calculateInitialScores(state.questions, state.answers);
  return {
    action: "complete",
    gameId: state.gameId,
    vocabularyScore: `${initial.vocabularyCorrect}/20`,
    grammarScore: `${initial.grammarCorrect}/10`,
    initialScore: `${initial.initialCorrect}/30`,
    mistakeCount: initial.initialWrong,
    // Keep the existing GAS schema; there is no second-attempt stage.
    mistakeChallengeScore: "0/0",
    finalMasteryScore: `${initial.initialCorrect}/30`,
  };
}
export function emptyGame() {
  return {
    phase: "LOGIN",
    gameId: null,
    identity: null,
    questions: [],
    answers: {},
    checkpoint: 0,
  };
}
export function gameReducer(state, action) {
  switch (action.type) {
    case "START_REQUEST":
      if (!["LOGIN", "FINAL_RESULT"].includes(state.phase)) return state;
      return { ...emptyGame(), phase: "STARTING", identity: action.identity };
    case "START_FAILURE":
      return state.phase === "STARTING"
        ? { ...emptyGame(), identity: state.identity }
        : state;
    case "START_SUCCESS":
      if (
        state.phase !== "STARTING" ||
        typeof action.gameId !== "string" ||
        !action.gameId.trim()
      )
        return state;
      return {
        ...state,
        phase: "VOCABULARY",
        gameId: action.gameId,
        questions: action.questions,
      };
    case "SELECT": {
      if (!["VOCABULARY", "GRAMMAR"].includes(state.phase)) return state;
      const q = state.questions
        .slice(state.checkpoint * 5, state.checkpoint * 5 + 5)
        .find((q) => q.id === action.id);
      if (!q?.choices.some((c) => c.id === action.choiceId)) return state;
      return {
        ...state,
        answers: { ...state.answers, [q.id]: action.choiceId },
      };
    }
    case "LOCK_CHECKPOINT": {
      if (
        !["VOCABULARY", "GRAMMAR"].includes(state.phase) ||
        action.checkpoint !== state.checkpoint
      )
        return state;
      const current = state.questions.slice(
        state.checkpoint * 5,
        state.checkpoint * 5 + 5,
      );
      if (current.length !== 5 || !current.every((q) => state.answers[q.id]))
        return state;
      return { ...state, phase: "CHECKPOINT" };
    }
    case "CONTINUE": {
      if (
        state.phase !== "CHECKPOINT" ||
        action.checkpoint !== state.checkpoint
      )
        return state;
      if (state.checkpoint < 5) {
        const checkpoint = state.checkpoint + 1;
        return {
          ...state,
          checkpoint,
          phase: checkpoint < 4 ? "VOCABULARY" : "GRAMMAR",
        };
      }
      return { ...state, phase: "FINAL_RESULT" };
    }
    case "EXIT":
      return emptyGame();
    default:
      return state;
  }
}
