const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const FACE_RANKS = new Set(["J", "Q", "K", "A"]);
const NUMBER_RANKS = new Set(RANKS.filter((rank) => !FACE_RANKS.has(rank)));
const RANK_ORDER = RANKS.reduce((acc, rank, index) => {
  acc[rank] = index + 2;
  return acc;
}, {});

const TOTAL_DECK_CARDS = 54;
const JOKER_COUNT = 2;
const CARDS_PER_RANK = 4;
const LOWEST_RANK_VALUE = 2;
const HIGHEST_RANK_VALUE = 14;

const PAYOUTS = {
  color: 1.0,
  suit: 3.0,
  number: 0.5,
  face: 2.0,
  high_low_seven: 1.0,
  high_low_previous: 1.0,
  rank_exact: 12.0,
  pair: 1.0,
  two_pair: 3.0,
  drill: 5.0,
  straight: 10.0,
  flush: 15.0,
  full_house: 20.0,
  poker: 50.0,
  straight_flush: 100.0,
  royal_flush: 250.0,
  joker: 25.0,
};

const SINGLE_CARD_BET_TYPES = new Set([
  "color",
  "suit",
  "number",
  "face",
  "high_low_seven",
  "high_low_previous",
  "rank_exact",
  "joker",
]);

const PIE_COLORS = {
  colors: {
    red: "#d84b4b",
    black: "#1f2329",
    joker: "#f3c648",
  },
  suits: {
    hearts: "#d84b4b",
    diamonds: "#2b6dff",
    clubs: "#1f8a4c",
    spades: "#1f2329",
    joker: "#f3c648",
  },
  types: {
    number: "#1f8a4c",
    face: "#9f52e8",
    joker: "#f3c648",
  },
};

const SETTINGS_STORAGE_KEY = "cardBettingGame.settings";
const DEFAULT_SETTINGS = {
  language: "hu",
  diceTheme: "classic",
  diceMode: "random",
  feltTheme: "emerald",
  chipStyle: "classic",
  cardStyle: "cerulean",
  uiDensity: "relaxed",
  revealSpeed: "standard",
  showWinningHints: true,
  volume: 1,
  muted: false,
  stakingMode: "manual",
  autoLossPercent: 0,
  autoWinPercent: 0,
  autoStopLoss: 0,
  autoStopWin: 0,
};

const FELT_THEMES = ["emerald", "royal", "midnight"];
const CHIP_STYLES = ["classic", "striped", "neon"];
const CARD_STYLES = ["cerulean", "crimson", "graphite"];
const UI_DENSITIES = ["relaxed", "compact"];
const REVEAL_SPEEDS = ["standard", "tense"];
const FELT_THEME_CLASSES = FELT_THEMES.map((value) => `felt-theme-${value}`);
const CARD_STYLE_CLASSES = CARD_STYLES.map((value) => `card-style-${value}`);
const CHIP_STYLE_CLASSES = CHIP_STYLES.map((value) => `chip-style-${value}`);
const UI_DENSITY_CLASSES = UI_DENSITIES.map((value) => `ui-density-${value}`);
const REVEAL_SPEED_CLASSES = [
  "card--flip-standard",
  "card--flip-tense",
  "card--peel-mode",
];

const CARD_STYLE_ALIASES = {
  balatro: "cerulean",
  velvet: "crimson",
  onyx: "graphite",
};

const REVEAL_PROFILES = {
  standard: {
    startDelay: 250,
    interval: 400,
    removeDelay: 900,
    cardClasses: ["card--flip-standard"],
    animationMode: "flip",
  },
  tense: {
    startDelay: 600,
    interval: 1650,
    removeDelay: 2100,
    cardClasses: ["card--flip-tense", "card--peel-mode"],
    animationMode: "peel",
  },
};

const DICE_MODES = {
  RANDOM: "random",
  PLAYER: "player",
};

const STAKING_MODES = {
  MANUAL: "manual",
  AUTO: "auto",
};

let bankroll = 100;
let currentBetTotal = 0;
let selectedChip = null;
let currentBets = new Map();
let roundLocked = false;
let roundComplete = false;
let cardElements = [];
let lastWinningCard = null;

let cardSelectionActive = false;
let cardSelectionResolver = null;

let lastBetSnapshot = new Map();
let lastBetTotal = 0;
let autoResetTimeout = null;

const autoBetConfig = {
  lossPercent: 0,
  winPercent: 0,
  stopLoss: 0,
  stopWin: 0,
};

const autoBetRuntime = {
  sessionProfit: 0,
  pendingBets: null,
  nextTotal: 0,
  active: false,
  stopReason: null,
};

let currentStakingMode = STAKING_MODES.MANUAL;
let suppressAutoInputSync = false;

const highLowPreviousState = {
  payouts: {
    higher: PAYOUTS.high_low_previous,
    lower: PAYOUTS.high_low_previous,
  },
  tiesWin: {
    higher: false,
    lower: false,
  },
};

const audioState = {
  context: null,
  masterGain: null,
  volume: DEFAULT_SETTINGS.volume,
  muted: DEFAULT_SETTINGS.muted,
};

function loadSettings() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SETTINGS };
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings() {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return;
  }
  try {
    const payload = {
      language: settingsState?.language ?? DEFAULT_SETTINGS.language,
      diceTheme: currentDiceTheme ?? DEFAULT_SETTINGS.diceTheme,
      diceMode: currentDiceMode ?? DEFAULT_SETTINGS.diceMode,
      feltTheme: currentFeltTheme ?? DEFAULT_SETTINGS.feltTheme,
      chipStyle: currentChipStyle ?? DEFAULT_SETTINGS.chipStyle,
      cardStyle: currentCardStyle ?? DEFAULT_SETTINGS.cardStyle,
      uiDensity: currentUiDensity ?? DEFAULT_SETTINGS.uiDensity,
      revealSpeed: currentRevealSpeed ?? DEFAULT_SETTINGS.revealSpeed,
      showWinningHints:
        typeof winningHintsEnabled === "boolean"
          ? winningHintsEnabled
          : DEFAULT_SETTINGS.showWinningHints,
      volume: audioState.volume,
      muted: audioState.muted,
      stakingMode: currentStakingMode ?? DEFAULT_SETTINGS.stakingMode,
      autoLossPercent: autoBetConfig.lossPercent,
      autoWinPercent: autoBetConfig.winPercent,
      autoStopLoss: autoBetConfig.stopLoss,
      autoStopWin: autoBetConfig.stopWin,
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore storage errors (private mode, etc.)
  }
}

function updateSettings(partial) {
  settingsState = {
    ...settingsState,
    ...partial,
  };
  persistSettings();
}

const SOUND_DEFINITIONS = {
  chip: [
    {
      kind: "noise",
      duration: 0.12,
      gain: 0.35,
      filter: { type: "highpass", frequency: 1400, Q: 0.8 },
    },
    {
      kind: "tone",
      frequency: 1800,
      frequencyEnd: 1100,
      duration: 0.1,
      type: "sine",
      gain: 0.2,
      delay: 0.02,
    },
  ],
  deal: [
    {
      kind: "noise",
      duration: 0.18,
      gain: 0.28,
      filter: { type: "bandpass", frequency: 900, Q: 2.5 },
    },
    {
      kind: "tone",
      frequency: 360,
      frequencyEnd: 280,
      duration: 0.14,
      type: "triangle",
      gain: 0.18,
      delay: 0.02,
    },
  ],
  dice: [
    {
      kind: "noise",
      duration: 0.32,
      gain: 0.32,
      filter: { type: "highpass", frequency: 700, Q: 0.9 },
    },
    {
      kind: "noise",
      duration: 0.22,
      gain: 0.24,
      delay: 0.12,
      filter: { type: "bandpass", frequency: 950, Q: 3 },
    },
    {
      kind: "tone",
      frequency: 260,
      duration: 0.22,
      type: "square",
      gain: 0.16,
      delay: 0.05,
    },
  ],
  win: [
    {
      kind: "tone",
      frequency: 660,
      duration: 0.28,
      type: "triangle",
      gain: 0.22,
    },
    {
      kind: "tone",
      frequency: 880,
      duration: 0.28,
      type: "sine",
      gain: 0.2,
      delay: 0.1,
    },
    {
      kind: "tone",
      frequency: 1040,
      duration: 0.25,
      type: "sine",
      gain: 0.18,
      delay: 0.18,
    },
  ],
};

