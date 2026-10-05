export default function QuestionCard({ question, number, selected, onSelect }) {
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
    </fieldset>
  );
}
