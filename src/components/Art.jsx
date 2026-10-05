export function Icon({ name = "compass", size = 24, ...props }) {
  const paths = {
    compass: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16 8-2 6-6 2 2-6Z" />
        <path d="M12 1v2m0 18v2M1 12h2m18 0h2" />
      </>
    ),
    map: (
      <>
        <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z" />
        <path d="M9 3v16m6-14v16M5 10l2 2m-2 0 2-2m10-2 2 2m-2 0 2-2" />
      </>
    ),
    chest: (
      <>
        <path d="M3 10V8a9 5 0 0 1 18 0v2M3 10h18v10H3Z" />
        <path d="M7 4v16m10-16v16M10 10v5h4v-5" />
      </>
    ),
    key: (
      <>
        <circle cx="8" cy="8" r="5" />
        <path d="m12 12 9 9m-4-4 3-3m-6 0 3-3" />
      </>
    ),
    gate: (
      <>
        <path d="M3 21V3h5v4h8V3h5v18M8 21v-6a4 4 0 0 1 8 0v6M3 10h4m10 0h4" />
      </>
    ),
    gem: (
      <>
        <path d="m3 9 4-6h10l4 6-9 12Z" />
        <path d="M3 9h18M7 3l5 18 5-18" />
      </>
    ),
    sound: (
      <>
        <path d="M11 4 6 8H2v8h4l5 4Z" />
        <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />
      </>
    ),
    mute: (
      <>
        <path d="M11 4 6 8H2v8h4l5 4Z" />
        <path d="m16 9 6 6m0-6-6 6" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    exit: (
      <>
        <path d="M10 4H3v16h7m4-12 5 4-5 4m-7-4h12" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name] || paths.compass}
    </svg>
  );
}
export function Explorer({ small = false }) {
  return (
    <svg
      className={`explorer ${small ? "small" : ""}`}
      viewBox="0 0 150 180"
      aria-hidden="true"
    >
      <ellipse cx="76" cy="172" rx="36" ry="6" fill="#173e36" opacity=".14" />
      <path d="M57 127 53 160h20l3-30 7 30h20l-9-36Z" fill="#285653" />
      <path d="M53 157h21v12H48q-4-8 5-12m30 0h21l6 12H84Z" fill="#453b2e" />
      <rect x="43" y="90" width="57" height="51" rx="17" fill="#bd793f" />
      <path d="m48 100-16 24 10 8 21-24m31-4 23 18 7-10-22-22" fill="#f0b48b" />
      <path
        d="m49 91 11 33 25 2 11-33M56 130h35"
        fill="none"
        stroke="#ead09b"
        strokeWidth="7"
      />
      <rect x="61" y="118" width="24" height="17" rx="4" fill="#d7a94f" />
      <path d="M45 53q-1-30 31-30t30 31v18q-5 27-31 26T45 70Z" fill="#543b30" />
      <path d="M47 56q24 7 55-2v18q-2 25-27 25T47 72Z" fill="#f0b48b" />
      <path d="M40 50q7-31 36-31t34 31Z" fill="#e2bd76" />
      <path d="M41 47h68l13 11q-50 15-92 0Z" fill="#edcc8c" />
      <path d="M46 44h58" stroke="#6c6342" strokeWidth="9" />
      <circle cx="62" cy="71" r="3" fill="#47372b" />
      <circle cx="87" cy="71" r="3" fill="#47372b" />
      <path
        d="M67 84q8 6 16-1"
        stroke="#8d4c37"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle
        cx="99"
        cy="128"
        r="9"
        fill="#f5d879"
        stroke="#796239"
        strokeWidth="2"
      />
      <path d="m99 122 3 7-6 4Z" fill="#477375" />
    </svg>
  );
}
export function IslandScene({ ruins = false, treasure = false }) {
  return (
    <svg
      className="island-scene"
      viewBox="0 0 760 360"
      role="img"
      aria-label={
        treasure
          ? "Opened treasure chest inside an ancient island chamber"
          : ruins
            ? "Ancient castle ruins on a tropical island"
            : "A mysterious island with palms, a pirate shipwreck and an ancient castle"
      }
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#d3ece6" />
          <stop offset="1" stopColor="#f8e9bb" />
        </linearGradient>
        <linearGradient id="ocean" x2="0" y2="1">
          <stop stopColor="#68b6ac" />
          <stop offset="1" stopColor="#226e72" />
        </linearGradient>
        <linearGradient id="land" x2="0" y2="1">
          <stop stopColor="#5b8b62" />
          <stop offset="1" stopColor="#244c43" />
        </linearGradient>
      </defs>
      <rect width="760" height="360" fill="url(#sky)" />
      <circle cx="610" cy="67" r="35" fill="#f9d785" />
      <path
        d="M28 65h100m-74-10h40M480 36h73m100 88h90"
        stroke="#fff9e6"
        strokeWidth="9"
        strokeLinecap="round"
        opacity=".8"
      />
      <path d="m184 229 130-142 70 75 80-100 140 173Z" fill="#82a38a" />
      <path d="m214 238 92-114 100 117 63-161 149 169Z" fill="url(#land)" />
      <path
        d="m293 125 13-1 14 15-15-5-12 7m163-49 13-12 13 14-11-4Z"
        fill="#b4c6a0"
      />
      <rect y="237" width="760" height="123" fill="url(#ocean)" />
      <path
        d="M166 271q57-30 144-29t97-20q63-42 138 17t60 57q-119 55-274 20t-165-45"
        fill="#e8d29a"
      />
      <path
        d="M207 263q66-24 111-20t107-13q69-32 119 24t-93 26-101-2-143-15"
        fill="#6a8d59"
      />
      <g fill="#b9baa0" stroke="#687966" strokeWidth="3">
        <path d="M439 204v-63h14v10h13v-10h14v63m23 0v-83h13v10h14v-10h14v83Z" />
        <path d="M450 170h78v48h-78Z" />
      </g>
      <path d="M476 218v-29q14-26 27 0v29" fill="#344f46" />
      <path
        d="M434 209h116m-99-29h21m41 0h13"
        stroke="#d2d0af"
        strokeWidth="4"
      />
      <g stroke="#86673d" strokeWidth="8" fill="none" strokeLinecap="round">
        <path d="M260 262q15-61-2-88m321 106q-13-45 4-77" />
      </g>
      <g fill="#37694a">
        <path d="M258 175q-56-28-66 15 30-22 66-9-42 0-45 32 28-26 49-31 9 21 34 27-13-28-26-34 27 0 47 15-14-43-59-15M583 203q-29-31-50-9l44 14q-33 3-35 26l43-26q26 10 37 26-1-32-39-31 26-12 44 4-6-31-44-4" />
      </g>
      <g transform="translate(76 253) rotate(-9)">
        <path d="m-48 17 98 0-27 25h-51Z" fill="#754f35" />
        <path d="M0 20v-81m-36 18h72" stroke="#5e4734" strokeWidth="4" />
        <path d="M-31-39 27-39 15 6-24 3Z" fill="#f5e3b9" />
        <path d="m-7-18 14 10m-14 0 14-10" stroke="#6b6857" strokeWidth="3" />
        <path d="M-37 29h67" stroke="#b48651" strokeWidth="3" />
      </g>
      <g stroke="#b0e0cb" strokeWidth="2" fill="none" opacity=".7">
        <path d="M33 320h112m14 14h50m415-9h92m-512-29h39m414 7h105M0 273h35" />
      </g>
      <path
        d="m350 268 24 2 15 9 18-1"
        stroke="#b49459"
        strokeDasharray="4 5"
        strokeWidth="3"
        fill="none"
      />
      {ruins && (
        <g transform="translate(293 135)">
          <path
            d="M0 130V20h24v12h15V20h24v110m95 0V20h24v12h15V20h24v110M25 56h148v74H25Z"
            fill="#a8ae94"
            stroke="#596d58"
            strokeWidth="4"
          />
          <path d="M66 130V90q33-54 66 0v40Z" fill="#314c43" />
          <path d="M-8 130h214" stroke="#e3dab1" strokeWidth="8" />
          <path
            d="M74 44h52M15 77h21m134 0h21"
            stroke="#d8d2ad"
            strokeWidth="5"
          />
        </g>
      )}
      {treasure && (
        <g transform="translate(310 220)">
          <path
            d="m68 32-41-100m43 100 4-115m-1 115 46-104m-43 109 90-62"
            stroke="#ffdf75"
            strokeWidth="12"
            opacity=".5"
          />
          <path
            d="M0 9 115-8v58L0 62Z"
            fill="#865537"
            stroke="#edc866"
            strokeWidth="6"
          />
          <path
            d="m0 9 7-58 115-18-7 59Z"
            fill="#c39348"
            stroke="#f5d777"
            strokeWidth="6"
          />
          <path
            d="m19-1 77-13M25 22v34m69-41v39"
            stroke="#f4d277"
            strokeWidth="8"
          />
          <path d="M51 17h19v22H51Z" fill="#efcf69" />
          <g fill="#ffe89d">
            <circle cx="21" cy="5" r="8" />
            <circle cx="45" cy="0" r="8" />
            <circle cx="67" cy="-5" r="8" />
            <circle cx="91" cy="-7" r="8" />
          </g>
          <path d="m54-24 8-14 10 12-9 18Z" fill="#76d4c1" />
        </g>
      )}
    </svg>
  );
}