const I18N_STRINGS = {
  hu: {
    "app.title": "Bet 'Em MultiChoice",
    "app.subtitle":
      "Helyezd el a zsetonokat a kívánt mezőre, majd kattints az Osztás gombra.",
    "language.label": "Nyelv:",
    "language.ariaLabel": "Nyelv kiválasztása",
    "language.option.hu": "Magyar",
    "language.option.en": "English",
    "language.option.de": "Deutsch",
    "settings.open": "Beállítások megnyitása",
    "settings.close": "Beállítások bezárása",
    "settings.title": "Beállítások",
    "settings.section.language": "Nyelv",
    "settings.section.dice": "Dobókocka kinézete",
    "settings.section.diceMode": "Dobás módja",
    "settings.section.appearance": "Kinézet",
    "settings.section.audio": "Hangbeállítások",
    "settings.section.rules": "Szabályzat",
    "settings.dice.classic": "Klasszikus (fehér, fekete pöttyökkel)",
    "settings.dice.casino": "Kaszinó stílus (bordó, fehér pöttyökkel)",
    "settings.dice.mode.random": "Dobókocka dönt",
    "settings.dice.mode.player": "Játékos választ",
    "settings.audio.volume": "Hangerő",
    "settings.audio.mute": "Némítás",
    "settings.audio.unmute": "Hang visszakapcsolása",
    "settings.audio.mutedIndicator": "(némítva)",
    "settings.appearance.felt": "Asztal színe",
    "settings.appearance.felt.emerald": "Klasszikus zöld posztó",
    "settings.appearance.felt.royal": "Királykék posztó",
    "settings.appearance.felt.midnight": "Éjjeli ibolya posztó",
    "settings.appearance.chips": "Zseton stílusa",
    "settings.appearance.chips.classic": "Klasszikus zománc",
    "settings.appearance.chips.striped": "Csíkos Monte-Carlo",
    "settings.appearance.chips.neon": "Neon prémium",
    "settings.appearance.cards": "Kártyák stílusa",
    "settings.appearance.cards.cerulean": "Kobaltkék hátlap",
    "settings.appearance.cards.crimson": "Bíbor hátlap",
    "settings.appearance.cards.graphite": "Grafit hátlap",
    "settings.appearance.density": "UI sűrűsége",
    "settings.appearance.density.relaxed": "Tágas elrendezés",
    "settings.appearance.density.compact": "Kompakt kaszinó",
    "settings.appearance.revealSpeed": "Felfordítás sebessége",
    "settings.appearance.revealSpeed.standard": "Alap (dinamikus)",
    "settings.appearance.revealSpeed.tense":
      "Feszült mód – csak a nyertes lap lassan fordul fel",
    "settings.appearance.winningHints": "Nyerő lapok előnézete",
    "winningHints.title": "Nyerő lapok",
    "winningHints.placeholder":
      "Helyezd el a tétjeidet, hogy lásd, mely lapokkal nyerhetsz.",
    "winningHints.none":
      "A jelenlegi tétekkel egyetlen lap sem biztos kifizetés.",
    "settings.rules.content": `
      <div class="rules-guide">
        <p class="rules-guide__intro">
          A cél, hogy CHF zsetonokat helyezz el a számodra kedvező mezőkön, majd az
          osztás után kiderüljön, melyik lap vagy kombináció nyer.
        </p>
        <div class="rules-guide__steps">
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">1</span>
              <h4>Fogadás a táblán</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--bets">
                  <span class="rules-chip rules-chip--100">100</span>
                  <span class="rules-chip rules-chip--25">25</span>
                  <span class="rules-chip rules-chip--5">5</span>
                </div>
              </div>
              <p>
                Válaszd ki a zsetont, majd kattints a mezőre. Egy mezőn a zsetonok
                összeadódnak, így a teljes tétet egyetlen korong jelzi.
              </p>
            </div>
          </article>
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">2</span>
              <h4>Öt lap kiosztása</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--deal">
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                </div>
              </div>
              <p>
                Az osztáskor az öt lap lefelé érkezik, majd egymás után felfordul,
                miközben a statisztikák frissülnek.
              </p>
            </div>
          </article>
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">3</span>
              <h4>Nyertes lap kijelölése</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--decision">
                  <span class="rules-dice">⚄</span>
                  <span class="rules-pointer">⇧</span>
                </div>
              </div>
              <p>
                Alapértelmezetten a dobókocka dönti el, melyik sorszámú lap nyer (6
                esetén minden tét visszajár). Ha a beállításokban a játékos választ,
                kattints a kívánt lapra – a kiválasztott lap kissé megemelkedik, és
                nincs push lehetőség.
              </p>
            </div>
          </article>
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">4</span>
              <h4>Kifizetés és előzmények</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--payout">
                  <span class="rules-payout">+120 CHF</span>
                </div>
              </div>
              <p>
                A nyertes mezők arany színnel jelennek meg, a CHF nyeremény
                jóváírása a dobás/kiválasztás után történik, majd a kör bekerül az
                előzmények közé.
              </p>
            </div>
          </article>
        </div>
        <div class="rules-guide__summary">
          <h4>Fő fogadási lehetőségek</h4>
          <ul>
            <li>Szín, szimbólum, szám vagy figura.</li>
            <li>7 felett/alatt, előző nyerteshez viszonyított oddsok.</li>
            <li>Konkrét lapértékek (2–A) és Joker.</li>
            <li>Teljes pókerlétra: pártól royal flushig.</li>
          </ul>
        </div>
      </div>
    `,
    "bankroll.balance": "Egyenleg (CHF):",
    "bankroll.bet": "Aktuális tét (CHF):",
    "chips.ariaLabel": "Zsetonválasztó",
    "stats.title": "Statisztikák",
    "stats.open": "Statisztikák megnyitása",
    "stats.close": "Statisztikák bezárása",
    "stats.totalRounds": "Összes kör",
    "stats.topColor": "Leggyakoribb szín",
    "stats.topSuit": "Leggyakoribb szimbólum",
    "stats.topRank": "Leggyakoribb rang",
    "stats.colorDistribution": "Színeloszlás",
    "stats.suitDistribution": "Szimbólumok",
    "stats.typeDistribution": "Kártyatípus",
    "stats.chart.colors": "Színeloszlás diagram",
    "stats.chart.suits": "Szimbólum szerinti megoszlás",
    "stats.chart.types": "Kártyatípus szerinti megoszlás",
    "stats.rankDistribution": "Rangok",
    "stats.colors.red": "Piros",
    "stats.colors.black": "Fekete",
    "stats.colors.joker": "Joker",
    "stats.suits.hearts": "♥ Hearts",
    "stats.suits.diamonds": "♦ Diamonds",
    "stats.suits.clubs": "♣ Clubs",
    "stats.suits.spades": "♠ Spades",
    "stats.suits.joker": "★ Joker",
    "stats.types.number": "Szám (2-10)",
    "stats.types.face": "Figura (J-A)",
    "stats.types.joker": "Joker",
    "stats.none": "-",
    "stats.shared": "Megosztott ({{items}})",
    "table.ariaLabel": "Fogadóasztal",
    "actions.clearAll": "Összes tét törlése",
    "actions.repeatBet": "Előző tét ismétlése",
    "actions.doubleBet": "Tét duplázása",
    "actions.deal": "Osztás",
    "actions.dealing": "Kör folyamatban…",
    "actions.next": "Következő kör",
    "actions.clearSpot": "Tét törlése",
    "staking.title": "Tétkezelés",
    "staking.mode.manual": "Kézi mód",
    "staking.mode.auto": "Automatikus mód",
    "staking.status.manual": "Kézi tétkezelés aktív.",
    "staking.status.autoIdle":
      "Automatikus mód: a jelenlegi tét lesz az alap a következő körben.",
    "staking.status.autoApplied":
      "Automatikus mód: aktív tét {{amount}} összegben.",
    "staking.status.autoNext":
      "Automatikus mód: következő tét {{amount}} értékben készen áll.",
    "staking.status.autoStoppedLoss":
      "Stop-loss elérve, az automatikus mód szünetel.",
    "staking.status.autoStoppedWin":
      "Stop-win elérve, az automatikus mód szünetel.",
    "staking.status.autoStoppedBankroll":
      "Nincs elegendő egyenleg az automatikus tét folytatásához.",
    "staking.lossPercent.label": "Veszteség utáni módosítás (%)",
    "staking.lossPercent.placeholder": "pl. 50",
    "staking.lossPercent.hint":
      "Pozitív érték növeli, negatív csökkenti a tétet.",
    "staking.winPercent.label": "Nyereség utáni módosítás (%)",
    "staking.winPercent.placeholder": "pl. -25",
    "staking.winPercent.hint":
      "Pozitív érték növeli, negatív csökkenti a tétet.",
    "staking.stopLoss.label": "Stop-loss (CHF)",
    "staking.stopWin.label": "Stop-win (CHF)",
    "staking.stop.placeholder": "0 = kikapcsolva",
    "staking.note": "Az automatikus mód a jelenlegi tételosztást használja alapnak.",
    "bets.groups.color": "Szín",
    "bets.groups.suit": "Szimbólum",
    "bets.groups.cardType": "Kártyatípus",
    "bets.groups.highLow": "Magasabb vagy alacsonyabb",
    "bets.groups.rankExact": "Konkrét lapérték",
    "bets.groups.poker": "Póker kombinációk",
    "bets.groups.joker": "Joker",
    "bets.options.color.red.label": "Piros",
    "bets.options.color.black.label": "Fekete",
    "bets.options.suit.hearts.label": "♥",
    "bets.options.suit.diamonds.label": "♦",
    "bets.options.suit.clubs.label": "♣",
    "bets.options.suit.spades.label": "♠",
    "bets.options.number.number.label": "Szám (2-10)",
    "bets.options.face.face.label": "Betű (J-A)",
    "bets.options.high_low_seven.higher.label": "7-nél magasabb",
    "bets.options.high_low_seven.lower.label": "7-nél alacsonyabb",
    "bets.options.high_low_previous.higher.label": "Előzőnél magasabb",
    "bets.options.high_low_previous.lower.label": "Előzőnél alacsonyabb",
    "bets.rankExact.2": "2-es",
    "bets.rankExact.3": "3-as",
    "bets.rankExact.4": "4-es",
    "bets.rankExact.5": "5-ös",
    "bets.rankExact.6": "6-os",
    "bets.rankExact.7": "7-es",
    "bets.rankExact.8": "8-as",
    "bets.rankExact.9": "9-es",
    "bets.rankExact.10": "10-es",
    "bets.rankExact.J": "J",
    "bets.rankExact.Q": "Q",
    "bets.rankExact.K": "K",
    "bets.rankExact.A": "A",
    "bets.options.pair.pair.label": "Pár",
    "bets.options.two_pair.two_pair.label": "Két pár",
    "bets.options.straight_flush.straight_flush.label": "Színsor",
    "bets.options.royal_flush.royal_flush.label": "Royal Flush",
    "bets.options.drill.drill.label": "Drill",
    "bets.options.straight.straight.label": "Sor",
    "bets.options.flush.flush.label": "Flush",
    "bets.options.full_house.full_house.label": "Full House",
    "bets.options.poker.poker.label": "Póker",
    "bets.options.joker.joker.label": "Joker",
    "bets.describe.color.red": "Piros",
    "bets.describe.color.black": "Fekete",
    "bets.describe.suit.hearts": "Hearts",
    "bets.describe.suit.diamonds": "Diamonds",
    "bets.describe.suit.clubs": "Clubs",
    "bets.describe.suit.spades": "Spades",
    "bets.describe.number.number": "Szám (2-10)",
    "bets.describe.face.face": "Betű (J-A)",
    "bets.describe.high_low_seven.higher": "7-nél magasabb",
    "bets.describe.high_low_seven.lower": "7-nél alacsonyabb",
    "bets.describe.high_low_previous.higher": "Előzőnél magasabb",
    "bets.describe.high_low_previous.lower": "Előzőnél alacsonyabb",
    "bets.describe.rank_exact": "Lap érték: {{label}}",
    "bets.describe.pair.pair": "Pár",
    "bets.describe.two_pair.two_pair": "Két pár",
    "bets.describe.straight_flush.straight_flush": "Színsor",
    "bets.describe.royal_flush.royal_flush": "Royal Flush",
    "bets.describe.drill.drill": "Drill",
    "bets.describe.straight.straight": "Sor",
    "bets.describe.flush.flush": "Flush",
    "bets.describe.full_house.full_house": "Full House",
    "bets.describe.poker.poker": "Póker",
    "bets.describe.joker.joker": "Joker",
    "results.cardsTitle": "Felfordított lapok",
    "results.diceTitle": "Dobás / választás",
    "results.betOutcomeTitle": "Tétek eredményei",
    "results.betOutcomePlaceholder":
      "A kör végén itt láthatod a tétek eredményeit.",
    "results.logTitle": "Eredmények",
    "results.summary.cardLabel": "Nyerő lap",
    "results.summary.handLabel": "Póker kombináció",
    "results.summary.outcomeLabel": "Kör eredménye",
    "results.summary.cardPending": "Várakozás…",
    "results.summary.cardNone": "—",
    "results.summary.cardPush": "Dobás: 6 – push",
    "results.summary.handPending": "Várakozás…",
    "results.summary.handNone": "Nincs kombináció",
    "results.summary.outcome.pending": "Várakozás…",
    "results.summary.outcome.win": "Nyert",
    "results.summary.outcome.loss": "Vesztett",
    "results.summary.outcome.push": "Push",
    "results.summary.outcome.breakEven": "Egyenleg változatlan",
    "history.title": "Előző körök",
    "history.subtitle": "Mind az öt lap és a dobás eredménye",
    "history.empty": "Még nincs előzmény.",
    "history.summary.winsTitle": "Nyertes tétek",
    "history.summary.noWins": "Nem volt nyertes tét.",
    "history.open": "Előzmények megnyitása",
    "history.modalTitle": "Teljes előzmények",
    "history.close": "Előzmények bezárása",
    "dice.waiting": "Várakozás a dobásra vagy választásra…",
    "dice.playerIdle": "Várakozás a döntésre…",
    "dice.playerPrompt": "Válassz egy lapot!",
    "dice.playerResult": "A választott lap: #{{value}}",
    "dice.inProgress": "Dobás folyamatban…",
    "dice.result": "Dobás eredménye: {{value}}",
    "dice.pushResult": "Dobás: 6 – minden tét visszajár.",
    "dice.ariaLabel": "Dobókocka",
    "banner.win.title": "Ön nyert!",
    "betBreakdown.winDetail":
      "Kifizetés: {{payout}} • Nyereség: {{profit}} (tét: {{amount}})",
    "betBreakdown.pushDetail": "Tét vissza (CHF): {{amount}}.",
    "betBreakdown.lossDetail": "Elveszett tét (frank): {{amount}}.",
    "betBreakdown.noBets": "Nem volt tét ebben a körben.",
    "betBreakdown.pushAll": "Dobás: 6 – minden tét visszajár.",
    "round.inProgress": "Kör folyamatban…",
    "messages.selectChip": "Válassz zsetont a tét elhelyezéséhez.",
    "messages.insufficientFunds":
      "Nincs elegendő egyenleg a kiválasztott zsetonhoz.",
    "messages.betRequired": "Tét nélkül nem indulhat a kör.",
    "messages.betTooLarge": "A tét nagyobb, mint a rendelkezésre álló egyenleg.",
    "messages.noPreviousBet": "Nincs korábbi tét, amit ismételhetnél.",
    "messages.rebetInsufficient":
      "Legalább {{amount}} szükséges az előző tétek újbóli felrakásához.",
    "messages.doubleUnavailable":
      "Előbb helyezz el téteket, hogy duplázhasd őket.",
    "messages.doubleInsufficient":
      "Legalább {{amount}} szükséges a duplázáshoz.",
    "messages.autoStopLoss":
      "Stop-loss elérve {{amount}} értéken. Az automatikus mód leállt.",
    "messages.autoStopWin":
      "Stop-win elérve {{amount}} értéken. Az automatikus mód leállt.",
    "messages.autoZeroBet":
      "Az automatikus mód nem tudott új tétet meghatározni.",
    "messages.autoInsufficient":
      "Az automatikus folytatáshoz {{amount}} lenne szükséges.",
    "logs.rollSix": "Dobás: 6 – minden tét visszajár.",
    "logs.roll": "Dobás: {{value}}.",
    "logs.playerChoice": "Játékos a #{{position}} lapot választotta.",
    "logs.winningCard": "Nyerő lap: #{{position}} – {{card}}.",
    "logs.betWin": "✔ {{label}} nyert! Kifizetés: {{payout}} (nyereség: {{profit}}).",
    "logs.betPush": "↺ {{label}} push. A tét visszajár.",
    "logs.betLoss": "✖ {{label}} veszített.",
    "cards.joker": "Joker",
    "diceHistory.rollSix": "Dobás: 6 – minden tét visszajár.",
    "diceHistory.roll": "Dobás: {{value}}",
    "diceHistory.playerChoice": "Választás: #{{value}}",
    "ranks.display.Joker": "Joker",
  },
  en: {
    "app.title": "Bet 'Em MultiChoice",
    "app.subtitle": "Place your chips on the table, then press the Deal button.",
    "language.label": "Language:",
    "language.ariaLabel": "Select language",
    "language.option.hu": "Magyar",
    "language.option.en": "English",
    "language.option.de": "Deutsch",
    "settings.open": "Open settings",
    "settings.close": "Close settings",
    "settings.title": "Settings",
    "settings.section.language": "Language",
    "settings.section.dice": "Dice appearance",
    "settings.section.diceMode": "Dice mode",
    "settings.section.appearance": "Appearance",
    "settings.section.audio": "Audio settings",
    "settings.section.rules": "Rulebook",
    "settings.dice.classic": "Classic (white with black pips)",
    "settings.dice.casino": "Casino style (deep red with white pips)",
    "settings.dice.mode.random": "Dice decides",
    "settings.dice.mode.player": "Player chooses",
    "settings.audio.volume": "Volume",
    "settings.audio.mute": "Mute",
    "settings.audio.unmute": "Unmute",
    "settings.audio.mutedIndicator": "(muted)",
    "settings.appearance.felt": "Table felt",
    "settings.appearance.felt.emerald": "Classic emerald felt",
    "settings.appearance.felt.royal": "Royal blue felt",
    "settings.appearance.felt.midnight": "Midnight violet felt",
    "settings.appearance.chips": "Chip finish",
    "settings.appearance.chips.classic": "Classic enamel",
    "settings.appearance.chips.striped": "Striped Monte Carlo",
    "settings.appearance.chips.neon": "Neon premium",
    "settings.appearance.cards": "Card style",
    "settings.appearance.cards.cerulean": "Cerulean back",
    "settings.appearance.cards.crimson": "Crimson back",
    "settings.appearance.cards.graphite": "Graphite back",
    "settings.appearance.density": "UI density",
    "settings.appearance.density.relaxed": "Roomy layout",
    "settings.appearance.density.compact": "Compact casino",
    "settings.appearance.revealSpeed": "Reveal speed",
    "settings.appearance.revealSpeed.standard": "Standard (snappy)",
    "settings.appearance.revealSpeed.tense":
      "Tense mode – only the winning card peels slowly",
    "settings.appearance.winningHints": "Show winning-card preview",
    "winningHints.title": "Winning cards",
    "winningHints.placeholder":
      "Place your bets to discover which cards will pay.",
    "winningHints.none": "No guaranteed payouts with the current bets.",
    "settings.rules.content": `
      <div class="rules-guide">
        <p class="rules-guide__intro">
          Place CHF chips on the spots you believe will win; after the reveal the
          highlighted card or combo pays according to the odds.
        </p>
        <div class="rules-guide__steps">
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">1</span>
              <h4>Lay your bets</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--bets">
                  <span class="rules-chip rules-chip--100">100</span>
                  <span class="rules-chip rules-chip--25">25</span>
                  <span class="rules-chip rules-chip--5">5</span>
                </div>
              </div>
              <p>
                Pick a chip, click a spot, and stack values freely. The bet display
                always shows the combined CHF amount on that field.
              </p>
            </div>
          </article>
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">2</span>
              <h4>Five-card deal</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--deal">
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                </div>
              </div>
              <p>
                Cards arrive face-down and flip one-by-one, with the statistics panel
                updating after every round.
              </p>
            </div>
          </article>
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">3</span>
              <h4>Decide the winner</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--decision">
                  <span class="rules-dice">⚄</span>
                  <span class="rules-pointer">⇧</span>
                </div>
              </div>
              <p>
                In random mode the die selects card 1–5 (a six returns every bet).
                Switch to player mode to click a favourite card instead—your choice
                lifts slightly and there is no push result.
              </p>
            </div>
          </article>
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">4</span>
              <h4>Payout and history</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--payout">
                  <span class="rules-payout">+120 CHF</span>
                </div>
              </div>
              <p>
                Winning spots glow gold. CHF winnings settle after the roll or
                selection and the round is archived underneath the dice display.
              </p>
            </div>
          </article>
        </div>
        <div class="rules-guide__summary">
          <h4>Core betting menu</h4>
          <ul>
            <li>Colour, suit, number or face cards.</li>
            <li>High/low versus 7 and dynamic odds versus the previous winner.</li>
            <li>Exact ranks (2–A) plus the Joker bet.</li>
            <li>Full poker ladder from pair through royal flush.</li>
          </ul>
        </div>
      </div>
    `,
    "bankroll.balance": "Balance (CHF):",
    "bankroll.bet": "Current bet (CHF):",
    "chips.ariaLabel": "Chip selector",
    "stats.title": "Statistics",
    "stats.open": "Open statistics",
    "stats.close": "Close statistics",
    "stats.totalRounds": "Total rounds",
    "stats.topColor": "Most common color",
    "stats.topSuit": "Most common suit",
    "stats.topRank": "Most common rank",
    "stats.colorDistribution": "Color distribution",
    "stats.suitDistribution": "Suits",
    "stats.typeDistribution": "Card type",
    "stats.chart.colors": "Color distribution chart",
    "stats.chart.suits": "Suit distribution chart",
    "stats.chart.types": "Card type distribution chart",
    "stats.rankDistribution": "Ranks",
    "stats.colors.red": "Red",
    "stats.colors.black": "Black",
    "stats.colors.joker": "Joker",
    "stats.suits.hearts": "♥ Hearts",
    "stats.suits.diamonds": "♦ Diamonds",
    "stats.suits.clubs": "♣ Clubs",
    "stats.suits.spades": "♠ Spades",
    "stats.suits.joker": "★ Joker",
    "stats.types.number": "Number (2-10)",
    "stats.types.face": "Face (J-A)",
    "stats.types.joker": "Joker",
    "stats.none": "-",
    "stats.shared": "Split ({{items}})",
    "table.ariaLabel": "Betting table",
    "actions.clearAll": "Clear all bets",
    "actions.repeatBet": "Repeat previous bet",
    "actions.doubleBet": "Double bet",
    "actions.deal": "Deal",
    "actions.dealing": "Round in progress…",
    "actions.next": "Next round",
    "actions.clearSpot": "Remove bet",
    "staking.title": "Bet management",
    "staking.mode.manual": "Manual mode",
    "staking.mode.auto": "Automatic mode",
    "staking.status.manual": "Manual staking is active.",
    "staking.status.autoIdle":
      "Automatic mode: the current wagers will be reused as the base.",
    "staking.status.autoApplied":
      "Automatic mode ready with active stake of {{amount}}.",
    "staking.status.autoNext": "Automatic mode queued: next stake {{amount}}.",
    "staking.status.autoStoppedLoss":
      "Stop-loss reached, automatic mode paused.",
    "staking.status.autoStoppedWin": "Stop-win reached, automatic mode paused.",
    "staking.status.autoStoppedBankroll":
      "Insufficient balance to continue automatic stakes.",
    "staking.lossPercent.label": "Change after a loss (%)",
    "staking.lossPercent.placeholder": "e.g. 50",
    "staking.lossPercent.hint":
      "Positive values increase, negative values reduce the total stake.",
    "staking.winPercent.label": "Change after a win (%)",
    "staking.winPercent.placeholder": "e.g. -25",
    "staking.winPercent.hint":
      "Positive values increase, negative values reduce the total stake.",
    "staking.stopLoss.label": "Stop-loss (CHF)",
    "staking.stopWin.label": "Stop-win (CHF)",
    "staking.stop.placeholder": "0 = disabled",
    "staking.note":
      "Automatic mode uses your current wager distribution as the base.",
    "bets.groups.color": "Color",
    "bets.groups.suit": "Suit",
    "bets.groups.cardType": "Card type",
    "bets.groups.highLow": "Higher or lower",
    "bets.groups.rankExact": "Exact card value",
    "bets.groups.poker": "Poker combinations",
    "bets.groups.joker": "Joker",
    "bets.options.color.red.label": "Red",
    "bets.options.color.black.label": "Black",
    "bets.options.suit.hearts.label": "♥",
    "bets.options.suit.diamonds.label": "♦",
    "bets.options.suit.clubs.label": "♣",
    "bets.options.suit.spades.label": "♠",
    "bets.options.number.number.label": "Number (2-10)",
    "bets.options.face.face.label": "Face (J-A)",
    "bets.options.high_low_seven.higher.label": "Higher than 7",
    "bets.options.high_low_seven.lower.label": "Lower than 7",
    "bets.options.high_low_previous.higher.label": "Higher than previous",
    "bets.options.high_low_previous.lower.label": "Lower than previous",
    "bets.rankExact.2": "2",
    "bets.rankExact.3": "3",
    "bets.rankExact.4": "4",
    "bets.rankExact.5": "5",
    "bets.rankExact.6": "6",
    "bets.rankExact.7": "7",
    "bets.rankExact.8": "8",
    "bets.rankExact.9": "9",
    "bets.rankExact.10": "10",
    "bets.rankExact.J": "J",
    "bets.rankExact.Q": "Q",
    "bets.rankExact.K": "K",
    "bets.rankExact.A": "A",
    "bets.options.pair.pair.label": "Pair",
    "bets.options.two_pair.two_pair.label": "Two pair",
    "bets.options.straight_flush.straight_flush.label": "Straight flush",
    "bets.options.royal_flush.royal_flush.label": "Royal flush",
    "bets.options.drill.drill.label": "Three of a kind",
    "bets.options.straight.straight.label": "Straight",
    "bets.options.flush.flush.label": "Flush",
    "bets.options.full_house.full_house.label": "Full house",
    "bets.options.poker.poker.label": "Four of a kind",
    "bets.options.joker.joker.label": "Joker",
    "bets.describe.color.red": "Red",
    "bets.describe.color.black": "Black",
    "bets.describe.suit.hearts": "Hearts",
    "bets.describe.suit.diamonds": "Diamonds",
    "bets.describe.suit.clubs": "Clubs",
    "bets.describe.suit.spades": "Spades",
    "bets.describe.number.number": "Number (2-10)",
    "bets.describe.face.face": "Face (J-A)",
    "bets.describe.high_low_seven.higher": "Higher than 7",
    "bets.describe.high_low_seven.lower": "Lower than 7",
    "bets.describe.high_low_previous.higher":
      "Higher than the previous card",
    "bets.describe.high_low_previous.lower":
      "Lower than the previous card",
    "bets.describe.rank_exact": "Exact rank: {{label}}",
    "bets.describe.pair.pair": "Pair",
    "bets.describe.two_pair.two_pair": "Two pair",
    "bets.describe.straight_flush.straight_flush": "Straight flush",
    "bets.describe.royal_flush.royal_flush": "Royal flush",
    "bets.describe.drill.drill": "Three of a kind",
    "bets.describe.straight.straight": "Straight",
    "bets.describe.flush.flush": "Flush",
    "bets.describe.full_house.full_house": "Full house",
    "bets.describe.poker.poker": "Four of a kind",
    "bets.describe.joker.joker": "Joker",
    "results.cardsTitle": "Revealed cards",
    "results.diceTitle": "Roll / selection",
    "results.betOutcomeTitle": "Bet results",
    "results.betOutcomePlaceholder":
      "Bet outcomes will appear here at the end of the round.",
    "results.logTitle": "Game log",
    "results.summary.cardLabel": "Winning card",
    "results.summary.handLabel": "Poker hand",
    "results.summary.outcomeLabel": "Round result",
    "results.summary.cardPending": "Waiting…",
    "results.summary.cardNone": "—",
    "results.summary.cardPush": "Roll: 6 – push",
    "results.summary.handPending": "Waiting…",
    "results.summary.handNone": "No combination",
    "results.summary.outcome.pending": "Waiting…",
    "results.summary.outcome.win": "Won",
    "results.summary.outcome.loss": "Lost",
    "results.summary.outcome.push": "Push",
    "results.summary.outcome.breakEven": "Balance unchanged",
    "history.title": "Previous rounds",
    "history.subtitle": "All five cards and the dice result",
    "history.empty": "No history yet.",
    "history.summary.winsTitle": "Winning bets",
    "history.summary.noWins": "No winning bets.",
    "history.open": "Open history",
    "history.modalTitle": "Full history",
    "history.close": "Close history",
    "dice.waiting": "Waiting for the roll or selection…",
    "dice.playerIdle": "Awaiting a choice…",
    "dice.playerPrompt": "Pick a card!",
    "dice.playerResult": "You picked card #{{value}}",
    "dice.inProgress": "Rolling the dice…",
    "dice.result": "Roll result: {{value}}",
    "dice.pushResult": "Roll: 6 – all bets are returned.",
    "dice.ariaLabel": "Dice",
    "banner.win.title": "You won!",
    "betBreakdown.winDetail":
      "Payout: {{payout}} (profit: {{profit}}, bet: {{amount}})",
    "betBreakdown.pushDetail": "Bet returned: {{amount}}.",
    "betBreakdown.lossDetail": "Lost bet (francs): {{amount}}.",
    "betBreakdown.noBets": "No bets were placed this round.",
    "betBreakdown.pushAll": "Roll: 6 – all bets are returned.",
    "round.inProgress": "Round in progress…",
    "messages.selectChip": "Choose a chip before placing a bet.",
    "messages.insufficientFunds": "Not enough balance for that chip.",
    "messages.betRequired": "Place at least one bet to start the round.",
    "messages.betTooLarge": "The total bet exceeds your available balance.",
    "messages.noPreviousBet": "There's no previous wager to repeat.",
    "messages.rebetInsufficient":
      "You'll need {{amount}} available to repeat that wager.",
    "messages.doubleUnavailable": "Place a bet before trying to double it.",
    "messages.doubleInsufficient":
      "You'll need {{amount}} to double that wager.",
    "messages.autoStopLoss":
      "Stop-loss reached at {{amount}}. Automatic mode halted.",
    "messages.autoStopWin":
      "Stop-win reached at {{amount}}. Automatic mode halted.",
    "messages.autoZeroBet":
      "Automatic mode could not determine a valid next stake.",
    "messages.autoInsufficient":
      "Automatic mode needs {{amount}} to continue.",
    "logs.rollSix": "Roll: 6 – all bets are returned.",
    "logs.roll": "Roll: {{value}}.",
    "logs.playerChoice": "Player picked card #{{position}}.",
    "logs.winningCard": "Winning card: #{{position}} – {{card}}.",
    "logs.betWin": "✔ {{label}} won! Payout: {{payout}} (profit: {{profit}}).",
    "logs.betPush": "↺ {{label}} push. Bet returned.",
    "logs.betLoss": "✖ {{label}} lost.",
    "cards.joker": "Joker",
    "diceHistory.rollSix": "Roll: 6 – all bets are returned.",
    "diceHistory.roll": "Roll: {{value}}",
    "diceHistory.playerChoice": "Selection: #{{value}}",
    "ranks.display.Joker": "Joker",
  },
  de: {
    "app.title": "Bet 'Em MultiChoice",
    "app.subtitle": "Platziere deine Jetons auf dem Tisch und klicke auf Geben.",
    "language.label": "Sprache:",
    "language.ariaLabel": "Sprache auswählen",
    "language.option.hu": "Magyar",
    "language.option.en": "English",
    "language.option.de": "Deutsch",
    "settings.open": "Einstellungen öffnen",
    "settings.close": "Einstellungen schließen",
    "settings.title": "Einstellungen",
    "settings.section.language": "Sprache",
    "settings.section.dice": "Würfel-Optik",
    "settings.section.diceMode": "Wurfmodus",
    "settings.section.appearance": "Erscheinungsbild",
    "settings.section.audio": "Audioeinstellungen",
    "settings.section.rules": "Spielregeln",
    "settings.dice.classic": "Klassisch (weiß mit schwarzen Punkten)",
    "settings.dice.casino": "Casino-Stil (bordeaux mit weißen Punkten)",
    "settings.dice.mode.random": "Würfel entscheidet",
    "settings.dice.mode.player": "Spieler wählt",
    "settings.audio.volume": "Lautstärke",
    "settings.audio.mute": "Stummschalten",
    "settings.audio.unmute": "Stummschaltung aufheben",
    "settings.audio.mutedIndicator": "(stumm)",
    "settings.appearance.felt": "Tischfilz",
    "settings.appearance.felt.emerald": "Klassisches Smaragdgrün",
    "settings.appearance.felt.royal": "Königsblauer Filz",
    "settings.appearance.felt.midnight": "Mitternachtsviolett",
    "settings.appearance.chips": "Jeton-Stil",
    "settings.appearance.chips.classic": "Klassischer Emaille-Look",
    "settings.appearance.chips.striped": "Gestreiftes Monte Carlo",
    "settings.appearance.chips.neon": "Neon-Premium",
    "settings.appearance.cards": "Kartendesign",
    "settings.appearance.cards.cerulean": "Azurblauer Rücken",
    "settings.appearance.cards.crimson": "Purpurroter Rücken",
    "settings.appearance.cards.graphite": "Graphitfarbener Rücken",
    "settings.appearance.density": "UI-Dichte",
    "settings.appearance.density.relaxed": "Großzügiges Layout",
    "settings.appearance.density.compact": "Kompakter Casino-Stil",
    "settings.appearance.revealSpeed": "Aufdeck-Geschwindigkeit",
    "settings.appearance.revealSpeed.standard": "Standard (flott)",
    "settings.appearance.revealSpeed.tense":
      "Spannender Modus – nur die Gewinnkarte deckt sich langsam auf",
    "settings.appearance.winningHints": "Gewinnkarten-Vorschau anzeigen",
    "winningHints.title": "Gewinnkarten",
    "winningHints.placeholder":
      "Setze Einsätze, um zu sehen, welche Karten auszahlen.",
    "winningHints.none":
      "Mit den aktuellen Einsätzen gibt es keine garantierten Auszahlungen.",
    "settings.rules.content": `
      <div class="rules-guide">
        <p class="rules-guide__intro">
          Setze CHF-Chips auf deine Favoriten. Nach dem Aufdecken zahlt die
          hervorgehobene Karte oder Kombination gemäß den angezeigten Quoten.
        </p>
        <div class="rules-guide__steps">
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">1</span>
              <h4>Einsätze platzieren</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--bets">
                  <span class="rules-chip rules-chip--100">100</span>
                  <span class="rules-chip rules-chip--25">25</span>
                  <span class="rules-chip rules-chip--5">5</span>
                </div>
              </div>
              <p>
                Chip auswählen, auf das Feld klicken, beliebig stapeln. Auf jedem
                Feld erscheint eine Zusammenfassung der gesamten CHF-Einlage.
              </p>
            </div>
          </article>
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">2</span>
              <h4>Fünf Karten geben</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--deal">
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                  <span class="rules-card">?</span>
                </div>
              </div>
              <p>
                Die Karten erscheinen verdeckt und drehen sich nacheinander um,
                während die Statistik sich nach jedem Durchgang aktualisiert.
              </p>
            </div>
          </article>
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">3</span>
              <h4>Gewinnkarte bestimmen</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--decision">
                  <span class="rules-dice">⚄</span>
                  <span class="rules-pointer">⇧</span>
                </div>
              </div>
              <p>
                Im Zufallsmodus legt der Würfel Karte 1–5 fest (bei einer 6 gibt es
                alle Einsätze zurück). Im Spielermodus klickst du selbst eine Karte –
                sie hebt sich leicht an und es gibt keinen Push.
              </p>
            </div>
          </article>
          <article class="rules-step">
            <header class="rules-step__header">
              <span class="rules-step__badge">4</span>
              <h4>Auszahlung &amp; Historie</h4>
            </header>
            <div class="rules-step__body">
              <div class="rules-step__media">
                <div class="rules-art rules-art--payout">
                  <span class="rules-payout">+120 CHF</span>
                </div>
              </div>
              <p>
                Gewinnfelder leuchten golden. Gewinne in CHF werden nach dem Wurf
                bzw. der Auswahl gutgeschrieben, anschließend erscheint die Runde im
                Verlauf.
              </p>
            </div>
          </article>
        </div>
        <div class="rules-guide__summary">
          <h4>Wichtige Wettoptionen</h4>
          <ul>
            <li>Farbe, Symbol, Zahlen oder Bilder.</li>
            <li>Höher/Tiefer als 7 und dynamische Quoten vs. vorheriger Gewinner.</li>
            <li>Exakte Ränge (2–A) sowie Joker.</li>
            <li>Komplette Pokerleiter von Paar bis Royal Flush.</li>
          </ul>
        </div>
      </div>
    `,
    "bankroll.balance": "Guthaben (CHF):",
    "bankroll.bet": "Aktueller Einsatz (CHF):",
    "chips.ariaLabel": "Jetonauswahl",
    "stats.title": "Statistiken",
    "stats.open": "Statistiken öffnen",
    "stats.close": "Statistiken schließen",
    "stats.totalRounds": "Gesamtanzahl Runden",
    "stats.topColor": "Häufigste Farbe",
    "stats.topSuit": "Häufigstes Symbol",
    "stats.topRank": "Häufigster Rang",
    "stats.colorDistribution": "Farbenverteilung",
    "stats.suitDistribution": "Symbole",
    "stats.typeDistribution": "Kartentyp",
    "stats.chart.colors": "Diagramm der Farbenverteilung",
    "stats.chart.suits": "Diagramm der Symbolverteilung",
    "stats.chart.types": "Diagramm der Kartentypen",
    "stats.rankDistribution": "Ränge",
    "stats.colors.red": "Rot",
    "stats.colors.black": "Schwarz",
    "stats.colors.joker": "Joker",
    "stats.suits.hearts": "♥ Herzen",
    "stats.suits.diamonds": "♦ Karo",
    "stats.suits.clubs": "♣ Kreuz",
    "stats.suits.spades": "♠ Pik",
    "stats.suits.joker": "★ Joker",
    "stats.types.number": "Zahl (2-10)",
    "stats.types.face": "Bildkarte (J-A)",
    "stats.types.joker": "Joker",
    "stats.none": "-",
    "stats.shared": "Geteilt ({{items}})",
    "table.ariaLabel": "Spieltableau",
    "actions.clearAll": "Alle Einsätze löschen",
    "actions.repeatBet": "Vorherigen Einsatz wiederholen",
    "actions.doubleBet": "Einsatz verdoppeln",
    "actions.deal": "Geben",
    "actions.dealing": "Runde läuft…",
    "actions.next": "Nächste Runde",
    "actions.clearSpot": "Einsatz entfernen",
    "staking.title": "Einsatzverwaltung",
    "staking.mode.manual": "Manueller Modus",
    "staking.mode.auto": "Automatischer Modus",
    "staking.status.manual": "Manuelle Einsatzverwaltung ist aktiv.",
    "staking.status.autoIdle":
      "Automatikmodus: Die aktuellen Einsätze dienen als Grundlage.",
    "staking.status.autoApplied":
      "Automatikmodus bereit mit Einsatz über {{amount}}.",
    "staking.status.autoNext": "Automatikmodus wartet mit nächstem Einsatz {{amount}}.",
    "staking.status.autoStoppedLoss":
      "Stop-Loss erreicht, Automatikmodus pausiert.",
    "staking.status.autoStoppedWin": "Stop-Win erreicht, Automatikmodus pausiert.",
    "staking.status.autoStoppedBankroll":
      "Nicht genügend Guthaben für den Automatikmodus.",
    "staking.lossPercent.label": "Änderung nach Verlust (%)",
    "staking.lossPercent.placeholder": "z. B. 50",
    "staking.lossPercent.hint":
      "Positive Werte erhöhen, negative verringern den Gesamteinsatz.",
    "staking.winPercent.label": "Änderung nach Gewinn (%)",
    "staking.winPercent.placeholder": "z. B. -25",
    "staking.winPercent.hint":
      "Positive Werte erhöhen, negative verringern den Gesamteinsatz.",
    "staking.stopLoss.label": "Stop-Loss (CHF)",
    "staking.stopWin.label": "Stop-Win (CHF)",
    "staking.stop.placeholder": "0 = deaktiviert",
    "staking.note":
      "Der Automatikmodus verwendet die aktuelle Einsatzverteilung als Basis.",
    "bets.groups.color": "Farbe",
    "bets.groups.suit": "Symbol",
    "bets.groups.cardType": "Kartentyp",
    "bets.groups.highLow": "Höher oder niedriger",
    "bets.groups.rankExact": "Exakter Kartenwert",
    "bets.groups.poker": "Poker-Kombinationen",
    "bets.groups.joker": "Joker",
    "bets.options.color.red.label": "Rot",
    "bets.options.color.black.label": "Schwarz",
    "bets.options.suit.hearts.label": "♥",
    "bets.options.suit.diamonds.label": "♦",
    "bets.options.suit.clubs.label": "♣",
    "bets.options.suit.spades.label": "♠",
    "bets.options.number.number.label": "Zahl (2-10)",
    "bets.options.face.face.label": "Bildkarte (J-A)",
    "bets.options.high_low_seven.higher.label": "Höher als 7",
    "bets.options.high_low_seven.lower.label": "Niedriger als 7",
    "bets.options.high_low_previous.higher.label": "Höher als vorherige",
    "bets.options.high_low_previous.lower.label": "Niedriger als vorherige",
    "bets.rankExact.2": "2",
    "bets.rankExact.3": "3",
    "bets.rankExact.4": "4",
    "bets.rankExact.5": "5",
    "bets.rankExact.6": "6",
    "bets.rankExact.7": "7",
    "bets.rankExact.8": "8",
    "bets.rankExact.9": "9",
    "bets.rankExact.10": "10",
    "bets.rankExact.J": "J",
    "bets.rankExact.Q": "Q",
    "bets.rankExact.K": "K",
    "bets.rankExact.A": "A",
    "bets.options.pair.pair.label": "Paar",
    "bets.options.two_pair.two_pair.label": "Zwei Paare",
    "bets.options.straight_flush.straight_flush.label": "Straight Flush",
    "bets.options.royal_flush.royal_flush.label": "Royal Flush",
    "bets.options.drill.drill.label": "Drilling",
    "bets.options.straight.straight.label": "Straße",
    "bets.options.flush.flush.label": "Flush",
    "bets.options.full_house.full_house.label": "Full House",
    "bets.options.poker.poker.label": "Vierling",
    "bets.options.joker.joker.label": "Joker",
    "bets.describe.color.red": "Rot",
    "bets.describe.color.black": "Schwarz",
    "bets.describe.suit.hearts": "Herz",
    "bets.describe.suit.diamonds": "Karo",
    "bets.describe.suit.clubs": "Kreuz",
    "bets.describe.suit.spades": "Pik",
    "bets.describe.number.number": "Zahl (2-10)",
    "bets.describe.face.face": "Bildkarte (J-A)",
    "bets.describe.high_low_seven.higher": "Höher als 7",
    "bets.describe.high_low_seven.lower": "Niedriger als 7",
    "bets.describe.high_low_previous.higher":
      "Höher als die vorherige Karte",
    "bets.describe.high_low_previous.lower":
      "Niedriger als die vorherige Karte",
    "bets.describe.rank_exact": "Exakter Rang: {{label}}",
    "bets.describe.pair.pair": "Paar",
    "bets.describe.two_pair.two_pair": "Zwei Paare",
    "bets.describe.straight_flush.straight_flush": "Straight Flush",
    "bets.describe.royal_flush.royal_flush": "Royal Flush",
    "bets.describe.drill.drill": "Drilling",
    "bets.describe.straight.straight": "Straße",
    "bets.describe.flush.flush": "Flush",
    "bets.describe.full_house.full_house": "Full House",
    "bets.describe.poker.poker": "Vierling",
    "bets.describe.joker.joker": "Joker",
    "results.cardsTitle": "Aufgedeckte Karten",
    "results.diceTitle": "Wurf / Auswahl",
    "results.betOutcomeTitle": "Einsatz-Ergebnisse",
    "results.betOutcomePlaceholder":
      "Nach der Runde erscheinen hier die Ergebnisse.",
    "results.logTitle": "Protokoll",
    "results.summary.cardLabel": "Gewinnende Karte",
    "results.summary.handLabel": "Pokerhand",
    "results.summary.outcomeLabel": "Rundenergebnis",
    "results.summary.cardPending": "Warten…",
    "results.summary.cardNone": "—",
    "results.summary.cardPush": "Wurf: 6 – Push",
    "results.summary.handPending": "Warten…",
    "results.summary.handNone": "Keine Kombination",
    "results.summary.outcome.pending": "Warten…",
    "results.summary.outcome.win": "Gewonnen",
    "results.summary.outcome.loss": "Verloren",
    "results.summary.outcome.push": "Push",
    "results.summary.outcome.breakEven": "Gleichstand",
    "history.title": "Vorherige Runden",
    "history.subtitle": "Alle fünf Karten und das Würfelergebnis",
    "history.empty": "Noch keine Einträge.",
    "history.summary.winsTitle": "Gewinnwetten",
    "history.summary.noWins": "Keine Gewinnwetten.",
    "history.open": "Historie öffnen",
    "history.modalTitle": "Gesamte Historie",
    "history.close": "Historie schließen",
    "dice.waiting": "Warten auf Wurf oder Auswahl…",
    "dice.playerIdle": "Warte auf eine Auswahl…",
    "dice.playerPrompt": "Wähle eine Karte!",
    "dice.playerResult": "Gewählte Karte: #{{value}}",
    "dice.inProgress": "Wurf läuft…",
    "dice.result": "Wurfergebnis: {{value}}",
    "dice.pushResult": "Wurf: 6 – alle Einsätze werden zurückgezahlt.",
    "dice.ariaLabel": "Würfel",
    "banner.win.title": "Sie haben gewonnen!",
    "betBreakdown.winDetail":
      "Auszahlung: {{payout}} (Gewinn: {{profit}}, Einsatz: {{amount}})",
    "betBreakdown.pushDetail": "Einsatz zurück: {{amount}}.",
    "betBreakdown.lossDetail": "Verlorener Einsatz (Franken): {{amount}}.",
    "betBreakdown.noBets":
      "In dieser Runde wurden keine Einsätze platziert.",
    "betBreakdown.pushAll":
      "Wurf: 6 – alle Einsätze werden zurückgezahlt.",
    "round.inProgress": "Runde läuft…",
    "messages.selectChip": "Wähle einen Jeton, bevor du setzt.",
    "messages.insufficientFunds": "Nicht genug Guthaben für diesen Jeton.",
    "messages.betRequired":
      "Platziere mindestens einen Einsatz, um die Runde zu starten.",
    "messages.betTooLarge":
      "Die Einsätze übersteigen dein verfügbares Guthaben.",
    "messages.noPreviousBet":
      "Es gibt keinen vorherigen Einsatz zum Wiederholen.",
    "messages.rebetInsufficient":
      "Für die Wiederholung werden {{amount}} benötigt.",
    "messages.doubleUnavailable":
      "Bitte zuerst Einsätze platzieren, bevor du verdoppelst.",
    "messages.doubleInsufficient":
      "Für das Verdoppeln werden {{amount}} benötigt.",
    "messages.autoStopLoss":
      "Stop-Loss bei {{amount}} erreicht. Automatikmodus gestoppt.",
    "messages.autoStopWin":
      "Stop-Win bei {{amount}} erreicht. Automatikmodus gestoppt.",
    "messages.autoZeroBet":
      "Der Automatikmodus konnte keinen gültigen nächsten Einsatz bestimmen.",
    "messages.autoInsufficient":
      "Für den Automatikmodus werden {{amount}} benötigt.",
    "logs.rollSix": "Wurf: 6 – alle Einsätze werden zurückgezahlt.",
    "logs.roll": "Wurf: {{value}}.",
    "logs.playerChoice": "Spieler wählte Karte #{{position}}.",
    "logs.winningCard": "Gewinnende Karte: #{{position}} – {{card}}.",
    "logs.betWin": "✔ {{label}} gewinnt! Auszahlung: {{payout}} (Gewinn: {{profit}}).",
    "logs.betPush": "↺ {{label}} push. Einsatz zurück.",
    "logs.betLoss": "✖ {{label}} verloren.",
    "cards.joker": "Joker",
    "diceHistory.rollSix": "Wurf: 6 – alle Einsätze werden zurückgezahlt.",
    "diceHistory.roll": "Wurf: {{value}}",
    "diceHistory.playerChoice": "Auswahl: #{{value}}",
    "ranks.display.Joker": "Joker",
  },
};

