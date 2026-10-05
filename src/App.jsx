import { useEffect, useRef, useState } from "react";
import {
  emptyGame,
  gameReducer,
  selectGameQuestions,
  completionPayload,
} from "./lib/game.js";
import { postToScoreSystem, createCompletionSaver } from "./lib/api.js";
import { playSound } from "./lib/sound.js";
import { Icon, Explorer, IslandScene } from "./components/Art.jsx";
import QuestionCard from "./components/QuestionCard.jsx";
import ResultPage from "./components/ResultPage.jsx";
import { Bilingual, ActionButton } from "./components/UI.jsx";

const events = [
  [
    "Treasure Map Fragment",
    "找到藏寶圖碎片",
    "map",
    "The first piece of the journey is yours.",
    "第一塊地圖到手了！沿著海岸尋找下一個線索。",
  ],
  [
    "Ancient Compass",
    "發現古老指南針",
    "compass",
    "Let the compass guide you deeper into the island.",
    "指南針指向島嶼深處，繼續前進吧！",
  ],
  [
    "Shipwreck Treasure Chest",
    "發現沉船寶箱",
    "chest",
    "A forgotten chest holds a new clue.",
    "沉船中的寶箱藏著新的線索！神殿就在不遠處。",
  ],
  [
    "Ancient Temple Key",
    "找到古老神殿鑰匙",
    "key",
    "The ruins await. A new chapter begins!",
    "鑰匙到手！準備進入文法遺跡，展開新的篇章。",
  ],
  [
    "Ruined Castle Gate",
    "開啟遺跡城堡大門",
    "gate",
    "The stone gate opens. The treasure is near.",
    "城堡石門已開啟，寶藏就在前方！",
  ],
  [
    "Legendary Treasure Chamber",
    "抵達傳說中的寶藏室",
    "gem",
    "You made it to the heart of the island.",
    "你已抵達島嶼的核心，準備揭開最後的秘密！",
  ],
];
export default function App() {
  const [state, setState] = useState(emptyGame);
  const liveState = useRef(state);
  const [seatNo, setSeatNo] = useState("");
  const [name, setName] = useState("");
  const [startError, setStartError] = useState(false);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [muted, setMuted] = useState(false);
  const starting = useRef(false);
  const completionSaver = useRef(createCompletionSaver());
  const currentPayload = useRef(null);
  const phase = state.phase;
  function transition(action) {
    const next = gameReducer(liveState.current, action);
    liveState.current = next;
    setState(next);
    return next;
  }
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    document
      .querySelector("[data-page-heading]")
      ?.focus({ preventScroll: true });
  }, [phase, state.checkpoint, state.challengeIndex]);
  function sound(kind = "button") {
    playSound(kind, muted);
  }
  async function startAdventure(event) {
    event?.preventDefault();
    if (starting.current || !seatNo.trim() || !name.trim()) return;
    starting.current = true;
    sound();
    setStartError(false);
    setSaveStatus("idle");
    currentPayload.current = null;
    const identity = { seatNo: seatNo.trim(), name: name.trim() };
    transition({ type: "START_REQUEST", identity });
    try {
      const data = await postToScoreSystem({ action: "start", ...identity });
      transition({
        type: "START_SUCCESS",
        gameId: data.gameId,
        questions: selectGameQuestions(),
      });
    } catch {
      transition({ type: "START_FAILURE" });
      setStartError(true);
    } finally {
      starting.current = false;
    }
  }
  async function saveResult(payload = currentPayload.current) {
    if (!payload || saveStatus === "saved") return;
    setSaveStatus("saving");
    try {
      await completionSaver.current(payload);
      if (liveState.current.gameId === payload.gameId) setSaveStatus("saved");
    } catch {
      if (liveState.current.gameId === payload.gameId) setSaveStatus("error");
    }
  }
  function advance(action) {
    const previous = liveState.current;
    const next = transition(action);
    if (next === previous) return;
    if (next.phase === "FINAL_RESULT") {
      sound("treasure");
      currentPayload.current = Object.freeze(completionPayload(next));
      void saveResult(currentPayload.current);
    } else
      sound(
        next.phase === "CHECKPOINT"
          ? [3, 5].includes(next.checkpoint)
            ? "stage"
            : "checkpoint"
          : "button",
      );
  }
  function exit() {
    sound();
    transition({ type: "EXIT" });
    setSeatNo("");
    setName("");
    setStartError(false);
    setSaveStatus("idle");
    currentPayload.current = null;
  }
  const isLogin = ["LOGIN", "STARTING"].includes(phase);
  const isChallenge = phase === "MISTAKE_CHALLENGE";
  const questions = isChallenge
    ? [state.challengeQuestions[state.challengeIndex]]
    : state.questions.slice(state.checkpoint * 5, state.checkpoint * 5 + 5);
  const answered = questions.filter((q) => state.answers[q.id]).length;
  const event = events[state.checkpoint];
  return (
    <div
      className={`app ${phase === "GRAMMAR" || state.checkpoint >= 4 ? "ruins-theme" : ""}`}
    >
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(e) => e.preventDefault()}
          aria-label="Lost Island 失落之島"
        >
          <span className="brand-icon">
            <Icon size={25} />
          </span>
          <span>
            LOST ISLAND<small>ENGLISH EXPEDITION</small>
          </span>
        </a>
        <div className="header-actions">
          <button
            className="sound-button"
            aria-label={muted ? "Unmute sound 開啟音效" : "Mute sound 關閉音效"}
            aria-pressed={muted}
            onClick={() => {
              if (muted) playSound("button", false);
              setMuted(!muted);
            }}
          >
            <Icon name={muted ? "mute" : "sound"} />
            <span>{muted ? "Sound off 靜音" : "Sound on 音效"}</span>
          </button>
          {!isLogin && (
            <button className="header-exit" onClick={exit}>
              <Icon name="exit" />
              <span>Exit 登出</span>
            </button>
          )}
        </div>
      </header>
      <main>
        {isLogin ? (
          <div className="login-layout">
            <section className="login-world">
              <div className="world-title">
                <span className="eyebrow">YOUR NEXT ADVENTURE STARTS HERE</span>
                <h1 data-page-heading tabIndex={-1}>
                  A lost island.
                  <br />A new adventure.
                </h1>
                <p>失落之島・英文尋寶冒險</p>
              </div>
              <div className="scene-frame">
                <IslandScene />
                <Explorer />
                <span className="scene-tag">
                  <Icon name="map" size={18} /> A journey of 30 clues · 30
                  道線索的旅程
                </span>
              </div>
              <div className="journey-teaser">
                <span>
                  <Icon name="map" />
                  Explore
                  <br />
                  <small>探索海島</small>
                </span>
                <i aria-hidden="true">· · ·</i>
                <span>
                  <Icon name="gate" />
                  Discover
                  <br />
                  <small>解開遺跡</small>
                </span>
                <i aria-hidden="true">· · ·</i>
                <span>
                  <Icon name="gem" />
                  Find treasure
                  <br />
                  <small>找到寶藏</small>
                </span>
              </div>
            </section>
            <section className="login-card">
              <span className="eyebrow">EXPLORER’S LOG · 冒險者日誌</span>
              <h2>
                <Bilingual en="Ready to explore?" zh="準備出發了嗎？" />
              </h2>
              <p>
                Follow the clues. Unlock your English.
                <br />
                跟著線索前進，解開你的英文實力。
              </p>
              <form onSubmit={startAdventure}>
                <label className="form-field" htmlFor="seatNo">
                  <Bilingual en="Seat Number" zh="座號" />
                  <input
                    id="seatNo"
                    name="seatNo"
                    placeholder="e.g. 12"
                    autoComplete="off"
                    required
                    value={seatNo}
                    disabled={phase === "STARTING"}
                    onChange={(e) => setSeatNo(e.target.value)}
                  />
                </label>
                <label className="form-field" htmlFor="studentName">
                  <Bilingual en="Name" zh="姓名" />
                  <input
                    id="studentName"
                    name="name"
                    placeholder="你的姓名"
                    autoComplete="name"
                    required
                    value={name}
                    disabled={phase === "STARTING"}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                {startError && (
                  <div className="connection-error" role="alert">
                    <Bilingual
                      en="Unable to connect to the score system. Please try again."
                      zh="目前無法連接成績系統，請再試一次。"
                    />
                  </div>
                )}
                {phase === "STARTING" && (
                  <p className="loading-message" role="status">
                    <span className="spinner" aria-hidden="true" />
                    <Bilingual
                      en="Preparing your adventure…"
                      zh="正在準備你的冒險……"
                    />
                  </p>
                )}
                <ActionButton
                  type="submit"
                  en={startError ? "Retry" : "Start Adventure"}
                  zh={startError ? "重新連線" : "開始冒險"}
                  disabled={
                    phase === "STARTING" || !seatNo.trim() || !name.trim()
                  }
                  icon="compass"
                />
              </form>
              <p className="login-note">
                <Icon name="key" size={17} /> No timer. Just curiosity.
                <br />
                沒有倒數計時，照自己的步調探索。
              </p>
            </section>
          </div>
        ) : phase === "FINAL_RESULT" ? (
          <div className="results">
            <ResultPage
              state={state}
              saveStatus={saveStatus}
              onRetry={() => saveResult()}
              onAgain={startAdventure}
              onExit={exit}
            />
          </div>
        ) : (
          <div className="adventure-layout">
            <section className="adventure-header">
              <div>
                <span className="eyebrow">
                  {isChallenge || phase === "MISTAKE_INTRO"
                    ? "ONE MORE LOOK · 再找一次線索"
                    : state.checkpoint < 4
                      ? "STAGE 01 · 海島探索"
                      : "STAGE 02 · 古老遺跡"}
                </span>
                <h1 data-page-heading tabIndex={-1}>
                  <Bilingual
                    en={
                      isChallenge || phase === "MISTAKE_INTRO"
                        ? "Mistake Challenge"
                        : state.checkpoint < 4
                          ? "Vocabulary Adventure"
                          : "Grammar Ruins"
                    }
                    zh={
                      isChallenge || phase === "MISTAKE_INTRO"
                        ? "錯題挑戰"
                        : state.checkpoint < 4
                          ? "單字冒險"
                          : "文法遺跡"
                    }
                  />
                </h1>
              </div>
              <span className="explorer-name">
                Explorer 冒險者
                <br />
                <b>{state.identity.name}</b>
              </span>
            </section>
            <div className="progress-panel">
              <div className="progress-caption">
                <span>Adventure Progress 冒險進度</span>
                <strong>
                  {phase === "CHECKPOINT"
                    ? (state.checkpoint + 1) * 5
                    : ["MISTAKE_INTRO", "MISTAKE_CHALLENGE"].includes(phase)
                      ? 30
                      : state.checkpoint * 5}{" "}
                  / 30
                </strong>
              </div>
              <ol
                className="map-progress"
                aria-label="Six checkpoints 六個關卡"
              >
                {events.map((e, i) => (
                  <li
                    key={e[0]}
                    className={
                      i < state.checkpoint ||
                      ["MISTAKE_INTRO", "MISTAKE_CHALLENGE"].includes(phase) ||
                      (phase === "CHECKPOINT" && i === state.checkpoint)
                        ? "visited"
                        : i === state.checkpoint
                          ? "current"
                          : ""
                    }
                    aria-current={i === state.checkpoint ? "step" : undefined}
                  >
                    <Icon name={e[2]} size={20} />
                    <span>{i + 1}</span>
                  </li>
                ))}
              </ol>
            </div>
            {phase === "CHECKPOINT" ? (
              <section className="event-card">
                <div className="event-art">
                  <IslandScene
                    ruins={state.checkpoint >= 4}
                    treasure={state.checkpoint === 5}
                  />
                  <Explorer small />
                  <span className="event-medallion">
                    <Icon name={event[2]} size={43} />
                  </span>
                </div>
                <span className="eyebrow">
                  CHECKPOINT {state.checkpoint + 1} UNLOCKED · 線索已收集
                </span>
                <h2>
                  <Bilingual en={event[0]} zh={event[1]} />
                </h2>
                <p>
                  <Bilingual en={event[3]} zh={event[4]} />
                </p>
                <ActionButton
                  en={
                    state.checkpoint === 3
                      ? "Enter Grammar Ruins"
                      : state.checkpoint === 5
                        ? "Open the Treasure"
                        : "Continue Adventure"
                  }
                  zh={
                    state.checkpoint === 3
                      ? "進入文法遺跡"
                      : state.checkpoint === 5
                        ? "開啟寶藏"
                        : "繼續冒險"
                  }
                  onClick={() =>
                    advance({ type: "CONTINUE", checkpoint: state.checkpoint })
                  }
                />
              </section>
            ) : phase === "MISTAKE_INTRO" ? (
              <section className="event-card mistake-intro">
                <div className="intro-art">
                  <Explorer />
                  <Icon name="map" size={80} />
                </div>
                <h2>
                  <Bilingual
                    en="Some clues need another look."
                    zh="有些線索還需要再確認！"
                  />
                </h2>
                <p>
                  <Bilingual
                    en="Try the missed questions one more time!"
                    zh="再挑戰一次剛才答錯的題目吧！每題有一次重答機會。"
                  />
                </p>
                <ActionButton
                  en="Start Mistake Challenge"
                  zh="開始錯題挑戰"
                  onClick={() => advance({ type: "BEGIN_CHALLENGE" })}
                />
              </section>
            ) : (
              <>
                <div className="checkpoint-caption">
                  <span>
                    <Icon name={isChallenge ? "compass" : event[2]} size={19} />
                    {isChallenge
                      ? `Clue ${state.challengeIndex + 1} / ${state.challengeQuestions.length} · 錯題線索`
                      : `Checkpoint ${state.checkpoint < 4 ? state.checkpoint + 1 : state.checkpoint - 3} / ${state.checkpoint < 4 ? 4 : 2} · 關卡`}
                  </span>
                  <small>
                    {isChallenge
                      ? "One more try · 再試一次"
                      : "Choose your clues · 選出你的線索"}
                  </small>
                </div>
                {questions.map((q, i) => (
                  <QuestionCard
                    key={`${isChallenge ? "challenge" : "initial"}-${q.id}`}
                    question={q}
                    number={
                      isChallenge
                        ? state.challengeIndex + 1
                        : state.checkpoint * 5 + i + 1
                    }
                    selected={
                      isChallenge
                        ? state.challengeSelection
                        : state.answers[q.id]
                    }
                    onSelect={(choiceId) => {
                      sound();
                      transition({
                        type: isChallenge ? "SELECT_CHALLENGE" : "SELECT",
                        id: q.id,
                        choiceId,
                      });
                    }}
                  />
                ))}
                <div className="continue-panel">
                  <p>
                    {isChallenge
                      ? "Your next clue is waiting. 下一道線索正在等你。"
                      : `${answered} / 5 clues chosen · 已選擇 ${answered} 道線索`}
                  </p>
                  <ActionButton
                    en={
                      isChallenge ? "Submit & Continue" : "Continue Adventure"
                    }
                    zh={isChallenge ? "送出並繼續" : "繼續冒險"}
                    disabled={
                      isChallenge ? !state.challengeSelection : answered !== 5
                    }
                    onClick={() =>
                      advance(
                        isChallenge
                          ? { type: "SUBMIT_CHALLENGE", id: questions[0].id }
                          : {
                              type: "LOCK_CHECKPOINT",
                              checkpoint: state.checkpoint,
                            },
                      )
                    }
                  />
                  {!isChallenge && (
                    <small>
                      All five answers will be locked.
                      送出後，這五題的答案將鎖定。
                    </small>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <footer>
        LOST ISLAND <span>·</span> Every clue is a step forward.
        每一道線索，都是進步。
      </footer>
    </div>
  );
}
