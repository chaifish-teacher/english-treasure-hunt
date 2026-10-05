import hints from "../data/hints.json";

export default function QuestionCard({
  question,
  number,
  selected,
  onSelect,
  support = false,
}) {
  return (
    <fieldset className="question-card" data-question-id={question.id}>
      <legend>
        <span className="clue-number">
          CLUE {String(number).padStart(2, "0")}
        </span>
        <span className="question-text" lang="en">
          {question.question}
        </span>
      </legend>
      {support && (
        <div className="checkpoint-hint" lang="zh-Hant">
          <strong>Clearer clue 更明確的提示</strong>
          <p>{hints[question.id].supportHint}</p>
        </div>
      )}
      <div className="choices">
        {question.choices.map((choice, index) => (
          <label
            key={choice.id}
            className={`choice ${selected === choice.id ? "selected" : ""}`}
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={choice.id}
              checked={selected === choice.id}
              onChange={() => onSelect(choice.id)}
            />
            <span className="choice-letter" aria-hidden="true">
              {"ABCD"[index]}
            </span>
            <span lang="en">{choice.text}</span>
            <span className="selection-dot" aria-hidden="true" />
          </label>
        ))}
      </div>
      <details className="question-hint">
        <summary>
          Hint 提示 <span aria-hidden="true">✧</span>
        </summary>
        <div className="hint-content" lang="zh-Hant">
          <p>{hints[question.id].hint}</p>
          {hints[question.id].translation && (
            <div className="hint-translation">
              <strong>Sentence meaning 題目翻譯</strong>
              <p>{hints[question.id].translation}</p>
              {question.question.includes("______") && (
                <small>填空處保留空格，請自行判斷選項。</small>
              )}
            </div>
          )}
        </div>
      </details>
    </fieldset>
  );
}