const LANGUAGE_META = {
  hu: { locale: "hu", name: "Magyar" },
  en: { locale: "en", name: "English" },
  de: { locale: "de", name: "Deutsch" },
};

const SUPPORTED_LANGUAGES = Object.keys(I18N_STRINGS);

const currencyFormatterCache = {};
const signedCurrencyFormatterCache = {};
const numberFormatterCache = {};

let settingsState = loadSettings();

let currentLanguage = settingsState.language;
if (SUPPORTED_LANGUAGES.includes(document.documentElement.lang)) {
  currentLanguage = document.documentElement.lang;
}
if (!SUPPORTED_LANGUAGES.includes(currentLanguage)) {
  currentLanguage = DEFAULT_SETTINGS.language;
}
settingsState.language = currentLanguage;

audioState.volume =
  typeof settingsState.volume === "number"
    ? clamp(settingsState.volume, 0, 1)
    : DEFAULT_SETTINGS.volume;
audioState.muted = Boolean(settingsState.muted);
if (audioState.volume === 0 && !audioState.muted) {
  audioState.muted = true;
}
settingsState.volume = audioState.volume;
settingsState.muted = audioState.muted;

let currentDiceTheme =
  settingsState.diceTheme === "casino" ? "casino" : DEFAULT_SETTINGS.diceTheme;
settingsState.diceTheme = currentDiceTheme;

let currentDiceMode =
  settingsState.diceMode === DICE_MODES.PLAYER
    ? DICE_MODES.PLAYER
    : DEFAULT_SETTINGS.diceMode;
settingsState.diceMode = currentDiceMode;

let currentFeltTheme = FELT_THEMES.includes(settingsState.feltTheme)
  ? settingsState.feltTheme
  : DEFAULT_SETTINGS.feltTheme;
settingsState.feltTheme = currentFeltTheme;

let currentChipStyle = CHIP_STYLES.includes(settingsState.chipStyle)
  ? settingsState.chipStyle
  : DEFAULT_SETTINGS.chipStyle;
settingsState.chipStyle = currentChipStyle;

let storedCardStyle = settingsState.cardStyle;
if (storedCardStyle && CARD_STYLE_ALIASES[storedCardStyle]) {
  storedCardStyle = CARD_STYLE_ALIASES[storedCardStyle];
}
let currentCardStyle = CARD_STYLES.includes(storedCardStyle)
  ? storedCardStyle
  : DEFAULT_SETTINGS.cardStyle;
settingsState.cardStyle = currentCardStyle;

let currentUiDensity = UI_DENSITIES.includes(settingsState.uiDensity)
  ? settingsState.uiDensity
  : DEFAULT_SETTINGS.uiDensity;
settingsState.uiDensity = currentUiDensity;

let currentRevealSpeed = REVEAL_SPEEDS.includes(settingsState.revealSpeed)
  ? settingsState.revealSpeed
  : DEFAULT_SETTINGS.revealSpeed;
settingsState.revealSpeed = currentRevealSpeed;

currentStakingMode =
  settingsState.stakingMode === STAKING_MODES.AUTO
    ? STAKING_MODES.AUTO
    : DEFAULT_SETTINGS.stakingMode;
settingsState.stakingMode = currentStakingMode;

autoBetConfig.lossPercent = sanitizePercentValue(settingsState.autoLossPercent);
autoBetConfig.winPercent = sanitizePercentValue(settingsState.autoWinPercent);
autoBetConfig.stopLoss = sanitizeAmountValue(settingsState.autoStopLoss);
autoBetConfig.stopWin = sanitizeAmountValue(settingsState.autoStopWin);

let winningHintsEnabled =
  typeof settingsState.showWinningHints === "boolean"
    ? settingsState.showWinningHints
    : DEFAULT_SETTINGS.showWinningHints;
settingsState.showWinningHints = winningHintsEnabled;
persistSettings();

function getLocaleForLanguage(lang = currentLanguage) {
  const meta = LANGUAGE_META[lang];
  return meta?.locale || lang || "hu";
}

function getStrings(lang) {
  return I18N_STRINGS[lang] || I18N_STRINGS.hu;
}

function interpolate(template, params) {
  if (typeof template !== "string") {
    return template;
  }
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (params && Object.prototype.hasOwnProperty.call(params, key)) {
      return String(params[key]);
    }
    return "";
  });
}

function t(key, params = {}, lang = currentLanguage) {
  const strings = getStrings(lang);
  const fallbackStrings = getStrings("hu");
  const template = strings[key] ?? fallbackStrings[key] ?? key;
  return interpolate(template, params);
}

function ensureAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!audioState.context) {
    audioState.context = new AudioCtx();
  }
  if (audioState.context.state === "suspended") {
    audioState.context.resume();
  }
  ensureMasterGain();
  return audioState.context;
}

function unlockAudioContext() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  if (unlockAudioContext.unlocked) return;
  ctx.resume().then(() => {
    unlockAudioContext.unlocked = true;
  });
}

document.addEventListener("pointerdown", unlockAudioContext, { once: true });
document.addEventListener("keydown", unlockAudioContext, { once: true });

function ensureMasterGain() {
  const ctx = audioState.context;
  if (!ctx) return null;
  if (!audioState.masterGain) {
    audioState.masterGain = ctx.createGain();
    audioState.masterGain.gain.value = audioState.muted ? 0 : audioState.volume;
    audioState.masterGain.connect(ctx.destination);
  }
  return audioState.masterGain;
}

function applyMasterGain() {
  const ctx = ensureAudioContext();
  const master = ensureMasterGain();
  if (!ctx || !master) return;
  const target = audioState.muted ? 0 : audioState.volume;
  master.gain.setTargetAtTime(target, ctx.currentTime, 0.01);
}

function playSound(name) {
  const ctx = ensureAudioContext();
  const steps = SOUND_DEFINITIONS[name];
  if (!ctx || !steps) return;

  const master = ensureMasterGain();
  const now = ctx.currentTime;
  const epsilon = 0.0001;

  steps.forEach((step) => {
    const start = now + (step.delay ?? 0);
    const duration = Math.max(0.01, step.duration ?? 0.15);
    const peakGain = Math.max(epsilon, step.gain ?? 0.25);
    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(epsilon, start);
    gainNode.gain.linearRampToValueAtTime(peakGain, start + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(epsilon, start + duration);

    const connectTarget = (node) => {
      node.connect(gainNode);
      if (master) {
        gainNode.connect(master);
      } else {
        gainNode.connect(ctx.destination);
      }
    };

    if (step.kind === "noise") {
      const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i += 1) {
        channel[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      let lastNode = source;
      if (step.filter) {
        const filter = ctx.createBiquadFilter();
        filter.type = step.filter.type ?? "lowpass";
        if (typeof step.filter.frequency === "number") {
          filter.frequency.setValueAtTime(step.filter.frequency, start);
        }
        if (typeof step.filter.Q === "number") {
          filter.Q.setValueAtTime(step.filter.Q, start);
        }
        lastNode.connect(filter);
        lastNode = filter;
      }

      connectTarget(lastNode);
      source.start(start);
      source.stop(start + duration + 0.05);
      return;
    }

    const oscillator = ctx.createOscillator();
    oscillator.type = step.type ?? "sine";
    if (typeof step.frequency === "number") {
      oscillator.frequency.setValueAtTime(step.frequency, start);
    }
    if (typeof step.detune === "number") {
      oscillator.detune.setValueAtTime(step.detune, start);
    }
    if (typeof step.frequencyEnd === "number") {
      oscillator.frequency.linearRampToValueAtTime(step.frequencyEnd, start + duration);
    }

    connectTarget(oscillator);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  });
}

const stats = {
  rounds: 0,
  colors: { red: 0, black: 0, joker: 0 },
  suits: { hearts: 0, diamonds: 0, clubs: 0, spades: 0, joker: 0 },
  types: { number: 0, face: 0, joker: 0 },
  ranks: RANKS.concat(["Joker"]).reduce((acc, rank) => {
    acc[rank] = 0;
    return acc;
  }, {}),
};

const RANKS_WITH_JOKER = RANKS.concat(["Joker"]);
const HINT_PREVIEW_CARDS = [
  ...SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit }))),
  { rank: "Joker", suit: null },
];
const bankrollDisplay = document.getElementById("bankroll-display");
const betTotalDisplay = document.getElementById("bet-total-display");
const logList = document.getElementById("log");
const cardsContainer = document.getElementById("cards-container");
const diceDisplayEl = document.getElementById("dice-display");
const diceResultEl = document.getElementById("dice-result");
const diceEl = document.getElementById("dice");
const diceCubeEl = diceEl ? diceEl.querySelector(".dice__cube") : null;
const diceValueEl = document.getElementById("dice-value");
const diceHistoryList = document.getElementById("dice-history-list");
const betBreakdownList = document.getElementById("bet-breakdown-list");
const resultsSummarySection = document.getElementById("results-summary");
const resultsSummaryCardEl = document.getElementById("results-summary-card");
const resultsSummaryHandEl = document.getElementById("results-summary-hand");
const resultsSummaryOutcomeEl = document.getElementById("results-summary-outcome");
const resultsSummaryAmountEl = document.getElementById("results-summary-amount");
const dealButton = document.getElementById("deal-button");
const clearAllButton = document.getElementById("clear-all");
const repeatBetButton = document.getElementById("repeat-bet");
const doubleBetButton = document.getElementById("double-bet");
const stakingModeInputs = Array.from(
  document.querySelectorAll('input[name="staking-mode"]'),
);
const stakingStatusEl = document.getElementById("staking-status");
const autoStakeConfigEl = document.getElementById("auto-stake-config");
const autoLossInput = document.getElementById("auto-loss-percent");
const autoWinInput = document.getElementById("auto-win-percent");
const autoStopLossInput = document.getElementById("auto-stop-loss");
const autoStopWinInput = document.getElementById("auto-stop-win");
const settingsPanel = document.getElementById("settings-panel");
const settingsToggle = document.getElementById("settings-toggle");
const settingsDialog = settingsPanel
  ? settingsPanel.querySelector(".settings-panel__dialog")
  : null;
const statsPanelContainer = document.getElementById("stats-panel");
const statsToggle = document.getElementById("stats-toggle");
const statsDialog = statsPanelContainer
  ? statsPanelContainer.querySelector(".stats-panel__dialog")
  : null;
const historyPanel = document.getElementById("history-panel");
const historyToggle = document.getElementById("history-toggle");
const historyDialog = historyPanel
  ? historyPanel.querySelector(".history-panel__dialog")
  : null;
