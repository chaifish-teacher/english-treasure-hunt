import { calculateInitialScores } from "../lib/game.js";
import { Icon, Explorer, IslandScene } from "./Art.jsx";
import { Bilingual, ActionButton } from "./UI.jsx";

export default function ResultPage({
  state,
  saveStatus,
  onRetry,
  onAgain,
  onExit,
}) {
  const initial = calculateInitialScores(state.questions, state.answers);
  const perfect = initial.initialCorrect === 30;
  const encouragement = perfect
    ? [
        "Every clue solved. The legendary treasure is yours!",
        "所有線索一次解開！傳說中的寶藏屬於你！",
      ]
    : initial.initialCorrect >= 25
      ? [
          "Great adventure! You’re close to mastering these skills.",
          "很棒的冒險！你已經快要完全掌握這些考點了！",
        ]
      : initial.initialCorrect >= 18
        ? [
            "Nice work! Every clue you solved made you stronger.",
            "做得很好！每解開一個線索，你的英文實力就更進一步！",
          ]
        : [
            "Review the clues and try another adventure!",
            "尋寶還沒有結束！複習線索後，再挑戰一次吧！",
          ];
  const answerText = (q, answer) =>
    q.choices.find((c) => c.id === answer)?.text ?? "—";
  return (
    <>
      <section className="result-hero">
        <IslandScene treasure />
        <div className="result-heading">
          <span className="eyebrow">THE TREASURE IS YOURS · 寶藏已開啟</span>
          <h1 tabIndex={-1} data-page-heading>
            <Bilingual en="Adventure Complete!" zh="冒險完成！" />
          </h1>
          <p className="encouragement">
            <Bilingual en={encouragement[0]} zh={encouragement[1]} />
          </p>
        </div>
      </section>
      <section className="result-panel">
        <div className="mastery">
          <Icon name="gem" size={36} />
          <div>
            <Bilingual en="Total Score" zh="總成績" />
            <strong data-testid="mastery">
              {initial.initialCorrect}
              <small>/30</small>
            </strong>
          </div>
          <Explorer small />
        </div>
        <div className="score-grid">
          {[
            ["Vocabulary", "單字成績", `${initial.vocabularyCorrect}/20`],
            ["Grammar", "文法成績", `${initial.grammarCorrect}/10`],
          ].map(([en, zh, score]) => (
            <div className="score-cell" key={en}>
              <Bilingual en={en} zh={zh} />
              <strong data-testid={en}>{score}</strong>
            </div>
          ))}
        </div>
        <p className="initial-counts">
          Answer Summary · 答題狀況{" "}
          <span>
            Correct 答對 <b>{initial.initialCorrect}</b>
          </span>
          <span>
            Incorrect 答錯 <b>{initial.initialWrong}</b>
          </span>
        </p>
        <div
          className={`save-status ${saveStatus}`}
          role="status"
          aria-live="polite"
        >
          <Bilingual
            en={
              saveStatus === "saved"
                ? "Your result has been saved."
                : saveStatus === "error"
                  ? "Your result could not be saved yet."
                  : "Saving your treasure record…"
            }
            zh={
              saveStatus === "saved"
                ? "成績已成功儲存。"
                : saveStatus === "error"
                  ? "成績目前尚未成功儲存。"
                  : "正在儲存你的冒險成績……"
            }
          />
          {saveStatus === "error" && (
            <ActionButton
              en="Retry Save"
              zh="重新儲存"
              onClick={onRetry}
              secondary
            />
          )}
        </div>
      </section>
      <section className="review-section">
        <h2>
          <Bilingual en="Your Adventure Review" zh="全部題目回顧" />
        </h2>
        <p>
          All 30 clues, your answers, and explanations. 本次全部 30
          題都在這裡；展開題目查看作答、正確答案與解析。
        </p>
        {state.questions.map((q, index) => (
          <details className="review-card" key={q.id} data-question-id={q.id}>
            <summary>
              <span className="review-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span>
                <small className="review-question-label">Question 題目</small>
                <span lang="en">{q.question}</span>
              </span>
              <span
                className={`answer-status ${state.answers[q.id] === q.correctChoiceId ? "correct" : "incorrect"}`}
              >
                {state.answers[q.id] === q.correctChoiceId
                  ? "Correct 答對"
                  : "Incorrect 答錯"}
              </span>
              <span className="expand-icon" aria-hidden="true">
                +
              </span>
            </summary>
            <div className="review-content">
              <ol className="review-choices">
                {q.choices.map((choice, i) => (
                  <li key={choice.id} lang="en">
                    {"ABCD"[i]}. {choice.text}
                  </li>
                ))}
              </ol>
              <dl>
                <dt>
                  <Bilingual en="Your Answer" zh="你的答案" />
                </dt>
                <dd lang="en">{answerText(q, state.answers[q.id])}</dd>
                <dt>
                  <Bilingual en="Correct Answer" zh="正確答案" />
                </dt>
                <dd className="answer-reveal" lang="en">
                  {answerText(q, q.correctChoiceId)}
                </dd>
              </dl>
              <div className="explanation">
                <Bilingual en="Explanation" zh="解析" />
                <p>{q.explanation}</p>
              </div>
            </div>
          </details>
        ))}
      </section>
      <div className="result-actions">
        <ActionButton
          en="Play Again"
          zh="再次挑戰"
          onClick={onAgain}
          disabled={saveStatus === "saving"}
          icon="compass"
        />
        <ActionButton
          en="Exit"
          zh="登出"
          onClick={onExit}
          secondary
          icon="exit"
        />
      </div>
    </>
  );
}