const languageSelect = document.getElementById("language-select");
const chipButtons = Array.from(document.querySelectorAll(".chip-tray .chip"));
const betSpots = Array.from(document.querySelectorAll(".bet-spot"));
const diceThemeInputs = Array.from(
  document.querySelectorAll('input[name="dice-theme"]'),
);
const diceModeInputs = Array.from(
  document.querySelectorAll('input[name="dice-mode"]'),
);
const feltThemeInputs = Array.from(
  document.querySelectorAll('input[name="felt-theme"]'),
);
const chipStyleInputs = Array.from(
  document.querySelectorAll('input[name="chip-style"]'),
);
const cardStyleInputs = Array.from(
  document.querySelectorAll('input[name="card-style"]'),
);
const uiDensityInputs = Array.from(
  document.querySelectorAll('input[name="ui-density"]'),
);
const revealSpeedInputs = Array.from(
  document.querySelectorAll('input[name="reveal-speed"]'),
);
const volumeSlider = document.getElementById("volume-slider");
const volumeDisplay = document.getElementById("volume-display");
const muteButton = document.getElementById("mute-button");
const muteButtonLabel = document.getElementById("mute-button-label");
const muteButtonIcon = document.querySelector(
  "#mute-button .settings-mute__icon",
);
const highLowPreviousOddsEls = {
  higher: document.querySelector(
    '.bet-spot[data-bet-type="high_low_previous"][data-bet-key="higher"] .bet-odds',
  ),
  lower: document.querySelector(
    '.bet-spot[data-bet-type="high_low_previous"][data-bet-key="lower"] .bet-odds',
  ),
};
const statsRoundsEl = document.getElementById("stats-rounds");
const statsTopColorEl = document.getElementById("stats-top-color");
const statsTopSuitEl = document.getElementById("stats-top-suit");
const statsTopRankEl = document.getElementById("stats-top-rank");
const statsColorRedEl = document.getElementById("stats-color-red");
const statsColorBlackEl = document.getElementById("stats-color-black");
const statsColorJokerEl = document.getElementById("stats-color-joker");
const statsColorChartEl = document.getElementById("stats-color-chart");
const statsSuitHeartsEl = document.getElementById("stats-suit-hearts");
const statsSuitDiamondsEl = document.getElementById("stats-suit-diamonds");
const statsSuitClubsEl = document.getElementById("stats-suit-clubs");
const statsSuitSpadesEl = document.getElementById("stats-suit-spades");
const statsSuitJokerEl = document.getElementById("stats-suit-joker");
const statsSuitChartEl = document.getElementById("stats-suit-chart");
const statsTypeNumberEl = document.getElementById("stats-type-number");
const statsTypeFaceEl = document.getElementById("stats-type-face");
const statsTypeJokerEl = document.getElementById("stats-type-joker");
const statsTypeChartEl = document.getElementById("stats-type-chart");
const statsRanksEl = document.getElementById("stats-ranks");
const winBannerEl = document.getElementById("win-banner");
const winBannerAmountEl = document.getElementById("win-banner-amount");
const confettiLayer = document.getElementById("confetti-layer");
const historyFullList = document.getElementById("history-full-list");
const historyFullEmptyEl = document.getElementById("history-full-empty");
const winningHintsPanel = document.getElementById("winning-hints");
const winningHintsBody = document.getElementById("winning-hints-body");
const winningHintsToggle = document.getElementById("winning-hints-toggle");

let winningHintsBarActive = false;

setWinningHintsEnabled(winningHintsEnabled);

const DEFAULT_DICE_TEXT_KEY = "dice.waiting";
const PLAYER_DICE_TEXT_KEY = "dice.playerIdle";
const DICE_TRANSFORMS = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateX(0deg) rotateY(-90deg)",
  3: "rotateX(-90deg) rotateY(0deg)",
  4: "rotateX(90deg) rotateY(0deg)",
  5: "rotateX(0deg) rotateY(90deg)",
  6: "rotateX(0deg) rotateY(180deg)",
};

let statsFocusReturn = null;
let historyFocusReturn = null;
let winBannerTimeout = null;
let confettiTimeout = null;
let lastRenderedBankroll = bankroll;
let lastRenderedBetTotal = currentBetTotal;
let diceRollTimeout = null;
let diceFinalTimeout = null;
let dicePendingResolver = null;
let historyCounter = 0;
const MAX_HISTORY_ITEMS = 6;
let lastFocusedElement = null;

const logEntries = [];
const diceHistoryEntries = [];
const fullHistoryEntries = [];
let betBreakdownState = {
  type: "placeholder",
  key: "results.betOutcomePlaceholder",
  params: {},
};
let diceValueState = { key: DEFAULT_DICE_TEXT_KEY, params: {} };
let dealButtonLabelKey = "actions.deal";
let resultsSummaryState = {
  status: "idle",
  winningCard: null,
  pokerHandKey: null,
  outcome: "pending",
  amount: 0,
  resolutionType: null,
};

initializeBetVisuals();
resetResultsSummaryState();

const PIP_LAYOUTS = {
  A: [[3, 2]],
  "2": [
    [1, 2],
    [5, 2],
  ],
  "3": [
    [1, 2],
    [3, 2],
    [5, 2],
  ],
  "4": [
    [1, 1],
    [1, 3],
    [5, 1],
    [5, 3],
  ],
  "5": [
    [1, 1],
    [1, 3],
    [3, 2],
    [5, 1],
    [5, 3],
  ],
  "6": [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
    [5, 1],
    [5, 3],
  ],
  "7": [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
    [5, 1],
    [5, 3],
    [2, 2],
  ],
  "8": [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
    [5, 1],
    [5, 3],
    [2, 2],
    [4, 2],
  ],
  "9": [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
    [5, 1],
    [5, 3],
    [2, 2],
    [4, 2],
    [3, 2],
  ],
  "10": [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
    [5, 1],
    [5, 3],
    [2, 2],
    [4, 2],
    [2, 1],
    [4, 3],
  ],
};

const POKER_HAND_PRIORITY = [
  "royal_flush",
  "straight_flush",
  "poker",
  "full_house",
  "flush",
  "straight",
  "drill",
  "two_pair",
  "pair",
];

const POKER_HAND_LABEL_MAP = {
  royal_flush: "bets.describe.royal_flush.royal_flush",
  straight_flush: "bets.describe.straight_flush.straight_flush",
  poker: "bets.describe.poker.poker",
  full_house: "bets.describe.full_house.full_house",
  flush: "bets.describe.flush.flush",
  straight: "bets.describe.straight.straight",
  drill: "bets.describe.drill.drill",
  two_pair: "bets.describe.two_pair.two_pair",
  pair: "bets.describe.pair.pair",
};

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return min;
  }
  return Math.min(Math.max(num, min), max);
}

function sanitizePercentValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return clamp(num, -100, 1000);
}

function sanitizeAmountValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return 0;
  }
  return Math.max(0, roundCurrency(num));
}

function updateDisplays() {
  if (bankrollDisplay) {
    bankrollDisplay.textContent = formatCurrency(bankroll);
    const card = bankrollDisplay.closest(".bankroll-card");
    if (roundCurrency(bankroll) !== roundCurrency(lastRenderedBankroll)) {
      triggerFlash(card);
    }
  }
  if (betTotalDisplay) {
    betTotalDisplay.textContent = formatCurrency(currentBetTotal);
    const betCard = betTotalDisplay.closest(".bankroll-card");
    if (roundCurrency(currentBetTotal) !== roundCurrency(lastRenderedBetTotal)) {
      triggerFlash(betCard);
    }
  }
  lastRenderedBankroll = bankroll;
  lastRenderedBetTotal = currentBetTotal;
  updateWinningCardHints();
}

function formatPayoutMultiplier(multiplier, lang = currentLanguage) {
  if (multiplier === null || Number.isNaN(multiplier)) {
    return "—";
  }
  if (!Number.isFinite(multiplier)) {
    return multiplier > 0 ? "∞ : 1" : "0 : 1";
  }
  const rounded = Math.round(multiplier * 100) / 100;
  const formatted = formatPlainNumber(rounded, lang);
  return `${formatted} : 1`;
}

function updateHighLowPreviousDisplay() {
  ["higher", "lower"].forEach((key) => {
    const span = highLowPreviousOddsEls[key];
    if (!span) return;
    span.textContent = formatPayoutMultiplier(highLowPreviousState.payouts[key]);
  });
}

function computeHighLowPreviousOdds(card) {
  if (!card || !card.suit) {
    return null;
  }
  const value = RANK_ORDER[card.rank];
  if (!value) {
    return null;
  }

  const lowerStrictCount = Math.max(0, value - LOWEST_RANK_VALUE) * CARDS_PER_RANK;
  const higherStrictCount = Math.max(0, HIGHEST_RANK_VALUE - value) * CARDS_PER_RANK;
  const equalCount = CARDS_PER_RANK;

  const buildOutcome = (strictCount) => {
    const tiesWin = strictCount === 0;
    const winCount = tiesWin ? equalCount : strictCount;
    const pushCount = tiesWin ? JOKER_COUNT : equalCount + JOKER_COUNT;
    const lossCount = Math.max(0, TOTAL_DECK_CARDS - winCount - pushCount);
    const payout = winCount === 0 ? null : lossCount / winCount;
    return { payout, tiesWin };
  };

  return {
    lower: buildOutcome(lowerStrictCount),
    higher: buildOutcome(higherStrictCount),
  };
}

function applyHighLowPreviousReference(card) {
  if (!card || !card.suit || !RANK_ORDER[card.rank]) {
    lastWinningCard = null;
    highLowPreviousState.payouts.higher = null;
    highLowPreviousState.payouts.lower = null;
    highLowPreviousState.tiesWin.higher = false;
    highLowPreviousState.tiesWin.lower = false;
    updateHighLowPreviousDisplay();
    return;
  }

  lastWinningCard = { rank: card.rank, suit: card.suit };
  const odds = computeHighLowPreviousOdds(card);
  if (odds) {
    highLowPreviousState.payouts.higher = odds.higher.payout;
    highLowPreviousState.payouts.lower = odds.lower.payout;
    highLowPreviousState.tiesWin.higher = odds.higher.tiesWin;
    highLowPreviousState.tiesWin.lower = odds.lower.tiesWin;
  } else {
    highLowPreviousState.payouts.higher = null;
    highLowPreviousState.payouts.lower = null;
    highLowPreviousState.tiesWin.higher = false;
    highLowPreviousState.tiesWin.lower = false;
  }
  updateHighLowPreviousDisplay();
  updateWinningCardHints();
}

function resolveLogParams(entry) {
  const params = { ...(entry.params || {}) };
  if (params.betType && params.betKey) {
    params.label = describeBet(params.betType, params.betKey);
  }
  if (typeof params.payout === "number") {
    params.payout = formatCurrency(params.payout);
  }
  if (typeof params.profit === "number") {
    params.profit = formatCurrency(params.profit);
  }
  if (typeof params.amount === "number") {
    params.amount = formatCurrency(params.amount);
  }
  if (params.card) {
    params.card = describeCard(params.card);
  }
  return params;
}

function renderLog() {
  if (!logList) return;
  logList.innerHTML = "";
  logEntries.forEach((entry) => {
    const item = document.createElement("li");
    const params = resolveLogParams(entry);
    item.textContent = t(entry.key, params);
    logList.appendChild(item);
  });
}

function addLog(key, params = {}) {
  logEntries.unshift({ key, params: { ...params } });
  renderLog();
}

function resetLog() {
  logEntries.length = 0;
  renderLog();
}

function resetCards() {
  if (cardsContainer) {
    cardsContainer.innerHTML = "";
  }
  cardElements = [];
  cardSelectionActive = false;
  cardSelectionResolver = null;
}

function renderBetBreakdownState() {
  if (!betBreakdownList) return;
  betBreakdownList.innerHTML = "";
  if (betBreakdownState.type !== "entries") {
    const item = document.createElement("li");
    item.className = "bet-breakdown__empty";
    item.textContent = t(betBreakdownState.key, betBreakdownState.params);
    betBreakdownList.appendChild(item);
    return;
  }

  betBreakdownState.entries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = [
      "bet-breakdown__item",
      `bet-breakdown__item--${entry.status}`,
    ]
      .filter(Boolean)
      .join(" ");

    const icon = document.createElement("span");
    icon.className = "bet-breakdown__icon";
    icon.textContent = entry.status === "win" ? "✔" : entry.status === "push" ? "↺" : "✖";

    const content = document.createElement("div");
    content.className = "bet-breakdown__content";

    const label = document.createElement("span");
    label.className = "bet-breakdown__label";
    label.textContent = describeBet(entry.betType, entry.betKey);

    const detail = document.createElement("span");
    detail.className = "bet-breakdown__detail";

    if (entry.status === "win") {
      detail.textContent = t("betBreakdown.winDetail", {
        payout: formatCurrency(entry.payout ?? 0),
        profit: formatCurrency(entry.profit ?? 0),
        amount: formatCurrency(entry.amount ?? 0),
      });
    } else if (entry.status === "push") {
      detail.textContent = t("betBreakdown.pushDetail", {
        amount: formatCurrency(entry.payout ?? entry.amount ?? 0),
      });
    } else {
      detail.textContent = t("betBreakdown.lossDetail", {
        amount: formatCurrency(entry.amount ?? 0),
      });
    }

    content.append(label, detail);
    item.append(icon, content);
    betBreakdownList.appendChild(item);
  });
}

function clearBetSpotResults() {
  betSpots.forEach((spot) => {
    spot.classList.remove(
      "bet-spot--result",
      "bet-spot--win",
      "bet-spot--push",
      "bet-spot--loss",
    );
  });
}

function applyBetSpotResults({ winningSpots = [] } = {}) {
  clearBetSpotResults();
  winningSpots.forEach(({ betType, betKey }) => {
    const spot = betSpots.find(
      (el) => el.dataset.betType === betType && el.dataset.betKey === betKey,
    );
    if (spot) {
      spot.classList.add("bet-spot--result", "bet-spot--win");
    }
  });
}

function setBetBreakdownPlaceholder(key, params = {}, { clear = true } = {}) {
  betBreakdownState = { type: "placeholder", key, params };
  if (clear) {
    clearBetSpotResults();
  }
  renderBetBreakdownState();
}

function computeWinningBetSpots({
  cards,
  winningIndex,
  pokerResults,
  previousWinningCard,
}) {
  if (!Array.isArray(cards) || typeof winningIndex !== "number") {
    return [];
  }

  const winningCard = cards[winningIndex];
  if (!winningCard) {
    return [];
  }

  const evaluation =
    pokerResults && typeof pokerResults === "object"
      ? pokerResults
      : evaluatePokerCombinations(cards);

  const winners = [];

  betSpots.forEach((spot) => {
    const betType = spot.dataset.betType;
    const betKey = spot.dataset.betKey;
    if (!betType || typeof betKey === "undefined") {
      return;
    }

    const outcome = resolveBet(
      betType,
      betKey,
      1,
      cards,
      winningIndex,
      evaluation,
      previousWinningCard,
    );

    if (outcome.type === "win") {
      winners.push({ betType, betKey });
    }
  });

  return winners;
}

function renderBetBreakdown(entries, { resolution, winningSpots = [] } = {}) {
  if (!entries.length) {
    const key = resolution?.type === "push" ? "betBreakdown.pushAll" : "betBreakdown.noBets";
    setBetBreakdownPlaceholder(key, { value: resolution?.value }, { clear: false });
  } else {
    betBreakdownState = {
      type: "entries",
      entries: entries.map((entry) => ({
        status: entry.status,
        betType: entry.betType,
        betKey: entry.betKey,
        amount: entry.amount,
        profit: entry.profit,
        payout: entry.payout,
      })),
    };
    renderBetBreakdownState();
  }

  applyBetSpotResults({ winningSpots });
}

function determineBestPokerHandKey(pokerResults) {
  if (!pokerResults) return null;
  return POKER_HAND_PRIORITY.find((key) => pokerResults[key]) || null;
}

function resetResultsSummaryState() {
  resultsSummaryState = {
    status: "idle",
    winningCard: null,
    pokerHandKey: null,
    outcome: "pending",
    amount: 0,
    resolutionType: null,
  };
  updateResultsSummaryDisplay();
}

function setResultsSummaryPending() {
  resultsSummaryState = {
    status: "pending",
    winningCard: null,
    pokerHandKey: null,
    outcome: "pending",
    amount: 0,
    resolutionType: null,
  };
  updateResultsSummaryDisplay();
}

function setResultsSummaryResolved({
  winningCard,
  pokerHandKey,
  outcome,
  amount,
  resolutionType,
}) {
  resultsSummaryState = {
    status: "resolved",
    winningCard: cloneCard(winningCard),
    pokerHandKey: pokerHandKey || null,
    outcome: outcome || "pending",
    amount: roundCurrency(Number.isFinite(amount) ? amount : 0),
    resolutionType: resolutionType || null,
  };
  updateResultsSummaryDisplay();
}

function updateResultsSummaryDisplay() {
  if (!resultsSummarySection) {
    return;
  }

  const summaryClasses = [
    "results-summary--win",
    "results-summary--loss",
    "results-summary--push",
  ];
  resultsSummarySection.classList.remove(...summaryClasses);
  if (resultsSummaryAmountEl) {
    resultsSummaryAmountEl.classList.remove(
      "results-summary__delta--win",
      "results-summary__delta--loss",
      "results-summary__delta--push",
    );
  }

  const state = resultsSummaryState || {};

  if (resultsSummaryCardEl) {
    let cardText;
    if (state.status === "resolved") {
      if (state.resolutionType === "push") {
        cardText = t("results.summary.cardPush");
      } else if (state.winningCard) {
        cardText = describeCard(state.winningCard);
      } else {
        cardText = t("results.summary.cardNone");
      }
    } else {
      cardText = t("results.summary.cardPending");
    }
    resultsSummaryCardEl.textContent = cardText;
  }

  if (resultsSummaryHandEl) {
    let handText;
    if (state.status === "resolved") {
      if (state.pokerHandKey && POKER_HAND_LABEL_MAP[state.pokerHandKey]) {
        handText = t(POKER_HAND_LABEL_MAP[state.pokerHandKey]);
      } else if (state.pokerHandKey) {
        handText = state.pokerHandKey;
      } else {
        handText = t("results.summary.handNone");
      }
    } else {
      handText = t("results.summary.handPending");
    }
    resultsSummaryHandEl.textContent = handText;
  }

  let amountText = formatCurrencyWithSign(0);
  let outcomeKey = "results.summary.outcome.pending";
  let deltaClass = null;
  let summaryClass = null;

  if (state.status === "resolved") {
    switch (state.outcome) {
      case "win":
        outcomeKey = "results.summary.outcome.win";
        deltaClass = "results-summary__delta--win";
        summaryClass = "results-summary--win";
        break;
      case "loss":
        outcomeKey = "results.summary.outcome.loss";
        deltaClass = "results-summary__delta--loss";
        summaryClass = "results-summary--loss";
        break;
      case "push":
        outcomeKey = "results.summary.outcome.push";
        deltaClass = "results-summary__delta--push";
        summaryClass = "results-summary--push";
        break;
      default:
        outcomeKey = "results.summary.outcome.breakEven";
        deltaClass = "results-summary__delta--push";
        summaryClass = "results-summary--push";
        break;
    }
    amountText = formatCurrencyWithSign(state.amount);
  }

  if (resultsSummaryOutcomeEl) {
    resultsSummaryOutcomeEl.textContent = t(outcomeKey);
  }
  if (resultsSummaryAmountEl) {
    resultsSummaryAmountEl.textContent = amountText;
    if (deltaClass) {
      resultsSummaryAmountEl.classList.add(deltaClass);
    }
  }
  if (summaryClass) {
    resultsSummarySection.classList.add(summaryClass);
  }
}

function setDealButtonLabel(key) {
  if (!dealButton) return;
  dealButtonLabelKey = key;
  dealButton.textContent = t(key);
}

function markWinningCard(index) {
  cardElements.forEach((cardEl, cardIndex) => {
    const isWinner = typeof index === "number" && cardIndex === index;
    cardEl.classList.toggle("card--winner", isWinner);
  });
}

function resolveDicePromise() {
  if (typeof dicePendingResolver === "function") {
    const resolver = dicePendingResolver;
    dicePendingResolver = null;
    resolver();
  }
}

function clearDiceTimers(options = {}) {
  const { resolvePending = false } = options;
  if (diceRollTimeout) {
    clearTimeout(diceRollTimeout);
    diceRollTimeout = null;
  }
  if (diceFinalTimeout) {
    clearTimeout(diceFinalTimeout);
    diceFinalTimeout = null;
  }
  if (resolvePending) {
    resolveDicePromise();
  }
}

function getDefaultDiceTextKey() {
  return currentDiceMode === DICE_MODES.PLAYER
    ? PLAYER_DICE_TEXT_KEY
    : DEFAULT_DICE_TEXT_KEY;
}

function setDiceText(key, params = {}) {
  diceValueState = { key, params };
  if (diceValueEl) {
    diceValueEl.textContent = t(key, params);
  }
  if (diceResultEl && !diceValueEl) {
    diceResultEl.textContent = t(key, params);
  }
}

function setDiceTransform(transform, { animate = true } = {}) {
  if (!diceCubeEl) return;
  if (!animate) {
    diceCubeEl.classList.add("dice__cube--resetting");
  }
  diceCubeEl.style.transform = transform;
  if (!animate) {
    diceCubeEl.offsetHeight;
    diceCubeEl.classList.remove("dice__cube--resetting");
  }
}

function resetDice(options = {}) {
  const { immediate = false } = options;
  clearDiceTimers({ resolvePending: true });
  setDiceText(getDefaultDiceTextKey());
  if (!diceEl || !diceCubeEl) {
    return;
  }
  diceEl.classList.remove("dice--rolling");
  setDiceTransform(DICE_TRANSFORMS[1], { animate: !immediate });
}

function applyDiceMode() {
  const isPlayerMode = currentDiceMode === DICE_MODES.PLAYER;
  if (diceEl) {
    diceEl.classList.toggle("dice--player-mode", isPlayerMode);
  }
  if (diceDisplayEl) {
    diceDisplayEl.classList.toggle("dice-display--player-mode", isPlayerMode);
  }
}

function setDiceMode(mode) {
  const normalized = mode === DICE_MODES.PLAYER ? DICE_MODES.PLAYER : DICE_MODES.RANDOM;
  if (currentDiceMode === normalized) {
    updateSettings({ diceMode: currentDiceMode });
    return;
  }
  currentDiceMode = normalized;
  updateSettings({ diceMode: currentDiceMode });
  applyDiceMode();
  diceModeInputs.forEach((input) => {
    input.checked = input.value === currentDiceMode;
  });
  if (!roundLocked) {
    resetDice({ immediate: true });
  } else {
    setDiceText(getDefaultDiceTextKey());
  }
}

function selectChip(button) {
  chipButtons.forEach((chip) => chip.classList.remove("active"));
  if (button) {
    button.classList.add("active");
    selectedChip = Number(button.dataset.value);
    playSound("chip");
  } else {
    selectedChip = null;
  }
}

chipButtons.forEach((button, index) => {
  button.addEventListener("click", () => {
    if (roundLocked) return;
    if (selectedChip === Number(button.dataset.value)) {
      selectChip(null);
    } else {
      selectChip(button);
    }
  });
  if (index === 2) {
    selectChip(button);
  }
});

function currentAvailable() {
  return roundCurrency(bankroll - currentBetTotal);
}

function updateBetToolAvailability() {
  const unlocked = !roundLocked;
  if (repeatBetButton) {
    const hasSnapshot = lastBetSnapshot.size > 0 && lastBetTotal > 0;
    repeatBetButton.disabled = !(unlocked && hasSnapshot);
  }
  if (doubleBetButton) {
    const hasSnapshot = lastBetSnapshot.size > 0 && lastBetTotal > 0;
    const hasCurrent = currentBets.size > 0;
    doubleBetButton.disabled = !(unlocked && (hasCurrent || hasSnapshot));
  }
}

function reapplyPreviousBets(multiplier = 1) {
  if (roundLocked) return;
  if (!lastBetSnapshot.size || lastBetTotal <= 0) {
    addLog("messages.noPreviousBet");
    return;
  }
  const scaledEntries = [];
  let total = 0;
  lastBetSnapshot.forEach((amount, key) => {
    const scaled = roundCurrency(amount * multiplier);
    if (scaled > 0) {
      scaledEntries.push([key, scaled]);
      total += scaled;
    }
  });
  total = roundCurrency(total);
  if (total <= 0) {
    addLog("messages.noPreviousBet");
    return;
  }
  if (total > bankroll) {
    addLog("messages.rebetInsufficient", { amount: formatCurrency(total) });
    return;
  }
  currentBets = new Map(scaledEntries);
  currentBetTotal = total;
  refreshDisplayedBets();
  updateDisplays();
  playSound("chip");
  updateBetToolAvailability();
}

function doubleExistingBets() {
  if (roundLocked) return;
  if (currentBets.size === 0) {
    if (lastBetSnapshot.size > 0 && lastBetTotal > 0) {
      reapplyPreviousBets(2);
    } else {
      addLog("messages.doubleUnavailable");
    }
    return;
  }
  const doubledEntries = [];
  let total = 0;
  currentBets.forEach((amount, key) => {
    const doubled = roundCurrency(amount * 2);
    if (doubled > 0) {
      doubledEntries.push([key, doubled]);
      total += doubled;
    }
  });
  total = roundCurrency(total);
  if (total > bankroll) {
    addLog("messages.doubleInsufficient", { amount: formatCurrency(total) });
    return;
  }
  currentBets = new Map(doubledEntries);
  currentBetTotal = total;
  refreshDisplayedBets();
  updateDisplays();
  playSound("chip");
  updateBetToolAvailability();
}

function resetAutoSession({ keepPending = false } = {}) {
  autoBetRuntime.sessionProfit = 0;
  autoBetRuntime.nextTotal = 0;
  autoBetRuntime.active = false;
  autoBetRuntime.stopReason = null;
  if (!keepPending) {
    autoBetRuntime.pendingBets = null;
  }
}

function applyAutoConfigToInputs() {
  suppressAutoInputSync = true;
  if (autoLossInput) {
    autoLossInput.value = String(autoBetConfig.lossPercent);
  }
  if (autoWinInput) {
    autoWinInput.value = String(autoBetConfig.winPercent);
  }
  if (autoStopLossInput) {
    autoStopLossInput.value = autoBetConfig.stopLoss ? autoBetConfig.stopLoss.toFixed(2) : "0";
  }
  if (autoStopWinInput) {
    autoStopWinInput.value = autoBetConfig.stopWin ? autoBetConfig.stopWin.toFixed(2) : "0";
  }
  suppressAutoInputSync = false;
}

function updateStakingStatus() {
  if (!stakingStatusEl) return;
  let key = "staking.status.manual";
  let params = {};

  if (currentStakingMode === STAKING_MODES.AUTO) {
    if (autoBetRuntime.stopReason === "loss") {
      key = "staking.status.autoStoppedLoss";
    } else if (autoBetRuntime.stopReason === "win") {
      key = "staking.status.autoStoppedWin";
    } else if (autoBetRuntime.stopReason === "bankroll") {
      key = "staking.status.autoStoppedBankroll";
    } else {
      let amountText = null;
      if (autoBetRuntime.pendingBets && autoBetRuntime.nextTotal > 0) {
        amountText = formatCurrency(autoBetRuntime.nextTotal);
        key = "staking.status.autoNext";
      } else if (!roundLocked && currentBetTotal > 0) {
        amountText = formatCurrency(currentBetTotal);
        key = "staking.status.autoApplied";
      } else {
        key = "staking.status.autoIdle";
      }
      if (amountText) {
        params.amount = amountText;
      }
    }
  }

  stakingStatusEl.textContent = t(key, params);
}

function setStakingMode(mode) {
  const normalized = mode === STAKING_MODES.AUTO ? STAKING_MODES.AUTO : STAKING_MODES.MANUAL;
  const changed = currentStakingMode !== normalized;
  currentStakingMode = normalized;
  stakingModeInputs.forEach((input) => {
    input.checked = input.value === currentStakingMode;
  });
  if (autoStakeConfigEl) {
    autoStakeConfigEl.hidden = currentStakingMode !== STAKING_MODES.AUTO;
  }
  if (changed) {
    updateSettings({ stakingMode: currentStakingMode });
    resetAutoSession();
  }
  updateStakingStatus();
}

function handleAutoInputChange(event) {
  if (!event || !event.target || suppressAutoInputSync) {
    return;
  }
  const { id, value } = event.target;
  if (id === "auto-loss-percent") {
    autoBetConfig.lossPercent = sanitizePercentValue(value);
    event.target.value = String(autoBetConfig.lossPercent);
  } else if (id === "auto-win-percent") {
    autoBetConfig.winPercent = sanitizePercentValue(value);
    event.target.value = String(autoBetConfig.winPercent);
  } else if (id === "auto-stop-loss") {
    autoBetConfig.stopLoss = sanitizeAmountValue(value);
    event.target.value = autoBetConfig.stopLoss ? autoBetConfig.stopLoss.toFixed(2) : "0";
  } else if (id === "auto-stop-win") {
    autoBetConfig.stopWin = sanitizeAmountValue(value);
    event.target.value = autoBetConfig.stopWin ? autoBetConfig.stopWin.toFixed(2) : "0";
  }
  updateSettings({
    autoLossPercent: autoBetConfig.lossPercent,
    autoWinPercent: autoBetConfig.winPercent,
    autoStopLoss: autoBetConfig.stopLoss,
    autoStopWin: autoBetConfig.stopWin,
  });
  resetAutoSession({ keepPending: true });
  updateStakingStatus();
}

function applyAutoPendingBets() {
  if (currentStakingMode !== STAKING_MODES.AUTO) {
    autoBetRuntime.pendingBets = null;
    autoBetRuntime.nextTotal = 0;
    updateStakingStatus();
    return;
  }
  const pending = autoBetRuntime.pendingBets;
  if (!pending || !pending.size) {
    updateStakingStatus();
    return;
  }
  const entries = Array.from(pending.entries());
  currentBets = new Map(entries);
  currentBetTotal = roundCurrency(
    entries.reduce((total, [, amount]) => total + amount, 0),
  );
  autoBetRuntime.pendingBets = null;
  autoBetRuntime.active = true;
  refreshDisplayedBets();
  updateDisplays();
  updateBetToolAvailability();
  updateWinningCardHints();
  updateStakingStatus();
}

function stopAutoMode(reasonKey) {
  autoBetRuntime.pendingBets = null;
  autoBetRuntime.nextTotal = 0;
  autoBetRuntime.active = false;
  autoBetRuntime.stopReason = reasonKey || null;
  updateStakingStatus();
}

function handleAutoBetAfterRound({ betEntries, netGain, resolutionType }) {
  if (currentStakingMode !== STAKING_MODES.AUTO) {
    stopAutoMode(null);
    return;
  }
  if (!Array.isArray(betEntries) || !betEntries.length) {
    stopAutoMode(null);
    return;
  }
  if (resolutionType === "push") {
    autoBetRuntime.pendingBets = new Map(betEntries);
    autoBetRuntime.nextTotal = roundCurrency(
      betEntries.reduce((sum, [, amount]) => sum + amount, 0),
    );
    autoBetRuntime.active = true;
    autoBetRuntime.stopReason = null;
    updateStakingStatus();
    return;
  }

  autoBetRuntime.active = true;
  autoBetRuntime.stopReason = null;
  autoBetRuntime.sessionProfit = roundCurrency(
    autoBetRuntime.sessionProfit + (Number.isFinite(netGain) ? netGain : 0),
  );

  const lossLimit = autoBetConfig.stopLoss;
  const winLimit = autoBetConfig.stopWin;

  if (lossLimit > 0 && autoBetRuntime.sessionProfit <= -lossLimit) {
    stopAutoMode("loss");
    addLog("messages.autoStopLoss", { amount: formatCurrency(lossLimit) });
    return;
  }

  if (winLimit > 0 && autoBetRuntime.sessionProfit >= winLimit) {
    stopAutoMode("win");
    addLog("messages.autoStopWin", { amount: formatCurrency(winLimit) });
    return;
  }

  let multiplier = 1;
  if (netGain > 0) {
    multiplier = 1 + autoBetConfig.winPercent / 100;
  } else if (netGain < 0) {
    multiplier = 1 + autoBetConfig.lossPercent / 100;
  }
  if (!Number.isFinite(multiplier) || multiplier <= 0) {
    stopAutoMode("bankroll");
    addLog("messages.autoZeroBet");
    return;
  }

  const nextEntries = [];
  let total = 0;
  betEntries.forEach(([key, amount]) => {
    const scaled = roundCurrency(amount * multiplier);
    if (scaled > 0) {
      nextEntries.push([key, scaled]);
      total += scaled;
    }
  });
  total = roundCurrency(total);

  if (total <= 0) {
    stopAutoMode("bankroll");
    addLog("messages.autoZeroBet");
    return;
  }

  if (total > bankroll) {
    stopAutoMode("bankroll");
    addLog("messages.autoInsufficient", { amount: formatCurrency(total) });
    return;
  }

  autoBetRuntime.pendingBets = new Map(nextEntries);
  autoBetRuntime.nextTotal = total;
  updateStakingStatus();
}

function clearAutoResetTimer() {
  if (autoResetTimeout) {
    window.clearTimeout(autoResetTimeout);
    autoResetTimeout = null;
  }
}

function scheduleAutoPrepareNextRound() {
  clearAutoResetTimer();
  const delay = currentRevealSpeed === "tense" ? 3800 : 2400;
  autoResetTimeout = window.setTimeout(() => {
    autoResetTimeout = null;
    if (roundComplete && roundLocked) {
      prepareNextRound();
    }
  }, delay);
}

function formatPlainNumber(value, lang = currentLanguage) {
  if (typeof Intl === "undefined" || typeof Intl.NumberFormat !== "function") {
    const safeValue = Number.isFinite(value) ? value : 0;
    return safeValue.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
  }
  const locale = getLocaleForLanguage(lang);
  if (!numberFormatterCache[lang]) {
    numberFormatterCache[lang] = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  const safeValue = Number.isFinite(value) ? value : 0;
  return numberFormatterCache[lang].format(safeValue);
}

function formatPercent(value, lang = currentLanguage) {
  if (typeof Intl === "undefined" || typeof Intl.NumberFormat !== "function") {
    const safeValue = Math.round(clamp(value, 0, 1) * 100);
    return `${safeValue}%`;
  }
  const locale = getLocaleForLanguage(lang);
  const cacheKey = `${lang}-percent`;
  if (!numberFormatterCache[cacheKey]) {
    numberFormatterCache[cacheKey] = new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  return numberFormatterCache[cacheKey].format(clamp(value, 0, 1));
}

function formatCurrency(value, lang = currentLanguage) {
  if (typeof Intl === "undefined" || typeof Intl.NumberFormat !== "function") {
    const safeValue = Number.isFinite(value) ? value : 0;
    return `${roundCurrency(safeValue).toFixed(2)} CHF`;
  }
  const locale = getLocaleForLanguage(lang);
  if (!currencyFormatterCache[lang]) {
    currencyFormatterCache[lang] = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "CHF",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  const safeValue = Number.isFinite(value) ? value : 0;
  return currencyFormatterCache[lang].format(roundCurrency(safeValue));
}

function formatCurrencyWithSign(value, lang = currentLanguage) {
  if (typeof Intl === "undefined" || typeof Intl.NumberFormat !== "function") {
    const safeValue = Number.isFinite(value) ? value : 0;
    const signed = roundCurrency(safeValue).toFixed(2);
    const prefix = safeValue >= 0 ? "+" : "";
    return `${prefix}${signed} CHF`;
  }
  const locale = getLocaleForLanguage(lang);
  if (!signedCurrencyFormatterCache[lang]) {
    signedCurrencyFormatterCache[lang] = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "CHF",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: "always",
    });
  }
  const safeValue = Number.isFinite(value) ? value : 0;
  return signedCurrencyFormatterCache[lang].format(roundCurrency(safeValue));
}

function updateAudioUI() {
  if (volumeSlider) {
    const percent = Math.round(audioState.volume * 100);
    volumeSlider.value = String(percent);
    volumeSlider.setAttribute("aria-valuenow", String(percent));
    volumeSlider.setAttribute("aria-valuetext", formatPercent(audioState.volume));
  }
  if (volumeDisplay) {
    const percentText = formatPercent(audioState.volume);
    if (audioState.muted) {
      volumeDisplay.textContent = `${percentText} ${t(
        "settings.audio.mutedIndicator",
      )}`.trim();
    } else {
      volumeDisplay.textContent = percentText;
    }
  }
  if (muteButtonLabel) {
    muteButtonLabel.textContent = t(
      audioState.muted ? "settings.audio.unmute" : "settings.audio.mute",
    );
  }
  if (muteButtonIcon) {
    muteButtonIcon.textContent = audioState.muted ? "🔇" : "🔊";
  }
}

function setVolume(volume, { fromSlider = false } = {}) {
  const clamped = clamp(volume, 0, 1);
  const wasMuted = audioState.muted;
  audioState.volume = clamped;
  if (clamped === 0) {
    audioState.muted = true;
  } else if (fromSlider && audioState.muted) {
    audioState.muted = false;
  }
  updateSettings({ volume: audioState.volume, muted: audioState.muted });
  if (audioState.context) {
    applyMasterGain();
  }
  updateAudioUI();
  if (fromSlider && wasMuted && !audioState.muted) {
    playSound("chip");
  }
}

function toggleMute(force) {
  const shouldMute = typeof force === "boolean" ? force : !audioState.muted;
  if (!shouldMute && audioState.volume === 0) {
    audioState.volume = 0.5;
  }
  audioState.muted = shouldMute;
  updateSettings({ volume: audioState.volume, muted: audioState.muted });
  if (audioState.context) {
    applyMasterGain();
  }
  updateAudioUI();
}

function handleVolumeInput(event) {
  if (!event || !event.target) return;
  const value = clamp(Number(event.target.value) / 100, 0, 1);
  setVolume(value, { fromSlider: true });
}

function applyDiceTheme() {
  if (!diceEl) return;
  diceEl.classList.remove("dice--classic", "dice--casino");
  diceEl.classList.add(`dice--${currentDiceTheme}`);
}

function setDiceTheme(theme) {
  const normalized = theme === "casino" ? "casino" : DEFAULT_SETTINGS.diceTheme;
  if (currentDiceTheme === normalized) {
    updateSettings({ diceTheme: currentDiceTheme });
    return;
  }
  currentDiceTheme = normalized;
  updateSettings({ diceTheme: currentDiceTheme });
  applyDiceTheme();
  diceThemeInputs.forEach((input) => {
    input.checked = input.value === currentDiceTheme;
  });
}

function applyAppearanceClasses() {
  const body = document.body;
  if (!body) return;
  if (FELT_THEME_CLASSES.length) {
    body.classList.remove(...FELT_THEME_CLASSES);
  }
  if (CARD_STYLE_CLASSES.length) {
    body.classList.remove(...CARD_STYLE_CLASSES);
  }
  if (CHIP_STYLE_CLASSES.length) {
    body.classList.remove(...CHIP_STYLE_CLASSES);
  }
  if (UI_DENSITY_CLASSES.length) {
    body.classList.remove(...UI_DENSITY_CLASSES);
  }
  body.classList.add(`felt-theme-${currentFeltTheme}`);
  body.classList.add(`chip-style-${currentChipStyle}`);
  body.classList.add(`card-style-${currentCardStyle}`);
  body.classList.add(`ui-density-${currentUiDensity}`);
}

function setFeltTheme(theme) {
  const normalized = FELT_THEMES.includes(theme)
    ? theme
    : DEFAULT_SETTINGS.feltTheme;
  if (currentFeltTheme === normalized) {
    updateSettings({ feltTheme: currentFeltTheme });
    return;
  }
  currentFeltTheme = normalized;
  updateSettings({ feltTheme: currentFeltTheme });
  applyAppearanceClasses();
  feltThemeInputs.forEach((input) => {
    input.checked = input.value === currentFeltTheme;
  });
}

function setChipStyle(style) {
  const normalized = CHIP_STYLES.includes(style)
    ? style
    : DEFAULT_SETTINGS.chipStyle;
  if (currentChipStyle === normalized) {
    updateSettings({ chipStyle: currentChipStyle });
    return;
  }
  currentChipStyle = normalized;
  updateSettings({ chipStyle: currentChipStyle });
  applyAppearanceClasses();
  chipStyleInputs.forEach((input) => {
    input.checked = input.value === currentChipStyle;
  });
}

function setCardStyle(style) {
  const normalized = CARD_STYLES.includes(style)
    ? style
    : DEFAULT_SETTINGS.cardStyle;
  if (currentCardStyle === normalized) {
    updateSettings({ cardStyle: currentCardStyle });
    return;
  }
  currentCardStyle = normalized;
  updateSettings({ cardStyle: currentCardStyle });
  applyAppearanceClasses();
  cardStyleInputs.forEach((input) => {
    input.checked = input.value === currentCardStyle;
  });
}

function setUiDensity(density) {
  const normalized = UI_DENSITIES.includes(density)
    ? density
    : DEFAULT_SETTINGS.uiDensity;
  if (currentUiDensity === normalized) {
    updateSettings({ uiDensity: currentUiDensity });
    return;
  }
  currentUiDensity = normalized;
  updateSettings({ uiDensity: currentUiDensity });
  applyAppearanceClasses();
  uiDensityInputs.forEach((input) => {
    input.checked = input.value === currentUiDensity;
  });
}

function getCurrentRevealProfile() {
  return REVEAL_PROFILES[currentRevealSpeed] || REVEAL_PROFILES.standard;
}

function getDefaultCardProfileName() {
  return currentRevealSpeed === "tense" ? "standard" : currentRevealSpeed;
}

function applyRevealProfileToCard(cardEl, profileName = getDefaultCardProfileName()) {
  if (!cardEl) return;
  if (REVEAL_SPEED_CLASSES.length) {
    cardEl.classList.remove(...REVEAL_SPEED_CLASSES);
  }
  const profile = REVEAL_PROFILES[profileName] || REVEAL_PROFILES.standard;
  if (profile?.cardClasses) {
    profile.cardClasses.forEach((className) => {
      if (className) {
        cardEl.classList.add(className);
      }
    });
  }
  if (profile?.animationMode !== "peel") {
    cardEl.classList.remove("card--peel-animating");
  }
  cardEl.dataset.revealProfile = profileName;
}

function applyRevealProfileToCards() {
  const defaultProfileName = getDefaultCardProfileName();
  cardElements.forEach((cardEl) => {
    if (!cardEl) return;
    const profileName =
      currentRevealSpeed === "tense" && cardEl.dataset.revealProfile === "tense"
        ? "tense"
        : defaultProfileName;
    applyRevealProfileToCard(cardEl, profileName);
  });
}

function setRevealSpeed(speed) {
  const normalized = REVEAL_SPEEDS.includes(speed)
    ? speed
    : DEFAULT_SETTINGS.revealSpeed;
  if (currentRevealSpeed === normalized) {
    updateSettings({ revealSpeed: currentRevealSpeed });
    return;
  }
  currentRevealSpeed = normalized;
  updateSettings({ revealSpeed: currentRevealSpeed });
  applyRevealProfileToCards();
  revealSpeedInputs.forEach((input) => {
    input.checked = input.value === currentRevealSpeed;
  });
}

function isSettingsOpen() {
  return Boolean(settingsPanel) && !settingsPanel.hasAttribute("hidden");
}

function openSettings() {
  if (!settingsPanel || isSettingsOpen()) return;
  lastFocusedElement =
    document.activeElement && typeof document.activeElement.focus === "function"
      ? document.activeElement
      : null;
  settingsPanel.hidden = false;
  document.body.classList.add("settings-open");
  if (settingsToggle) {
    settingsToggle.setAttribute("aria-expanded", "true");
  }
  diceThemeInputs.forEach((input) => {
    input.checked = input.value === currentDiceTheme;
  });
  diceModeInputs.forEach((input) => {
    input.checked = input.value === currentDiceMode;
  });
  feltThemeInputs.forEach((input) => {
    input.checked = input.value === currentFeltTheme;
  });
  chipStyleInputs.forEach((input) => {
    input.checked = input.value === currentChipStyle;
  });
  cardStyleInputs.forEach((input) => {
    input.checked = input.value === currentCardStyle;
  });
  uiDensityInputs.forEach((input) => {
    input.checked = input.value === currentUiDensity;
  });
  revealSpeedInputs.forEach((input) => {
    input.checked = input.value === currentRevealSpeed;
  });
  updateAudioUI();
  requestAnimationFrame(() => {
    settingsPanel.classList.add("settings-panel--open");
    if (settingsDialog) {
      settingsDialog.focus({ preventScroll: true });
    }
  });
}

function closeSettings() {
  if (!settingsPanel || settingsPanel.hasAttribute("hidden")) return;
  settingsPanel.classList.remove("settings-panel--open");
  document.body.classList.remove("settings-open");
  if (settingsToggle) {
    settingsToggle.setAttribute("aria-expanded", "false");
  }
  const finalize = () => {
    if (!settingsPanel) return;
    settingsPanel.hidden = true;
  };
  settingsPanel.addEventListener(
    "transitionend",
    (event) => {
      if (event.target === settingsPanel) {
        finalize();
      }
    },
    { once: true },
  );
  setTimeout(finalize, 240);
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }
  lastFocusedElement = null;
}

function isStatsOpen() {
  return Boolean(statsPanelContainer) && !statsPanelContainer.hasAttribute("hidden");
}

function openStats() {
  if (!statsPanelContainer || isStatsOpen()) return;
  statsFocusReturn =
    document.activeElement && typeof document.activeElement.focus === "function"
      ? document.activeElement
      : null;
  statsPanelContainer.hidden = false;
  if (statsToggle) {
    statsToggle.setAttribute("aria-expanded", "true");
  }
  updateStatsDisplay();
  requestAnimationFrame(() => {
    statsPanelContainer.classList.add("stats-panel--open");
    if (statsDialog) {
      statsDialog.focus({ preventScroll: true });
    }
  });
}

function closeStats() {
  if (!statsPanelContainer || statsPanelContainer.hasAttribute("hidden")) {
    return;
  }
  statsPanelContainer.classList.remove("stats-panel--open");
  if (statsToggle) {
    statsToggle.setAttribute("aria-expanded", "false");
  }
  const finalize = () => {
    if (!statsPanelContainer) return;
    statsPanelContainer.hidden = true;
  };
  statsPanelContainer.addEventListener(
    "transitionend",
    (event) => {
      if (event.target === statsPanelContainer) {
        finalize();
      }
    },
    { once: true },
  );
  window.setTimeout(finalize, 260);
  if (statsFocusReturn && typeof statsFocusReturn.focus === "function") {
    statsFocusReturn.focus();
  }
  statsFocusReturn = null;
}

function isHistoryOpen() {
  return Boolean(historyPanel) && !historyPanel.hasAttribute("hidden");
}

function openHistory() {
  if (!historyPanel || isHistoryOpen()) return;
  historyFocusReturn =
    document.activeElement && typeof document.activeElement.focus === "function"
      ? document.activeElement
      : null;
  historyPanel.hidden = false;
  if (historyToggle) {
    historyToggle.setAttribute("aria-expanded", "true");
  }
  renderFullHistory();
  requestAnimationFrame(() => {
    historyPanel.classList.add("history-panel--open");
    if (historyDialog) {
      historyDialog.focus({ preventScroll: true });
    }
  });
}

function closeHistory() {
  if (!historyPanel || historyPanel.hasAttribute("hidden")) {
    return;
  }
  historyPanel.classList.remove("history-panel--open");
  if (historyToggle) {
    historyToggle.setAttribute("aria-expanded", "false");
  }
  const finalize = () => {
    if (!historyPanel) return;
    historyPanel.hidden = true;
  };
  historyPanel.addEventListener(
    "transitionend",
    (event) => {
      if (event.target === historyPanel) {
        finalize();
      }
    },
    { once: true },
  );
  window.setTimeout(finalize, 260);
  if (historyFocusReturn && typeof historyFocusReturn.focus === "function") {
    historyFocusReturn.focus();
  }
  historyFocusReturn = null;
}

function formatBetChipLabel(value) {
  return formatPlainNumber(value);
}

function renderBetAmount(spot, amount) {
  const amountEl = spot.querySelector(".bet-amount");
  if (!amountEl) return;

  amountEl.innerHTML = "";
  const normalized = roundCurrency(amount);
  if (normalized > 0) {
    const chipEl = document.createElement("div");
    chipEl.className = "bet-chip";
    chipEl.textContent = formatBetChipLabel(normalized);
    amountEl.appendChild(chipEl);
    spot.classList.add("has-bet");
  } else {
    spot.classList.remove("has-bet");
  }
}

function refreshDisplayedBets() {
  betSpots.forEach((spot) => {
    const key = spotKey(spot);
    const amount = currentBets.get(key) || 0;
    renderBetAmount(spot, amount);
  });
}

function updateWinningCardHints() {
  if (!winningHintsBody) {
    return;
  }

  if (!winningHintsEnabled) {
    winningHintsBody.innerHTML = "";
    setWinningHintsBarVisibility(false);
    return;
  }

  const betEntries = Array.from(currentBets.entries());
  if (betEntries.length === 0) {
    winningHintsBody.innerHTML = "";
    const placeholder = document.createElement("p");
    placeholder.className = "winning-hints__empty";
    placeholder.textContent = t("winningHints.placeholder");
    winningHintsBody.appendChild(placeholder);
    if (winningHintsPanel) {
      winningHintsPanel.classList.add("winning-hints--compact");
    }
    setWinningHintsBarVisibility(true);
    refreshWinningHintsOffset();
    return;
  }

  const hints = [];

  HINT_PREVIEW_CARDS.forEach((templateCard) => {
    const card = cloneCard(templateCard);
    let totalPayout = 0;
    const betDetails = [];

    betEntries.forEach(([rawKey, amount]) => {
      if (!Number.isFinite(amount) || amount <= 0) {
        return;
      }
      const [betType, betKey] = rawKey.split(":");
      if (!SINGLE_CARD_BET_TYPES.has(betType)) {
        return;
      }
      if (betType === "high_low_previous" && (!lastWinningCard || !lastWinningCard.suit)) {
        return;
      }

      const outcome = resolveBet(
        betType,
        betKey,
        amount,
        [card],
        0,
        null,
        lastWinningCard,
      );

      if (outcome.type === "win") {
        const payout = roundCurrency(amount + outcome.profit);
        if (payout > 0) {
          totalPayout = roundCurrency(totalPayout + payout);
          betDetails.push({
            label: describeBet(betType, betKey),
            payout,
          });
        }
      }
    });

    if (totalPayout > 0 && betDetails.length) {
      hints.push({ card, payout: totalPayout, bets: betDetails });
    }
  });

  winningHintsBody.innerHTML = "";

  if (!hints.length) {
    const empty = document.createElement("p");
    empty.className = "winning-hints__empty";
    empty.textContent = t("winningHints.none");
    winningHintsBody.appendChild(empty);
    if (winningHintsPanel) {
      winningHintsPanel.classList.add("winning-hints--compact");
    }
    setWinningHintsBarVisibility(true);
    refreshWinningHintsOffset();
    return;
  }

  if (winningHintsPanel) {
    winningHintsPanel.classList.remove("winning-hints--compact");
  }
  hints.sort((a, b) => b.payout - a.payout);

  const list = document.createElement("ul");
  list.className = "winning-hints__list";

  hints.forEach((hint) => {
    const item = document.createElement("li");
    item.className = "winning-hints__item";

    const cardRow = document.createElement("div");
    cardRow.className = "winning-hints__card-row";
    const cardGraphic = buildHistoryCard(hint.card, false);
    cardGraphic.setAttribute("aria-hidden", "true");
    const cardLabel = document.createElement("span");
    cardLabel.className = "winning-hints__card-label";
    cardLabel.textContent = describeCard(hint.card);
    cardRow.append(cardGraphic, cardLabel);

    const payoutEl = document.createElement("div");
    payoutEl.className = "winning-hints__payout";
    payoutEl.textContent = formatCurrencyWithSign(hint.payout);

    const betsList = document.createElement("ul");
    betsList.className = "winning-hints__bets";
    hint.bets.forEach((bet) => {
      const betItem = document.createElement("li");
      const betLabel = document.createElement("span");
      betLabel.textContent = bet.label;
      const betAmount = document.createElement("span");
      betAmount.textContent = formatCurrencyWithSign(bet.payout);
      betItem.append(betLabel, betAmount);
      betsList.appendChild(betItem);
    });

    item.append(cardRow, payoutEl, betsList);
    list.appendChild(item);
  });

  winningHintsBody.appendChild(list);
  setWinningHintsBarVisibility(true);
  refreshWinningHintsOffset();
}

function setWinningHintsEnabled(enabled, { persist = false } = {}) {
  winningHintsEnabled = Boolean(enabled);
  if (persist) {
    updateSettings({ showWinningHints: winningHintsEnabled });
  } else {
    settingsState.showWinningHints = winningHintsEnabled;
  }

  if (winningHintsToggle) {
    winningHintsToggle.checked = winningHintsEnabled;
  }
  if (winningHintsPanel) {
    winningHintsPanel.setAttribute(
      "aria-hidden",
      winningHintsEnabled ? "false" : "true",
    );
  }
  document.body.classList.toggle("hide-winning-hints", !winningHintsEnabled);
  if (!winningHintsEnabled) {
    setWinningHintsBarVisibility(false);
    if (winningHintsPanel) {
      winningHintsPanel.classList.remove("winning-hints--compact");
    }
  }
  updateWinningCardHints();
}

function updateChipButtonLabels(lang = currentLanguage) {
  chipButtons.forEach((button) => {
    const value = Number.parseFloat(button.dataset.value);
    if (Number.isNaN(value)) return;
    button.textContent = formatPlainNumber(value, lang);
  });
}

function triggerFlash(element) {
  if (!element) return;
  element.classList.remove("bankroll-card--flash");
  // Force reflow to restart animation
  void element.offsetWidth; // eslint-disable-line no-unused-expressions
  element.classList.add("bankroll-card--flash");
  window.setTimeout(() => {
    element.classList.remove("bankroll-card--flash");
  }, 1100);
}

function setWinningHintsBarVisibility(visible) {
  const shouldShow = Boolean(visible && winningHintsEnabled);
  if (shouldShow === winningHintsBarActive) {
    return;
  }
  winningHintsBarActive = shouldShow;
  document.body.classList.toggle("winning-hints-bar-visible", shouldShow);
  if (shouldShow) {
    refreshWinningHintsOffset();
  } else {
    document.body.style.setProperty("--winning-hints-offset", "0px");
  }
}

function updateWinningHintsOffset() {
  if (!winningHintsPanel) return;
  const height = winningHintsPanel.offsetHeight;
  const offset = Math.ceil(height + 24);
  document.body.style.setProperty("--winning-hints-offset", `${offset}px`);
}

function refreshWinningHintsOffset() {
  if (!winningHintsBarActive || !winningHintsPanel) {
    return;
  }
  window.requestAnimationFrame(() => {
    updateWinningHintsOffset();
  });
}

function launchConfetti() {
  if (!confettiLayer) return;
  if (confettiTimeout) {
    window.clearTimeout(confettiTimeout);
    confettiTimeout = null;
  }
  confettiLayer.innerHTML = "";
  const pieces = 42;
  for (let index = 0; index < pieces; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    const hue = Math.floor(Math.random() * 360);
    const duration = 2200 + Math.random() * 1200;
    const delay = Math.random() * 160;
    const width = 0.35 + Math.random() * 0.35;
    const height = 0.9 + Math.random() * 0.8;
    piece.style.setProperty("--confetti-x", `${Math.random() * 100}%`);
    piece.style.setProperty("--confetti-hue", `${hue}`);
    piece.style.setProperty("--confetti-duration", `${duration}ms`);
    piece.style.setProperty("--confetti-delay", `${delay}ms`);
    piece.style.setProperty("--confetti-rotation", `${Math.random() * 360}deg`);
    piece.style.setProperty("--confetti-width", `${width}rem`);
    piece.style.setProperty("--confetti-height", `${height}rem`);
    confettiLayer.appendChild(piece);
  }
  confettiLayer.classList.add("confetti-layer--active");
  confettiTimeout = window.setTimeout(() => {
    if (confettiLayer) {
      confettiLayer.classList.remove("confetti-layer--active");
      confettiLayer.innerHTML = "";
    }
    confettiTimeout = null;
  }, 3200);
}

function stopConfetti(immediate = false) {
  if (!confettiLayer) return;
  if (confettiTimeout) {
    window.clearTimeout(confettiTimeout);
    confettiTimeout = null;
  }
  if (immediate) {
    confettiLayer.classList.remove("confetti-layer--active");
    confettiLayer.innerHTML = "";
    return;
  }
  window.setTimeout(() => {
    if (confettiLayer) {
      confettiLayer.classList.remove("confetti-layer--active");
      confettiLayer.innerHTML = "";
    }
  }, 280);
}

function isWinPopupVisible() {
  return Boolean(winBannerEl) && winBannerEl.classList.contains("win-banner--visible");
}

function showWinPopup(amount) {
  if (!winBannerEl) return;
  if (winBannerTimeout) {
    window.clearTimeout(winBannerTimeout);
    winBannerTimeout = null;
  }
  if (winBannerAmountEl) {
    winBannerAmountEl.textContent = formatCurrencyWithSign(amount);
  }
  winBannerEl.hidden = false;
  winBannerEl.classList.add("win-banner--visible");
  launchConfetti();
  winBannerTimeout = window.setTimeout(() => {
    winBannerTimeout = null;
    hideWinPopup();
  }, 5000);
}

function hideWinPopup(immediate = false) {
  if (!winBannerEl) return;
  if (winBannerTimeout) {
    window.clearTimeout(winBannerTimeout);
    winBannerTimeout = null;
  }
  stopConfetti(immediate);
  if (immediate) {
    winBannerEl.classList.remove("win-banner--visible");
    winBannerEl.hidden = true;
    return;
  }
  winBannerEl.classList.remove("win-banner--visible");
  window.setTimeout(() => {
    if (winBannerEl && !winBannerEl.classList.contains("win-banner--visible")) {
      winBannerEl.hidden = true;
    }
  }, 320);
}

function initializeBetVisuals() {
  betSpots.forEach((spot) => {
    const button = spot.querySelector("button");
    if (!button) return;
    if (button.querySelector(".bet-button__content")) {
      return;
    }

    const label = button.querySelector(".bet-label");
    const odds = button.querySelector(".bet-odds");
    const content = document.createElement("span");
    content.className = "bet-button__content";
    if (label) content.appendChild(label);
    if (odds) content.appendChild(odds);

    const visual = buildBetVisual(spot.dataset.betType, spot.dataset.betKey);
    if (visual) {
      button.appendChild(visual);
    }
    button.appendChild(content);
  });
}

function buildBetVisual(type, key) {
  if (!type) return null;
  const visual = createVisualContainer();
  switch (type) {
    case "color": {
      visual.classList.add("bet-visual--stack");
      if (key === "red") {
        visual.append(createVisualIcon("♥", "bet-visual-icon bet-visual-icon--red"));
        visual.append(createVisualIcon("♦", "bet-visual-icon bet-visual-icon--red"));
      } else if (key === "black") {
        visual.append(createVisualIcon("♣", "bet-visual-icon bet-visual-icon--black"));
        visual.append(createVisualIcon("♠", "bet-visual-icon bet-visual-icon--black"));
      }
      break;
    }
    case "suit": {
      const suitMeta = {
        hearts: { symbol: "♥", color: "red" },
        diamonds: { symbol: "♦", color: "red" },
        clubs: { symbol: "♣", color: "black" },
        spades: { symbol: "♠", color: "black" },
      };
      const suit = suitMeta[key];
      if (suit) {
        visual.append(createMiniCard(suit.symbol, { color: suit.color, wide: true }));
      }
      break;
    }
    case "number": {
      const numbers = RANKS.filter((rank) => NUMBER_RANKS.has(rank));
      numbers.forEach((rank, index) => {
        visual.append(
          createMiniCard(rank, {
            color: index % 2 === 0 ? "red" : "black",
            wide: rank.length > 1,
          }),
        );
      });
      break;
    }
    case "face": {
      const faces = ["J", "Q", "K", "A"];
      faces.forEach((rank, index) => {
        visual.append(
          createMiniCard(rank, {
            color: index % 2 === 0 ? "red" : "black",
          }),
        );
      });
      break;
    }
    case "high_low_seven": {
      visual.classList.add("bet-visual--stack");
      const arrowSymbol = key === "higher" ? "↑" : "↓";
      const arrow = createVisualIcon(
        arrowSymbol,
        "bet-visual-icon bet-visual-icon--accent",
      );
      const sevenCard = createMiniCard("7", {
        color: key === "higher" ? "red" : "black",
        wide: true,
      });
      if (key === "higher") {
        visual.append(arrow, sevenCard);
      } else {
        visual.append(sevenCard, arrow);
      }
      break;
    }
    case "high_low_previous": {
      visual.classList.add("bet-visual--stack");
      const arrowSymbol = key === "higher" ? "↑" : "↓";
      const arrow = createVisualIcon(
        arrowSymbol,
        "bet-visual-icon bet-visual-icon--accent",
      );
      const prevCard = createMiniCard("?", { color: "black" });
      const winningCard = createMiniCard("★", { color: "joker" });
      if (key === "higher") {
        visual.append(prevCard, arrow, winningCard);
      } else {
        visual.append(winningCard, arrow, prevCard);
      }
      break;
    }
    case "rank_exact": {
      const wide = typeof key === "string" && key.length > 1;
      visual.append(createMiniCard(key, { color: "red", wide }));
      visual.append(createMiniCard(key, { color: "black", wide }));
      break;
    }
    case "pair": {
      addMiniCards(visual, [
        { label: "A", color: "red" },
        { label: "A", color: "black" },
      ]);
      break;
    }
    case "two_pair": {
      addMiniCards(visual, [
        { label: "K", color: "red" },
        { label: "K", color: "black" },
        { label: "9", color: "red" },
        { label: "9", color: "black" },
      ]);
      break;
    }
    case "drill": {
      addMiniCards(visual, [
        { label: "Q", color: "red" },
        { label: "Q", color: "black" },
        { label: "Q", color: "red" },
      ]);
      break;
    }
    case "straight": {
      addMiniCards(visual, buildSequence(["5", "6", "7", "8", "9"]));
      break;
    }
    case "flush": {
      addMiniCards(
        visual,
        Array.from({ length: 5 }, () => ({ label: "♥", color: "red" })),
      );
      break;
    }
    case "full_house": {
      addMiniCards(visual, [
        { label: "A", color: "red" },
        { label: "A", color: "black" },
        { label: "A", color: "red" },
        { label: "K", color: "black" },
        { label: "K", color: "red" },
      ]);
      break;
    }
    case "poker": {
      addMiniCards(visual, [
        { label: "J", color: "red" },
        { label: "J", color: "black" },
        { label: "J", color: "red" },
        { label: "J", color: "black" },
      ]);
      break;
    }
    case "straight_flush": {
      addMiniCards(visual, buildSequence(["5", "6", "7", "8", "9"], "red"));
      break;
    }
    case "royal_flush": {
      addMiniCards(visual, buildSequence(["10", "J", "Q", "K", "A"], "red"));
      break;
    }
    case "joker": {
      visual.append(createMiniCard("★", { color: "joker", wide: true }));
      break;
    }
    default:
      break;
  }

  return visual.childElementCount > 0 ? visual : null;
}

function buildSequence(ranks, mode = "alternating") {
  return ranks.map((rank, index) => ({
    label: rank,
    color:
      mode === "alternating"
        ? index % 2 === 0
          ? "red"
          : "black"
        : mode,
    wide: rank.length > 1,
  }));
}

function createVisualContainer(className = "bet-visual") {
  const visual = document.createElement("span");
  visual.className = className;
  visual.setAttribute("aria-hidden", "true");
  return visual;
}

function createVisualIcon(symbol, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = symbol;
  span.setAttribute("aria-hidden", "true");
  return span;
}

function createMiniCard(label, { color = "black", wide = false } = {}) {
  const card = document.createElement("span");
  card.className = "mini-card";
  if (color === "red") {
    card.classList.add("mini-card--red");
  } else if (color === "joker") {
    card.classList.add("mini-card--joker");
  } else {
    card.classList.add("mini-card--black");
  }
  if (wide || (typeof label === "string" && label.length > 1)) {
    card.classList.add("mini-card--long");
  }
  card.textContent = label;
  card.setAttribute("aria-hidden", "true");
  return card;
}

function addMiniCards(visual, cards) {
  cards.forEach((card) => {
    visual.append(createMiniCard(card.label, card));
  });
}

function placeBet(spot) {
  if (roundLocked) return;
  if (!selectedChip) {
    addLog("messages.selectChip");
    return;
  }
  if (selectedChip > currentAvailable()) {
    addLog("messages.insufficientFunds");
    return;
  }

  const key = spotKey(spot);
  const currentAmount = currentBets.get(key) || 0;
  const newAmount = roundCurrency(currentAmount + selectedChip);
  currentBets.set(key, newAmount);
  currentBetTotal = roundCurrency(currentBetTotal + selectedChip);
  renderBetAmount(spot, newAmount);
  updateDisplays();
  playSound("chip");
  updateBetToolAvailability();
  updateWinningCardHints();
  updateStakingStatus();
}

function clearSpot(spot) {
  if (roundLocked) return;
  const key = spotKey(spot);
  const currentAmount = currentBets.get(key);
  if (!currentAmount) return;
  currentBetTotal = roundCurrency(currentBetTotal - currentAmount);
  currentBets.delete(key);
  renderBetAmount(spot, 0);
  updateDisplays();
  updateBetToolAvailability();
  updateWinningCardHints();
  updateStakingStatus();
}

function clearAllBets() {
  if (roundLocked) return;
  currentBetTotal = 0;
  currentBets.clear();
  betSpots.forEach((spot) => {
    renderBetAmount(spot, 0);
  });
  updateDisplays();
  updateBetToolAvailability();
  updateWinningCardHints();
  updateStakingStatus();
}

function spotKey(spot) {
  const type = spot.dataset.betType;
  const key = spot.dataset.betKey;
  return `${type}:${key}`;
}

betSpots.forEach((spot) => {
  const clearButton = spot.querySelector(".clear-spot");

  spot.addEventListener("click", (event) => {
    if (event.target.closest(".clear-spot")) {
      return;
    }
    placeBet(spot);
  });

  if (clearButton) {
    clearButton.addEventListener("click", (event) => {
      event.stopPropagation();
      clearSpot(spot);
    });
  }
});

if (clearAllButton) {
  clearAllButton.addEventListener("click", clearAllBets);
}

if (repeatBetButton) {
  repeatBetButton.addEventListener("click", () => {
    reapplyPreviousBets();
  });
}

if (doubleBetButton) {
  doubleBetButton.addEventListener("click", () => {
    doubleExistingBets();
  });
}

stakingModeInputs.forEach((input) => {
  input.addEventListener("change", (event) => {
    setStakingMode(event.target.value);
  });
});

[
  autoLossInput,
  autoWinInput,
  autoStopLossInput,
  autoStopWinInput,
].forEach((input) => {
  if (!input) return;
  input.addEventListener("change", handleAutoInputChange);
  input.addEventListener("input", handleAutoInputChange);
});

if (settingsToggle) {
  settingsToggle.addEventListener("click", () => {
    if (isSettingsOpen()) {
      closeSettings();
    } else {
      openSettings();
    }
  });
}

if (settingsPanel) {
  settingsPanel.addEventListener("click", (event) => {
    if (event.target && event.target.closest("[data-settings-close]")) {
      closeSettings();
    }
  });
}

if (statsToggle) {
  statsToggle.addEventListener("click", () => {
    if (isStatsOpen()) {
      closeStats();
    } else {
      openStats();
    }
  });
}

if (statsPanelContainer) {
  statsPanelContainer.addEventListener("click", (event) => {
    if (event.target && event.target.closest("[data-stats-close]")) {
      closeStats();
    }
  });
}

if (historyToggle) {
  historyToggle.addEventListener("click", () => {
    if (isHistoryOpen()) {
      closeHistory();
    } else {
      openHistory();
    }
  });
}

if (historyPanel) {
  historyPanel.addEventListener("click", (event) => {
    if (event.target && event.target.closest("[data-history-close]")) {
      closeHistory();
    }
  });
}


document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    if (isSettingsOpen()) {
      event.preventDefault();
      closeSettings();
      return;
    }
    if (isHistoryOpen()) {
      event.preventDefault();
      closeHistory();
      return;
    }
    if (isStatsOpen()) {
      event.preventDefault();
      closeStats();
      return;
    }
    if (isWinPopupVisible()) {
      event.preventDefault();
      hideWinPopup();
    }
  }
});

diceThemeInputs.forEach((input) => {
  input.checked = input.value === currentDiceTheme;
  input.addEventListener("change", (event) => {
    if (event.target && event.target.checked) {
      setDiceTheme(event.target.value);
    }
  });
});

diceModeInputs.forEach((input) => {
  input.checked = input.value === currentDiceMode;
  input.addEventListener("change", (event) => {
    if (event.target && event.target.checked) {
      setDiceMode(event.target.value);
    }
  });
});

feltThemeInputs.forEach((input) => {
  input.checked = input.value === currentFeltTheme;
  input.addEventListener("change", (event) => {
    if (event.target && event.target.checked) {
      setFeltTheme(event.target.value);
    }
  });
});

chipStyleInputs.forEach((input) => {
  input.checked = input.value === currentChipStyle;
  input.addEventListener("change", (event) => {
    if (event.target && event.target.checked) {
      setChipStyle(event.target.value);
    }
  });
});

cardStyleInputs.forEach((input) => {
  input.checked = input.value === currentCardStyle;
  input.addEventListener("change", (event) => {
    if (event.target && event.target.checked) {
      setCardStyle(event.target.value);
    }
  });
});

uiDensityInputs.forEach((input) => {
  input.checked = input.value === currentUiDensity;
  input.addEventListener("change", (event) => {
    if (event.target && event.target.checked) {
      setUiDensity(event.target.value);
    }
  });
});

revealSpeedInputs.forEach((input) => {
  input.checked = input.value === currentRevealSpeed;
  input.addEventListener("change", (event) => {
    if (event.target && event.target.checked) {
      setRevealSpeed(event.target.value);
    }
  });
});

if (winningHintsToggle) {
  winningHintsToggle.checked = winningHintsEnabled;
  winningHintsToggle.addEventListener("change", (event) => {
    setWinningHintsEnabled(Boolean(event.target.checked), { persist: true });
  });
}

if (volumeSlider) {
  const percent = Math.round(audioState.volume * 100);
  volumeSlider.value = String(percent);
  volumeSlider.setAttribute("aria-valuenow", String(percent));
  volumeSlider.setAttribute("aria-valuetext", formatPercent(audioState.volume));
  volumeSlider.addEventListener("input", handleVolumeInput);
}

if (muteButton) {
  muteButton.addEventListener("click", () => {
    toggleMute();
  });
}

if (dealButton) {
  dealButton.addEventListener("click", () => {
    if (roundLocked) {
      if (roundComplete) {
        prepareNextRound();
      }
      return;
    }
    if (currentBetTotal <= 0) {
      addLog("messages.betRequired");
      return;
    }
    if (currentBetTotal > bankroll) {
      addLog("messages.betTooLarge");
      return;
    }
    startRound();
  });
}

window.addEventListener("resize", () => {
  if (winningHintsBarActive) {
    refreshWinningHintsOffset();
  }
});

function prepareNextRound() {
  clearAutoResetTimer();
  hideWinPopup(true);
  resetResultsSummaryState();
  roundLocked = false;
  roundComplete = false;
  if (dealButton) {
    dealButton.disabled = false;
  }
  setDealButtonLabel("actions.deal");
  resetCards();
  resetDice({ immediate: true });
  resetLog();
  setBetBreakdownPlaceholder("results.betOutcomePlaceholder");
  clearAllBets();
  applyAutoPendingBets();
}

async function startRound() {
  hideWinPopup(true);
  clearAutoResetTimer();
  roundLocked = true;
  roundComplete = false;
  if (dealButton) {
    dealButton.disabled = true;
  }
  setDealButtonLabel("actions.dealing");
  setBetBreakdownPlaceholder("round.inProgress");
  setResultsSummaryPending();
  updateBetToolAvailability();
  const previousWinningCard = lastWinningCard;
  const deck = buildDeck();
  shuffleDeck(deck);
  const cards = dealCards(deck, 5);
  const isPlayerMode = currentDiceMode === DICE_MODES.PLAYER;
  const shouldAutoReveal = !isPlayerMode && currentRevealSpeed !== "tense";
  displayCards(cards, { autoReveal: shouldAutoReveal, selectable: isPlayerMode });
  const revealPendingCards = (winningIdx, options = {}) => {
    if (shouldAutoReveal) return;
    const pending = cardElements.some((cardEl) =>
      cardEl && cardEl.classList.contains("card--face-down"),
    );
    if (!pending) {
      return;
    }
    revealCardsForResolution(winningIdx, options);
  };
  const betEntries = Array.from(currentBets.entries());
  const totalWager = currentBetTotal;
  if (betEntries.length) {
    lastBetSnapshot = new Map(betEntries);
    lastBetTotal = roundCurrency(totalWager);
  }
  const breakdownEntries = [];
  const pendingLogs = [];
  const queueLog = (key, params = {}) => {
    pendingLogs.push({ key, params: { ...params } });
  };
  let pokerResults = null;

  let winnings = 0;
  let winningPayoutTotal = 0;
  let winningIndex = null;
  let winningCardForNextRound = previousWinningCard;
  const resolution = {
    mode: isPlayerMode ? DICE_MODES.PLAYER : DICE_MODES.RANDOM,
    value: null,
    type: null,
    winningIndex: null,
  };

  if (isPlayerMode) {
    setDiceText("dice.playerPrompt");
    const selectedIndex = await waitForPlayerSelection();
    const selectedPosition = selectedIndex + 1;
    resolution.value = selectedPosition;
    resolution.type = "selection";
    resolution.winningIndex = selectedIndex;
    playSound("dice");
    setDiceTransform(DICE_TRANSFORMS[selectedPosition] ?? DICE_TRANSFORMS[1]);
    setDiceText("dice.playerResult", { value: selectedPosition });
    winningIndex = selectedIndex;
    const winningCard = cards[selectedIndex];
    addLog("logs.playerChoice", {
      position: selectedPosition,
    });
    queueLog("logs.winningCard", {
      position: selectedPosition,
      card: cloneCard(winningCard),
    });
    markWinningCard(selectedIndex);
    recordWinningCard(winningCard);
    winningCardForNextRound = winningCard && winningCard.suit ? winningCard : null;
    pokerResults = evaluatePokerCombinations(cards);

    betEntries.forEach(([key, amount]) => {
      const [betType, betKey] = key.split(":");
      const outcome = resolveBet(
        betType,
        betKey,
        amount,
        cards,
        selectedIndex,
        pokerResults,
        previousWinningCard,
      );
      if (outcome.type === "win") {
        const payout = roundCurrency(amount + outcome.profit);
        winnings = roundCurrency(winnings + payout);
        winningPayoutTotal = roundCurrency(winningPayoutTotal + payout);
        breakdownEntries.push({
          status: "win",
          betType,
          betKey,
          amount,
          profit: outcome.profit,
          payout,
        });
        queueLog("logs.betWin", {
          betType,
          betKey,
          payout,
          profit: outcome.profit,
          amount,
        });
      } else if (outcome.type === "push") {
        winnings = roundCurrency(winnings + amount);
        breakdownEntries.push({
          status: "push",
          betType,
          betKey,
          amount,
          profit: 0,
          payout: amount,
        });
        queueLog("logs.betPush", { betType, betKey, amount });
      } else {
        breakdownEntries.push({
          status: "loss",
          betType,
          betKey,
          amount,
          profit: 0,
          payout: 0,
        });
        queueLog("logs.betLoss", { betType, betKey });
      }
    });
  } else {
    const dieResult = rollDie();
    resolution.value = dieResult;
    const diceAnimation = displayDie(dieResult);
    await diceAnimation;

    if (dieResult === 6) {
      resolution.type = "push";
      winnings = totalWager;
      addLog("logs.rollSix");
      markWinningCard(null);
      revealPendingCards(null, { initialDelay: 120 });
      betEntries.forEach(([key, amount]) => {
        const [betType, betKey] = key.split(":");
        breakdownEntries.push({
          status: "push",
          betType,
          betKey,
          amount,
          profit: 0,
          payout: amount,
        });
      });
    } else {
      resolution.type = "roll";
      winningIndex = dieResult - 1;
      resolution.winningIndex = winningIndex;
      const winningCard = cards[winningIndex];
      addLog("logs.roll", { value: dieResult });
      queueLog("logs.winningCard", { position: dieResult, card: cloneCard(winningCard) });
      markWinningCard(winningIndex);
      revealPendingCards(winningIndex, { initialDelay: 120 });
      recordWinningCard(winningCard);
      winningCardForNextRound = winningCard && winningCard.suit ? winningCard : null;
      pokerResults = evaluatePokerCombinations(cards);

      betEntries.forEach(([key, amount]) => {
        const [betType, betKey] = key.split(":");
        const outcome = resolveBet(
          betType,
          betKey,
          amount,
          cards,
          winningIndex,
          pokerResults,
          previousWinningCard,
        );
        if (outcome.type === "win") {
          const payout = roundCurrency(amount + outcome.profit);
          winnings = roundCurrency(winnings + payout);
          winningPayoutTotal = roundCurrency(winningPayoutTotal + payout);
          breakdownEntries.push({
            status: "win",
            betType,
            betKey,
            amount,
            profit: outcome.profit,
            payout,
          });
          queueLog("logs.betWin", {
            betType,
            betKey,
            payout,
            profit: outcome.profit,
            amount,
          });
        } else if (outcome.type === "push") {
          winnings = roundCurrency(winnings + amount);
          breakdownEntries.push({
            status: "push",
            betType,
            betKey,
            amount,
            profit: 0,
            payout: amount,
          });
          queueLog("logs.betPush", { betType, betKey, amount });
        } else {
          breakdownEntries.push({
            status: "loss",
            betType,
            betKey,
            amount,
            profit: 0,
            payout: 0,
          });
          queueLog("logs.betLoss", { betType, betKey });
        }
      });
    }
  }

  const resolvedWinningIndex =
    typeof resolution.winningIndex === "number" ? resolution.winningIndex : winningIndex;

  const winningSpots = computeWinningBetSpots({
    cards,
    winningIndex: resolvedWinningIndex,
    pokerResults,
    previousWinningCard,
  });

  await waitForWinningCardReveal(resolvedWinningIndex);

  if (pendingLogs.length) {
    pendingLogs.forEach((entry) => addLog(entry.key, entry.params));
    pendingLogs.length = 0;
  }

  renderBetBreakdown(breakdownEntries, { resolution, winningSpots });
  bankroll = roundCurrency(bankroll - totalWager + winnings);
  const netGain = roundCurrency(winnings - totalWager);
  const totalWinningPayout = roundCurrency(winningPayoutTotal);
  const summaryWinningCard =
    typeof resolvedWinningIndex === "number" ? cards[resolvedWinningIndex] : null;
  const summaryPokerKey = determineBestPokerHandKey(pokerResults);
  const summaryOutcome =
    resolution.type === "push"
      ? "push"
      : netGain > 0
      ? "win"
      : netGain < 0
      ? "loss"
      : "breakEven";
  const historyWins = breakdownEntries
    .filter((entry) => entry.status === "win")
    .map((entry) => ({
      betType: entry.betType,
      betKey: entry.betKey,
      payout: entry.payout,
    }));
  const roundHistorySummary = {
    winningCard: summaryWinningCard ? cloneCard(summaryWinningCard) : null,
    pokerHandKey: summaryPokerKey || null,
    outcome: summaryOutcome,
    amount: netGain,
    resolutionType: resolution.type || null,
    wins: historyWins,
  };
  handleAutoBetAfterRound({
    betEntries,
    netGain,
    resolutionType: resolution.type || null,
  });
  setResultsSummaryResolved({
    winningCard: summaryWinningCard,
    pokerHandKey: summaryPokerKey,
    outcome: summaryOutcome,
    amount: netGain,
    resolutionType: resolution.type,
  });
  if (netGain > 0 && totalWinningPayout > 0) {
    playSound("win");
    showWinPopup(totalWinningPayout);
  } else {
    hideWinPopup();
  }
  currentBetTotal = 0;
  currentBets = new Map();
  updateDisplays();

  resolution.winningIndex =
    typeof resolution.winningIndex === "number" ? resolution.winningIndex : winningIndex;
  addDiceHistoryEntry(cards, resolution, roundHistorySummary);

  applyHighLowPreviousReference(winningCardForNextRound);

  roundComplete = true;
  if (dealButton) {
    dealButton.disabled = false;
  }
  setDealButtonLabel("actions.next");
  scheduleAutoPrepareNextRound();
}

function buildDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  deck.push({ rank: "Joker", suit: null });
  deck.push({ rank: "Joker", suit: null });
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealCards(deck, count) {
  const dealt = [];
  for (let i = 0; i < count; i += 1) {
    dealt.push(deck.pop());
  }
  return dealt;
}

function rollDie() {
  return Math.floor(Math.random() * 6) + 1;
}

function revealCardElement(cardEl, delay = 0, profile = getCurrentRevealProfile()) {
  if (!cardEl || !cardEl.classList.contains("card--face-down")) {
    return;
  }
  window.setTimeout(() => {
    playSound("deal");
    const isPeel = profile?.animationMode === "peel";
    if (isPeel) {
      cardEl.classList.add("card--peel-animating");
    }
    cardEl.classList.remove("card--face-down");
    cardEl.classList.add("card--revealed");
    const removeDelay = Math.max(0, profile?.removeDelay ?? 800);
    window.setTimeout(() => {
      cardEl.classList.remove("card--revealed");
      if (isPeel) {
        cardEl.classList.remove("card--peel-animating");
      }
    }, removeDelay);
  }, Math.max(0, delay));
}

function revealCardsSequential(order, overrides = {}) {
  if (!Array.isArray(order)) return;
  const baseProfile = getCurrentRevealProfile();
  const profile = {
    ...baseProfile,
    ...overrides,
  };
  const startDelay = Math.max(0, profile.startDelay ?? baseProfile.startDelay ?? 0);
  const interval = Math.max(0, profile.interval ?? baseProfile.interval ?? 0);
  order.forEach((cardIndex, sequenceIndex) => {
    const cardEl = cardElements[cardIndex];
    if (!cardEl) return;
    const delay = startDelay + sequenceIndex * interval;
    revealCardElement(cardEl, delay, profile);
  });
}

function scheduleCardReveal(cardIndex, delay, profileName) {
  const cardEl = cardElements[cardIndex];
  if (!cardEl) return;
  const profile = REVEAL_PROFILES[profileName] || REVEAL_PROFILES.standard;
  applyRevealProfileToCard(cardEl, profileName);
  revealCardElement(cardEl, Math.max(0, delay), profile);
}

function revealCardsForResolution(winningIndex, options = {}) {
  const { winnerFirst = false, initialDelay = 0 } = options;
  if (!Array.isArray(cardElements) || cardElements.length === 0) {
    return;
  }
  const indices = cardElements.map((_, idx) => idx);
  const hasWinningIndex =
    typeof winningIndex === "number" && winningIndex >= 0 && winningIndex < indices.length;

  if (!hasWinningIndex) {
    revealCardsSequential(indices, { startDelay: initialDelay });
    return;
  }

  if (currentRevealSpeed !== "tense") {
    const others = indices.filter((idx) => idx !== winningIndex);
    const order = winnerFirst
      ? [winningIndex, ...others]
      : [...others, winningIndex];
    revealCardsSequential(order, { startDelay: initialDelay });
    return;
  }

  const others = indices.filter((idx) => idx !== winningIndex);
  const standardProfile = REVEAL_PROFILES.standard;
  const tenseProfile = REVEAL_PROFILES.tense;
  const baseInterval = Math.max(0, standardProfile.interval ?? 0);
  const baseStart = Math.max(
    0,
    initialDelay + (standardProfile.startDelay ?? 0),
  );

  if (winnerFirst) {
    const winnerStart = Math.max(
      0,
      initialDelay + (tenseProfile.startDelay ?? standardProfile.startDelay ?? 0),
    );
    scheduleCardReveal(winningIndex, winnerStart, "tense");
    let delay = winnerStart + (tenseProfile.interval ?? baseInterval);
    others.forEach((idx) => {
      scheduleCardReveal(idx, delay, "standard");
      delay += baseInterval;
    });
    return;
  }

  let delay = baseStart;
  others.forEach((idx) => {
    scheduleCardReveal(idx, delay, "standard");
    delay += baseInterval;
  });
  const winnerStart = delay + Math.max(0, tenseProfile.startDelay ?? 0);
  scheduleCardReveal(winningIndex, winnerStart, "tense");
}

function waitForWinningCardReveal(index) {
  if (typeof index !== "number" || index < 0 || index >= cardElements.length) {
    return Promise.resolve();
  }
  const cardEl = cardElements[index];
  if (!cardEl) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let safetyTimer = null;
    const finalize = () => {
      if (safetyTimer !== null) {
        window.clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      resolve();
    };
    const check = () => {
      const isFaceDown = cardEl.classList.contains("card--face-down");
      const isPeeling = cardEl.classList.contains("card--peel-animating");
      const isRevealing = cardEl.classList.contains("card--revealed");
      if (!isFaceDown && !isPeeling && !isRevealing) {
        finalize();
        return;
      }
      window.requestAnimationFrame(check);
    };
    safetyTimer = window.setTimeout(finalize, 8000);
    check();
  });
}

function enableCardSelection(cardEl, index) {
  if (!cardEl) return;
  cardEl.classList.add("card--selectable");
  cardEl.dataset.cardIndex = String(index);
  cardEl.tabIndex = 0;
  cardEl.setAttribute("role", "button");
  cardEl.setAttribute("aria-pressed", "false");

  cardEl.addEventListener("click", () => {
    attemptSelectCard(index);
  });

  cardEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      attemptSelectCard(index);
    }
  });
}

function waitForPlayerSelection() {
  cardSelectionActive = true;
  return new Promise((resolve) => {
    cardSelectionResolver = resolve;
    cardElements.forEach((cardEl) => {
      cardEl.classList.add("card--waiting-choice");
      cardEl.setAttribute("aria-pressed", "false");
    });
  });
}

function attemptSelectCard(index) {
  if (!cardSelectionActive) return;
  const chosen = cardElements[index];
  if (!chosen) return;
  cardSelectionActive = false;
  cardElements.forEach((cardEl, cardIndex) => {
    cardEl.classList.remove("card--waiting-choice");
    cardEl.classList.remove("card--selectable");
    cardEl.removeAttribute("tabindex");
    if (cardIndex === index) {
      cardEl.classList.add("card--chosen");
      cardEl.setAttribute("aria-pressed", "true");
    } else {
      cardEl.classList.remove("card--chosen");
      cardEl.setAttribute("aria-pressed", "false");
    }
  });

  revealCardsForResolution(index, { winnerFirst: true, initialDelay: 120 });

  if (typeof cardSelectionResolver === "function") {
    const resolver = cardSelectionResolver;
    cardSelectionResolver = null;
    resolver(index);
  }
}

function displayCards(cards, options = {}) {
  if (!cardsContainer) return;
  const { autoReveal = true, selectable = false, revealOptions = {} } = options;
  resetCards();
  cards.forEach((card, index) => {
    const cardEl = buildCardElement(card, index);
    cardsContainer.appendChild(cardEl);
    cardElements.push(cardEl);
    if (selectable) {
      enableCardSelection(cardEl, index);
    }
  });
  if (autoReveal) {
    const winningIndex =
      typeof revealOptions.winningIndex === "number" ? revealOptions.winningIndex : null;
    revealCardsForResolution(winningIndex, revealOptions);
  }
}

function buildCardElement(card, index) {
  const cardEl = document.createElement("div");
  cardEl.className = [
    "card",
    "card--face-down",
    cardColor(card) ?? "",
    cardVisualClass(card),
  ]
    .filter(Boolean)
    .join(" ");

  applyRevealProfileToCard(cardEl);

  const inner = document.createElement("div");
  inner.className = "card__inner";

  const front = buildCardFront(card);
  const back = buildCardBack();

  inner.append(front, back);
  cardEl.appendChild(inner);
  return cardEl;
}

function buildCardFront(card) {
  const front = document.createElement("div");
  front.className = "card__face card__face--front";

  const layout = document.createElement("div");
  layout.className = "card__layout";

  const topCorner = buildCardCorner(card, "top");
  const centerFace = buildCardCenter(card);
  const bottomCorner = buildCardCorner(card, "bottom");

  layout.append(topCorner, centerFace, bottomCorner);
  front.append(layout);
  return front;
}

function buildCardBack() {
  const back = document.createElement("div");
  back.className = "card__face card__face--back";

  const pattern = document.createElement("div");
  pattern.className = "card__back-pattern";
  back.appendChild(pattern);

  return back;
}

function cardVisualClass(card) {
  if (!card.suit) return "card--joker";
  return `card--${card.suit}`;
}

function buildCardCorner(card, position) {
  const corner = document.createElement("div");
  corner.className = `card__corner card__corner--${position}`;

  const rankSpan = document.createElement("span");
  rankSpan.className = "card__rank";

  const suitSpan = document.createElement("span");
  suitSpan.className = "card__suit";

  if (!card.suit) {
    corner.classList.add("card__corner--joker");
    rankSpan.textContent = "J";
    suitSpan.textContent = "★";
  } else {
    rankSpan.textContent = card.rank;
    suitSpan.textContent = cardSuitSymbol(card);
  }

  corner.append(rankSpan, suitSpan);
  return corner;
}

function buildCardCenter(card) {
  if (!card.suit) {
    const center = document.createElement("div");
    center.className = "card__center card__center--joker";
    const icon = document.createElement("div");
    icon.className = "card__joker-icon";
    icon.textContent = "★";
    const label = document.createElement("div");
    label.className = "card__joker-label";
    label.textContent = "JOKER";
    center.append(icon, label);
    return center;
  }

  if (card.rank === "A" || NUMBER_RANKS.has(card.rank)) {
    return buildPipCenter(card);
  }

  return buildFaceCardCenter(card);
}

function buildPipCenter(card) {
  const center = document.createElement("div");
  center.className = "card__center card__center--pips";

  const layoutKey = card.rank === "A" ? "A" : card.rank;
  const positions = PIP_LAYOUTS[layoutKey] || [[3, 2]];

  const pipGrid = document.createElement("div");
  pipGrid.className = `card__pips card__pips--${layoutKey}`;

  positions.forEach(([row, col]) => {
    const pip = document.createElement("span");
    pip.className = "card__pip";
    if (row > 3) {
      pip.classList.add("card__pip--flip");
    }
    pip.textContent = cardSuitSymbol(card);
    pip.style.setProperty("--row", row);
    pip.style.setProperty("--col", col);
    pipGrid.appendChild(pip);
  });

  center.appendChild(pipGrid);
  return center;
}

function buildFaceCardCenter(card) {
  const center = document.createElement("div");
  center.className = "card__center card__center--face";

  const crest = document.createElement("div");
  crest.className = "card__face-crest";
  crest.textContent = card.rank;

  const suit = document.createElement("div");
  suit.className = "card__face-suit";
  suit.textContent = cardSuitSymbol(card);

  center.append(crest, suit);
  return center;
}

function displayDie(result) {
  const isPush = result === 6;
  if (!diceEl || !diceCubeEl || !diceValueEl) {
    setDiceText(isPush ? "dice.pushResult" : "dice.result", isPush ? {} : { value: result });
    return Promise.resolve();
  }

  clearDiceTimers({ resolvePending: true });
  diceEl.classList.add("dice--rolling");
  setDiceText("dice.inProgress");
  playSound("dice");

  return new Promise((resolve) => {
    dicePendingResolver = () => {
      resolve();
      dicePendingResolver = null;
    };

    const wobbleDuration = 900;
    diceRollTimeout = window.setTimeout(() => {
      diceEl.classList.remove("dice--rolling");
      const randomTurnsX = (Math.floor(Math.random() * 6) + 2) * 90;
      const randomTurnsY = (Math.floor(Math.random() * 6) + 2) * 90;
      setDiceTransform(`rotateX(${randomTurnsX}deg) rotateY(${randomTurnsY}deg)`);

      diceFinalTimeout = window.setTimeout(() => {
        const transform = DICE_TRANSFORMS[result] ?? DICE_TRANSFORMS[1];
        setDiceTransform(transform);
        setDiceText(isPush ? "dice.pushResult" : "dice.result", isPush ? {} : { value: result });
        diceEl.classList.remove("dice--rolling");
        diceFinalTimeout = null;
        resolveDicePromise();
      }, 300);

      diceRollTimeout = null;
    }, wobbleDuration);
  });
}

function historyCardClass(card) {
  if (!card || !card.suit) {
    return "dice-history__card--joker";
  }
  return `dice-history__card--${card.suit}`;
}

function buildHistoryCard(card, isWinner) {
  const cardEl = document.createElement("span");
  cardEl.className = ["dice-history__card", historyCardClass(card)]
    .filter(Boolean)
    .join(" ");

  const rankEl = document.createElement("strong");
  const suitEl = document.createElement("span");

  if (!card || !card.suit) {
    rankEl.textContent = "J";
    suitEl.textContent = "★";
  } else {
    rankEl.textContent = card.rank;
    suitEl.textContent = cardSuitSymbol(card);
  }

  cardEl.append(rankEl, suitEl);

  if (isWinner) {
    cardEl.classList.add("dice-history__card--winner");
  }

  return cardEl;
}

function normalizeHistoryOutcome(outcome) {
  switch (outcome) {
    case "win":
      return "win";
    case "loss":
      return "loss";
    default:
      return "push";
  }
}

function formatHistorySummary(summary) {
  if (!summary) {
    return null;
  }
  const outcomeClass = normalizeHistoryOutcome(summary.outcome);
  let cardText;
  if (summary.resolutionType === "push") {
    cardText = t("results.summary.cardPush");
  } else if (summary.winningCard) {
    cardText = describeCard(summary.winningCard);
  } else {
    cardText = t("results.summary.cardNone");
  }

  let handText = t("results.summary.handNone");
  if (summary.pokerHandKey) {
    const labelKey = POKER_HAND_LABEL_MAP[summary.pokerHandKey];
    if (labelKey) {
      handText = t(labelKey);
    } else {
      handText = summary.pokerHandKey;
    }
  }

  const outcomeKey = summary.outcome
    ? `results.summary.outcome.${summary.outcome}`
    : "results.summary.outcome.pending";
  const outcomeText = t(outcomeKey);

  const amountValue = Number.isFinite(summary.amount) ? summary.amount : 0;
  const amountText = formatCurrencyWithSign(amountValue);

  const wins = Array.isArray(summary.wins)
    ? summary.wins.map((win) => ({
        betType: win.betType,
        betKey: win.betKey,
        payout: Number.isFinite(win.payout) ? win.payout : 0,
      }))
    : [];

  return {
    cardText,
    handText,
    outcomeText,
    amountText,
    outcomeClass,
    wins,
  };
}

function buildHistorySummaryRow(summaryData, baseClass) {
  if (!summaryData) {
    return null;
  }
  const container = document.createElement("div");
  container.className = `${baseClass}__summary`;

  function createItem(labelText, valueText, extraNode) {
    const item = document.createElement("div");
    item.className = `${baseClass}__summary-item`;
    const label = document.createElement("span");
    label.className = `${baseClass}__summary-label`;
    label.textContent = labelText;
    const value = document.createElement("span");
    value.className = `${baseClass}__summary-value`;
    value.append(document.createTextNode(valueText));
    if (extraNode) {
      value.append(extraNode);
    }
    item.append(label, value);
    return item;
  }

  const cardItem = createItem(t("results.summary.cardLabel"), summaryData.cardText);
  const handItem = createItem(t("results.summary.handLabel"), summaryData.handText);

  const deltaBase = `${baseClass}__delta`;
  const delta = document.createElement("span");
  delta.className = `${deltaBase} ${deltaBase}--${summaryData.outcomeClass}`;
  delta.textContent = summaryData.amountText;

  const outcomeItem = createItem(
    t("results.summary.outcomeLabel"),
    summaryData.outcomeText,
    delta,
  );
  outcomeItem.classList.add(`${baseClass}__summary-item--outcome`);

  container.append(cardItem, handItem, outcomeItem);
  return container;
}

function buildHistoryWinsBlock(summaryData, baseClass) {
  if (!summaryData) {
    return null;
  }

  const container = document.createElement("div");
  container.className = `${baseClass}__wins`;

  const title = document.createElement("span");
  title.className = `${baseClass}__wins-title`;
  title.textContent = t("history.summary.winsTitle");
  container.appendChild(title);

  if (!summaryData.wins.length) {
    const empty = document.createElement("div");
    empty.className = `${baseClass}__wins-empty`;
    empty.textContent = t("history.summary.noWins");
    container.appendChild(empty);
    return container;
  }

  const list = document.createElement("ul");
  list.className = `${baseClass}__wins-list`;
  summaryData.wins.forEach((win) => {
    const listItem = document.createElement("li");
    listItem.className = `${baseClass}__win`;

    const label = document.createElement("span");
    label.className = `${baseClass}__win-label`;
    label.textContent = describeBet(win.betType, win.betKey);

    const amount = document.createElement("span");
    amount.className = `${baseClass}__win-amount`;
    amount.textContent = formatCurrencyWithSign(win.payout);

    listItem.append(label, amount);
    list.appendChild(listItem);
  });

  container.appendChild(list);
  return container;
}

function renderDiceHistory() {
  if (!diceHistoryList) return;
  diceHistoryList.innerHTML = "";
  if (!diceHistoryEntries.length) {
    const item = document.createElement("li");
    item.className = "dice-history__empty";
    item.textContent = t("history.empty");
    diceHistoryList.appendChild(item);
    return;
  }

  diceHistoryEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "dice-history__item";
    const resolution = entry.resolution || {};
    const summaryData = formatHistorySummary(entry.summary);
    if (summaryData) {
      const outcomeClass =
        summaryData.outcomeClass === "push"
          ? "dice-history__item--push"
          : `dice-history__item--${summaryData.outcomeClass}`;
      item.classList.add(outcomeClass);
    } else if (resolution.type === "push") {
      item.classList.add("dice-history__item--push");
    }

    const header = document.createElement("div");
    header.className = "dice-history__header";

    const roundSpan = document.createElement("span");
    roundSpan.className = "dice-history__round";
    roundSpan.textContent = `#${entry.id}`;

    const rollSpan = document.createElement("span");
    rollSpan.className = "dice-history__roll";

    if (resolution.mode === DICE_MODES.PLAYER) {
      rollSpan.textContent = t("diceHistory.playerChoice", {
        value: resolution.value ?? "?",
      });
    } else if (resolution.type === "push") {
      rollSpan.textContent = t("diceHistory.rollSix");
    } else {
      rollSpan.textContent = t("diceHistory.roll", { value: resolution.value });
    }

    header.append(roundSpan, rollSpan);

    const summaryRow = buildHistorySummaryRow(summaryData, "dice-history");

    const cardsWrap = document.createElement("div");
    cardsWrap.className = "dice-history__cards";

    entry.cards.forEach((card, index) => {
      const isWinner =
        typeof resolution.winningIndex === "number" && index === resolution.winningIndex;
      cardsWrap.appendChild(buildHistoryCard(card, isWinner));
    });

    item.append(header);
    if (summaryRow) {
      item.appendChild(summaryRow);
    }
    item.appendChild(cardsWrap);

    const winsBlock = buildHistoryWinsBlock(summaryData, "dice-history");
    if (winsBlock) {
      item.appendChild(winsBlock);
    }

    diceHistoryList.appendChild(item);
  });
}

function renderFullHistory() {
  if (!historyFullList) return;
  historyFullList.querySelectorAll(".history-full__item").forEach((node) => node.remove());
  if (historyFullEmptyEl) {
    historyFullEmptyEl.hidden = fullHistoryEntries.length > 0;
  }
  if (!fullHistoryEntries.length) {
    return;
  }

  const fragment = document.createDocumentFragment();
  fullHistoryEntries.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "history-full__item";
    const resolution = entry.resolution || {};

    const header = document.createElement("div");
    header.className = "history-full__header";

    const roundSpan = document.createElement("span");
    roundSpan.textContent = `#${entry.id}`;

    const resultSpan = document.createElement("span");
    if (resolution.mode === DICE_MODES.PLAYER) {
      resultSpan.textContent = t("diceHistory.playerChoice", {
        value: resolution.value ?? "?",
      });
    } else if (resolution.type === "push") {
      resultSpan.textContent = t("diceHistory.rollSix");
    } else {
      resultSpan.textContent = t("diceHistory.roll", {
        value: resolution.value ?? "?",
      });
    }

    header.append(roundSpan, resultSpan);

    const summaryData = formatHistorySummary(entry.summary);
    const summaryRow = buildHistorySummaryRow(summaryData, "history-full");

    const cardsWrap = document.createElement("div");
    cardsWrap.className = "history-full__cards";
    entry.cards.forEach((card, index) => {
      const cardEl = buildHistoryCard(card, index === resolution.winningIndex);
      cardsWrap.appendChild(cardEl);
    });

    item.append(header);
    if (summaryRow) {
      item.appendChild(summaryRow);
    }
    item.appendChild(cardsWrap);

    const winsBlock = buildHistoryWinsBlock(summaryData, "history-full");
    if (winsBlock) {
      item.appendChild(winsBlock);
    }
    fragment.appendChild(item);
  });

  historyFullList.appendChild(fragment);
}

function cloneCard(card) {
  if (!card) return null;
  return { rank: card.rank, suit: card.suit };
}

function addDiceHistoryEntry(cards, resolution, summary) {
  historyCounter += 1;
  const normalizedResolution = {
    mode:
      resolution?.mode === DICE_MODES.PLAYER ? DICE_MODES.PLAYER : DICE_MODES.RANDOM,
    value:
      typeof resolution?.value === "number"
        ? resolution.value
        : typeof resolution?.winningIndex === "number"
        ? resolution.winningIndex + 1
        : null,
    type: resolution?.type ?? null,
    winningIndex:
      typeof resolution?.winningIndex === "number" ? resolution.winningIndex : null,
  };
  const entry = {
    id: historyCounter,
    cards: cards.map((card) => cloneCard(card)),
    resolution: normalizedResolution,
    summary: summary
      ? {
          winningCard: summary.winningCard ? cloneCard(summary.winningCard) : null,
          pokerHandKey: summary.pokerHandKey || null,
          outcome: summary.outcome || null,
          amount: roundCurrency(
            Number.isFinite(summary.amount) ? summary.amount : 0,
          ),
          resolutionType: summary.resolutionType || null,
          wins: Array.isArray(summary.wins)
            ? summary.wins.map((win) => ({
                betType: win.betType,
                betKey: win.betKey,
                payout: roundCurrency(
                  Number.isFinite(win.payout) ? win.payout : 0,
                ),
              }))
            : [],
        }
      : null,
  };
  diceHistoryEntries.unshift(entry);
  if (diceHistoryEntries.length > MAX_HISTORY_ITEMS) {
    diceHistoryEntries.length = MAX_HISTORY_ITEMS;
  }
  fullHistoryEntries.unshift(entry);
  renderDiceHistory();
  renderFullHistory();
}

function cardColor(card) {
  if (!card.suit) return null;
  return card.suit === "hearts" || card.suit === "diamonds" ? "red" : "black";
}

function cardSuitSymbol(card) {
  if (!card.suit) return "★";
  const symbols = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };
  return symbols[card.suit];
}

function describeCard(card) {
  if (!card || !card.suit) return t("cards.joker");
  return `${card.rank} ${cardSuitSymbol(card)}`;
}

function describeBet(type, key) {
  if (type === "rank_exact") {
    const label = t(`bets.rankExact.${key}`);
    return t("bets.describe.rank_exact", { label });
  }
  const translated = t(`bets.describe.${type}.${key}`);
  if (translated && translated !== `bets.describe.${type}.${key}`) {
    return translated;
  }
  return `${type} (${key})`;
}

function evaluatePokerCombinations(cards) {
  const ranks = cards.map((card) => card.rank);
  const suits = cards.filter((card) => card.suit).map((card) => card.suit);
  const rankCounts = new Map();

  for (const rank of ranks) {
    rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1);
  }
  const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);
  const hasPair = counts.includes(2);
  const pairCount = counts.filter((count) => count === 2).length;
  const hasTwoPair = pairCount >= 2;
  const hasThree = counts.includes(3);
  const hasFour = counts.includes(4);
  const hasFullHouse = hasThree && hasPair;
  const hasFlush = suits.length === 5 && new Set(suits).size === 1;

  let hasStraight = false;
  let straightValues = null;
  const nonJoker = cards.filter((card) => card.suit);
  if (nonJoker.length === 5) {
    straightValues = nonJoker
      .map((card) => RANK_ORDER[card.rank])
      .sort((a, b) => a - b);
    hasStraight = straightValues.every((value, idx) => {
      if (idx === 0) return true;
      return value - straightValues[idx - 1] === 1;
    });
  }

  const hasStraightFlush = hasStraight && hasFlush;
  const hasRoyalFlush =
    hasStraightFlush &&
    Array.isArray(straightValues) &&
    straightValues.length === 5 &&
    straightValues[0] === 10 &&
    straightValues[straightValues.length - 1] === 14;

  return {
    pair: hasPair,
    two_pair: hasTwoPair,
    drill: hasThree,
    straight: hasStraight,
    flush: hasFlush,
    full_house: hasFullHouse,
    poker: hasFour,
    straight_flush: hasStraightFlush,
    royal_flush: hasRoyalFlush,
  };
}

function getPayoutMultiplier(betType, betKey) {
  if (betType === "high_low_previous") {
    const dynamic = highLowPreviousState.payouts[betKey];
    if (typeof dynamic === "number" && !Number.isNaN(dynamic)) {
      return dynamic;
    }
  }
  return PAYOUTS[betType];
}

function resolveBet(
  betType,
  betKey,
  amount,
  cards,
  winningIndex,
  pokerResults,
  previousWinningCard,
) {
  const winningCard = cards[winningIndex];
  const payoutMultiplier = getPayoutMultiplier(betType, betKey);

  if (betType === "color") {
    if (winningCard.suit && betKey === cardColor(winningCard)) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  if (betType === "suit") {
    if (winningCard.suit === betKey) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  if (betType === "number") {
    if (winningCard.suit && NUMBER_RANKS.has(winningCard.rank)) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  if (betType === "face") {
    if (winningCard.suit && FACE_RANKS.has(winningCard.rank)) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  if (betType === "high_low_seven") {
    if (!winningCard.suit) {
      return { type: "push" };
    }
    const value = RANK_ORDER[winningCard.rank];
    if (value === 7) {
      return { type: "push" };
    }
    const comparison = value > 7 ? "higher" : "lower";
    if (comparison === betKey) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  if (betType === "high_low_previous") {
    if (!previousWinningCard || !previousWinningCard.suit) {
      return { type: "push" };
    }
    if (!winningCard.suit) {
      return { type: "push" };
    }
    const winningValue = RANK_ORDER[winningCard.rank];
    const previousValue = RANK_ORDER[previousWinningCard.rank];
    if (!winningValue || !previousValue) {
      return { type: "push" };
    }
    if (winningValue === previousValue) {
      if (highLowPreviousState.tiesWin[betKey]) {
        return { type: "win", profit: amount * payoutMultiplier };
      }
      return { type: "push" };
    }
    const comparison = winningValue > previousValue ? "higher" : "lower";
    if (comparison === betKey) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  if (betType === "rank_exact") {
    if (!winningCard.suit) {
      return { type: "loss" };
    }
    if (winningCard.rank === betKey) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  if (
    [
      "pair",
      "two_pair",
      "drill",
      "straight",
      "flush",
      "full_house",
      "poker",
      "straight_flush",
      "royal_flush",
    ].includes(betType)
  ) {
    if (pokerResults[betType]) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  if (betType === "joker") {
    if (!winningCard.suit) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  return { type: "loss" };
}

function formatCountWithPercent(count) {
  const percent = stats.rounds ? (count / stats.rounds) * 100 : 0;
  return `${count} (${percent.toFixed(1)}%)`;
}

function determineLeader(counts, labels) {
  let max = 0;
  Object.values(counts).forEach((value) => {
    if (value > max) max = value;
  });
  if (max === 0) {
    return t("stats.none");
  }
  const leaders = Object.entries(counts)
    .filter(([, value]) => value === max)
    .map(([key]) => labels[key] ?? key);
  if (leaders.length === 1) {
    return leaders[0];
  }
  return t("stats.shared", { items: leaders.join(", ") });
}

function updatePieChart(element, segments, palette) {
  if (!element) return;
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value || 0), 0);
  if (!total) {
    element.dataset.empty = "true";
    element.style.removeProperty("--pie-gradient");
    return;
  }
  let cumulative = 0;
  const stops = segments
    .map(({ key, value }) => {
      const amount = Math.max(0, value || 0);
      if (!amount) return null;
      const start = (cumulative / total) * 360;
      cumulative += amount;
      const end = (cumulative / total) * 360;
      const color = palette[key] || palette.default || "#ffffff";
      return `${color} ${start}deg ${end}deg`;
    })
    .filter(Boolean);
  if (!stops.length) {
    element.dataset.empty = "true";
    element.style.removeProperty("--pie-gradient");
    return;
  }
  element.dataset.empty = "false";
  element.style.setProperty("--pie-gradient", `conic-gradient(${stops.join(", ")})`);
}

function updateStatsDisplay() {
  statsRoundsEl.textContent = stats.rounds.toString();
  statsColorRedEl.textContent = formatCountWithPercent(stats.colors.red);
  statsColorBlackEl.textContent = formatCountWithPercent(stats.colors.black);
  statsColorJokerEl.textContent = formatCountWithPercent(stats.colors.joker);
  updatePieChart(
    statsColorChartEl,
    [
      { key: "red", value: stats.colors.red },
      { key: "black", value: stats.colors.black },
      { key: "joker", value: stats.colors.joker },
    ],
    PIE_COLORS.colors,
  );
  statsSuitHeartsEl.textContent = formatCountWithPercent(stats.suits.hearts);
  statsSuitDiamondsEl.textContent = formatCountWithPercent(stats.suits.diamonds);
  statsSuitClubsEl.textContent = formatCountWithPercent(stats.suits.clubs);
  statsSuitSpadesEl.textContent = formatCountWithPercent(stats.suits.spades);
  statsSuitJokerEl.textContent = formatCountWithPercent(stats.suits.joker);
  updatePieChart(
    statsSuitChartEl,
    [
      { key: "hearts", value: stats.suits.hearts },
      { key: "diamonds", value: stats.suits.diamonds },
      { key: "clubs", value: stats.suits.clubs },
      { key: "spades", value: stats.suits.spades },
      { key: "joker", value: stats.suits.joker },
    ],
    PIE_COLORS.suits,
  );
  statsTypeNumberEl.textContent = formatCountWithPercent(stats.types.number);
  statsTypeFaceEl.textContent = formatCountWithPercent(stats.types.face);
  statsTypeJokerEl.textContent = formatCountWithPercent(stats.types.joker);
  updatePieChart(
    statsTypeChartEl,
    [
      { key: "number", value: stats.types.number },
      { key: "face", value: stats.types.face },
      { key: "joker", value: stats.types.joker },
    ],
    PIE_COLORS.types,
  );

  statsTopColorEl.textContent = determineLeader(stats.colors, {
    red: t("stats.colors.red"),
    black: t("stats.colors.black"),
    joker: t("stats.colors.joker"),
  });
  statsTopSuitEl.textContent = determineLeader(stats.suits, {
    hearts: t("stats.suits.hearts"),
    diamonds: t("stats.suits.diamonds"),
    clubs: t("stats.suits.clubs"),
    spades: t("stats.suits.spades"),
    joker: t("stats.suits.joker"),
  });
  const rankLabels = RANKS_WITH_JOKER.reduce((acc, rank) => {
    acc[rank] = rank === "Joker" ? t("ranks.display.Joker") : rank;
    return acc;
  }, {});
  statsTopRankEl.textContent = determineLeader(stats.ranks, rankLabels);

  renderRankStats();
}

function renderRankStats() {
  statsRanksEl.innerHTML = "";
  const fragment = document.createDocumentFragment();
  RANKS_WITH_JOKER.forEach((rank) => {
    const item = document.createElement("div");
    item.className = "rank-item";
    const title = document.createElement("strong");
    title.textContent = rank === "Joker" ? t("ranks.display.Joker") : rank;
    const value = document.createElement("span");
    value.textContent = formatCountWithPercent(stats.ranks[rank]);
    item.append(title, value);
    fragment.appendChild(item);
  });
  statsRanksEl.appendChild(fragment);
}

function recordWinningCard(card) {
  if (!card) return;
  stats.rounds += 1;
  if (!card.suit) {
    stats.colors.joker += 1;
    stats.suits.joker += 1;
    stats.types.joker += 1;
    stats.ranks.Joker += 1;
    updateStatsDisplay();
    return;
  }

  const colorKey = cardColor(card);
  if (colorKey && stats.colors[colorKey] !== undefined) {
    stats.colors[colorKey] += 1;
  }

  if (stats.suits[card.suit] !== undefined) {
    stats.suits[card.suit] += 1;
  }

  if (FACE_RANKS.has(card.rank)) {
    stats.types.face += 1;
  } else {
    stats.types.number += 1;
  }

  if (stats.ranks[card.rank] !== undefined) {
    stats.ranks[card.rank] += 1;
  }

  updateStatsDisplay();
}

function applyTranslations() {
  const meta = LANGUAGE_META[currentLanguage] || LANGUAGE_META.hu;
  if (meta?.locale) {
    document.documentElement.lang = meta.locale;
  }
  document.title = t("app.title");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (!key) return;
    el.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.dataset.i18nHtml;
    if (!key) return;
    el.innerHTML = t(key);
  });

  document
    .querySelectorAll("[data-i18n-attr-aria-label]")
    .forEach((el) => {
      const key = el.dataset.i18nAttrAriaLabel;
      if (!key) return;
      el.setAttribute("aria-label", t(key));
    });

  document
    .querySelectorAll("[data-i18n-attr-title]")
    .forEach((el) => {
      const key = el.dataset.i18nAttrTitle;
      if (!key) return;
      el.setAttribute("title", t(key));
    });

  document
    .querySelectorAll("option[data-i18n-option]")
    .forEach((option) => {
      const langKey = option.dataset.i18nOption;
      option.textContent = t(`language.option.${langKey}`);
    });

  if (dealButton) {
    dealButton.textContent = t(dealButtonLabelKey);
  }
  if (diceValueEl) {
    diceValueEl.textContent = t(diceValueState.key, diceValueState.params);
  }

  updateDisplays();
  updateChipButtonLabels(currentLanguage);
  refreshDisplayedBets();
  updateHighLowPreviousDisplay();
  updateStatsDisplay();
  renderBetBreakdownState();
  renderLog();
  renderDiceHistory();
  renderFullHistory();
  updateWinningCardHints();
  updateResultsSummaryDisplay();
  updateAudioUI();
  updateBetToolAvailability();
  applyAutoConfigToInputs();
  updateStakingStatus();
}

function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    lang = "hu";
  }
  currentLanguage = lang;
  if (languageSelect && languageSelect.value !== lang) {
    languageSelect.value = lang;
  }
  updateSettings({ language: currentLanguage });
  applyTranslations();
}

applyHighLowPreviousReference(null);
updateDisplays();
resetLog();
resetCards();
resetDice({ immediate: true });
renderBetBreakdownState();
renderDiceHistory();
renderFullHistory();
setDealButtonLabel("actions.deal");
updateHighLowPreviousDisplay();
updateBetToolAvailability();
if (languageSelect) {
  languageSelect.value = currentLanguage;
  languageSelect.addEventListener("change", (event) => {
    setLanguage(event.target.value);
  });
}
applyAutoConfigToInputs();
setStakingMode(currentStakingMode);
applyDiceTheme();
applyDiceMode();
applyAppearanceClasses();
applyTranslations();
