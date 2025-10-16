const SUITS = ["hearts", "diamonds", "clubs", "spades"];
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const FACE_RANKS = new Set(["J", "Q", "K", "A"]);
const NUMBER_RANKS = new Set(RANKS.filter((rank) => !FACE_RANKS.has(rank)));
const RANK_ORDER = RANKS.reduce((acc, rank, index) => {
  acc[rank] = index + 2;
  return acc;
}, {});

const PAYOUTS = {
  color: 1.0,
  suit: 3.0,
  number: 0.5,
  face: 2.0,
  high_low_seven: 1.0,
  high_low_previous: 1.0,
  pair: 1.0,
  drill: 5.0,
  straight: 10.0,
  flush: 15.0,
  full_house: 20.0,
  poker: 50.0,
  joker: 25.0,
};

let bankroll = 100;
let currentBetTotal = 0;
let selectedChip = null;
let currentBets = new Map();
let roundLocked = false;

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
const RANK_LABELS = RANKS_WITH_JOKER.reduce((acc, rank) => {
  acc[rank] = rank;
  return acc;
}, {});
const SUIT_LABELS = {
  hearts: "♥ Hearts",
  diamonds: "♦ Diamonds",
  clubs: "♣ Clubs",
  spades: "♠ Spades",
  joker: "★ Joker",
};

const bankrollDisplay = document.getElementById("bankroll-display");
const betTotalDisplay = document.getElementById("bet-total-display");
const logList = document.getElementById("log");
const cardsContainer = document.getElementById("cards-container");
const diceResultEl = document.getElementById("dice-result");
const dealButton = document.getElementById("deal-button");
const clearAllButton = document.getElementById("clear-all");
const chipButtons = Array.from(document.querySelectorAll(".chip"));
const betSpots = Array.from(document.querySelectorAll(".bet-spot"));
const statsRoundsEl = document.getElementById("stats-rounds");
const statsTopColorEl = document.getElementById("stats-top-color");
const statsTopSuitEl = document.getElementById("stats-top-suit");
const statsTopRankEl = document.getElementById("stats-top-rank");
const statsColorRedEl = document.getElementById("stats-color-red");
const statsColorBlackEl = document.getElementById("stats-color-black");
const statsColorJokerEl = document.getElementById("stats-color-joker");
const statsSuitHeartsEl = document.getElementById("stats-suit-hearts");
const statsSuitDiamondsEl = document.getElementById("stats-suit-diamonds");
const statsSuitClubsEl = document.getElementById("stats-suit-clubs");
const statsSuitSpadesEl = document.getElementById("stats-suit-spades");
const statsSuitJokerEl = document.getElementById("stats-suit-joker");
const statsTypeNumberEl = document.getElementById("stats-type-number");
const statsTypeFaceEl = document.getElementById("stats-type-face");
const statsTypeJokerEl = document.getElementById("stats-type-joker");
const statsRanksEl = document.getElementById("stats-ranks");

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

function roundCurrency(value) {
  return Math.round(value * 100) / 100;
}

function updateDisplays() {
  bankrollDisplay.textContent = bankroll.toFixed(2);
  betTotalDisplay.textContent = currentBetTotal.toFixed(2);
}

function addLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  logList.prepend(item);
}

function resetLog() {
  logList.innerHTML = "";
}

function resetCards() {
  cardsContainer.innerHTML = "";
  diceResultEl.textContent = "";
}

function selectChip(button) {
  chipButtons.forEach((chip) => chip.classList.remove("active"));
  if (button) {
    button.classList.add("active");
    selectedChip = Number(button.dataset.value);
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

function formatCurrency(value) {
  return `${value.toFixed(2)} kredit`;
}

function formatBetChipLabel(value) {
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
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

function placeBet(spot) {
  if (roundLocked) return;
  if (!selectedChip) {
    addLog("Válassz zsetont a tét elhelyezéséhez.");
    return;
  }
  if (selectedChip > currentAvailable()) {
    addLog("Nincs elegendő egyenleg a kiválasztott zsetonhoz.");
    return;
  }

  const key = spotKey(spot);
  const currentAmount = currentBets.get(key) || 0;
  const newAmount = roundCurrency(currentAmount + selectedChip);
  currentBets.set(key, newAmount);
  currentBetTotal = roundCurrency(currentBetTotal + selectedChip);
  renderBetAmount(spot, newAmount);
  updateDisplays();
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
}

function clearAllBets() {
  if (roundLocked) return;
  currentBetTotal = 0;
  currentBets.clear();
  betSpots.forEach((spot) => {
    renderBetAmount(spot, 0);
  });
  updateDisplays();
}

function spotKey(spot) {
  const type = spot.dataset.betType;
  const key = spot.dataset.betKey;
  return `${type}:${key}`;
}

betSpots.forEach((spot) => {
  const button = spot.querySelector("button");
  const clearButton = spot.querySelector(".clear-spot");
  if (button) {
    button.addEventListener("click", () => placeBet(spot));
  }
  if (clearButton) {
    clearButton.addEventListener("click", (event) => {
      event.stopPropagation();
      clearSpot(spot);
    });
  }
});

clearAllButton.addEventListener("click", clearAllBets);

dealButton.addEventListener("click", () => {
  if (roundLocked) {
    prepareNextRound();
    return;
  }
  if (currentBetTotal <= 0) {
    addLog("Tét nélkül nem indulhat a kör.");
    return;
  }
  if (currentBetTotal > bankroll) {
    addLog("A tét nagyobb, mint a rendelkezésre álló egyenleg.");
    return;
  }
  startRound();
});

function prepareNextRound() {
  roundLocked = false;
  dealButton.textContent = "Osztás";
  resetCards();
  resetLog();
  clearAllBets();
  updateDisplays();
}

function startRound() {
  roundLocked = true;
  dealButton.textContent = "Következő kör";
  const deck = buildDeck();
  shuffleDeck(deck);
  const cards = dealCards(deck, 5);
  displayCards(cards);
  const dieResult = rollDie();
  displayDie(dieResult);
  const betEntries = Array.from(currentBets.entries());
  const totalWager = currentBetTotal;
  bankroll = roundCurrency(bankroll - totalWager);
  currentBetTotal = 0;

  if (dieResult === 6) {
    bankroll = roundCurrency(bankroll + totalWager);
    addLog("A dobókocka hatost mutatott: minden tét visszajár.");
    updateDisplays();
    return;
  }

  const winningIndex = dieResult - 1;
  const winningCard = cards[winningIndex];
  addLog(`Nyerő lap: #${dieResult} – ${describeCard(winningCard)}.`);
  recordWinningCard(winningCard);
  const pokerResults = evaluatePokerCombinations(cards);

  let winnings = 0;

  betEntries.forEach(([key, amount]) => {
    const [betType, betKey] = key.split(":");
    const outcome = resolveBet(betType, betKey, amount, cards, winningIndex, pokerResults);
    if (outcome.type === "win") {
      winnings = roundCurrency(winnings + amount + outcome.profit);
      addLog(`✔ ${describeBet(betType, betKey)} nyert! Nyereség: ${outcome.profit.toFixed(2)} kredit.`);
    } else if (outcome.type === "push") {
      winnings = roundCurrency(winnings + amount);
      addLog(`↺ ${describeBet(betType, betKey)} push. A tét visszajár.`);
    } else {
      addLog(`✖ ${describeBet(betType, betKey)} veszített.`);
    }
  });

  bankroll = roundCurrency(bankroll + winnings);
  currentBets = new Map();
  updateDisplays();
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

function displayCards(cards) {
  resetCards();
  cards.forEach((card, index) => {
    const cardEl = buildCardElement(card, index);
    cardsContainer.appendChild(cardEl);
    requestAnimationFrame(() => {
      setTimeout(() => {
        cardEl.classList.remove("card--face-down");
        cardEl.classList.add("card--revealed");
        setTimeout(() => {
          cardEl.classList.remove("card--revealed");
        }, 800);
      }, 250 + index * 400);
    });
  });
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

  const inner = document.createElement("div");
  inner.className = "card__inner";

  const front = buildCardFront(card, index);
  const back = buildCardBack();

  inner.append(front, back);
  cardEl.appendChild(inner);
  return cardEl;
}

function buildCardFront(card, index) {
  const front = document.createElement("div");
  front.className = "card__face card__face--front";

  const indexBadge = document.createElement("div");
  indexBadge.className = "card__index";
  indexBadge.textContent = `#${index + 1}`;

  const layout = document.createElement("div");
  layout.className = "card__layout";

  const topCorner = buildCardCorner(card, "top");
  const centerFace = buildCardCenter(card);
  const bottomCorner = buildCardCorner(card, "bottom");

  layout.append(topCorner, centerFace, bottomCorner);
  front.append(indexBadge, layout);
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
  diceResultEl.textContent = `Dobás eredménye: ${result}`;
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
  if (!card.suit) return "Joker";
  return `${card.rank} ${cardSuitSymbol(card)}`;
}

function describeBet(type, key) {
  const lookup = {
    "color:red": "Piros",
    "color:black": "Fekete",
    "suit:hearts": "Hearts",
    "suit:diamonds": "Diamonds",
    "suit:clubs": "Clubs",
    "suit:spades": "Spades",
    "number:number": "Szám (2-10)",
    "face:face": "Betű (J-A)",
    "high_low_seven:higher": "7-nél magasabb",
    "high_low_seven:lower": "7-nél alacsonyabb",
    "high_low_previous:higher": "Előzőnél magasabb",
    "high_low_previous:lower": "Előzőnél alacsonyabb",
    "pair:pair": "Pár",
    "drill:drill": "Drill",
    "straight:straight": "Sor",
    "flush:flush": "Flush",
    "full_house:full_house": "Full House",
    "poker:poker": "Póker",
    "joker:joker": "Joker",
  };
  return lookup[`${type}:${key}`] ?? `${type} (${key})`;
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
  const hasThree = counts.includes(3);
  const hasFour = counts.includes(4);
  const hasFullHouse = hasThree && hasPair;
  const hasFlush = suits.length === 5 && new Set(suits).size === 1;

  let hasStraight = false;
  const nonJoker = cards.filter((card) => card.suit);
  if (nonJoker.length === 5) {
    const ordered = nonJoker
      .map((card) => RANK_ORDER[card.rank])
      .sort((a, b) => a - b);
    hasStraight = ordered.every((value, idx) => {
      if (idx === 0) return true;
      return value - ordered[idx - 1] === 1;
    });
  }

  return {
    pair: hasPair,
    drill: hasThree,
    straight: hasStraight,
    flush: hasFlush,
    full_house: hasFullHouse,
    poker: hasFour,
  };
}

function resolveBet(betType, betKey, amount, cards, winningIndex, pokerResults) {
  const winningCard = cards[winningIndex];
  const payoutMultiplier = PAYOUTS[betType];

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
    if (winningIndex === 0) {
      return { type: "push" };
    }
    const previousCard = cards[winningIndex - 1];
    if (!winningCard.suit || !previousCard.suit) {
      return { type: "push" };
    }
    const winningValue = RANK_ORDER[winningCard.rank];
    const previousValue = RANK_ORDER[previousCard.rank];
    if (winningValue === previousValue) {
      return { type: "push" };
    }
    const comparison = winningValue > previousValue ? "higher" : "lower";
    if (comparison === betKey) {
      return { type: "win", profit: amount * payoutMultiplier };
    }
    return { type: "loss" };
  }

  if (["pair", "drill", "straight", "flush", "full_house", "poker"].includes(betType)) {
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
    return "-";
  }
  const leaders = Object.entries(counts)
    .filter(([, value]) => value === max)
    .map(([key]) => labels[key] ?? key);
  return leaders.length === 1 ? leaders[0] : `Megosztott (${leaders.join(", ")})`;
}

function updateStatsDisplay() {
  statsRoundsEl.textContent = stats.rounds.toString();
  statsColorRedEl.textContent = formatCountWithPercent(stats.colors.red);
  statsColorBlackEl.textContent = formatCountWithPercent(stats.colors.black);
  statsColorJokerEl.textContent = formatCountWithPercent(stats.colors.joker);
  statsSuitHeartsEl.textContent = formatCountWithPercent(stats.suits.hearts);
  statsSuitDiamondsEl.textContent = formatCountWithPercent(stats.suits.diamonds);
  statsSuitClubsEl.textContent = formatCountWithPercent(stats.suits.clubs);
  statsSuitSpadesEl.textContent = formatCountWithPercent(stats.suits.spades);
  statsSuitJokerEl.textContent = formatCountWithPercent(stats.suits.joker);
  statsTypeNumberEl.textContent = formatCountWithPercent(stats.types.number);
  statsTypeFaceEl.textContent = formatCountWithPercent(stats.types.face);
  statsTypeJokerEl.textContent = formatCountWithPercent(stats.types.joker);

  statsTopColorEl.textContent = determineLeader(stats.colors, {
    red: "Piros",
    black: "Fekete",
    joker: "Joker",
  });
  statsTopSuitEl.textContent = determineLeader(stats.suits, SUIT_LABELS);
  statsTopRankEl.textContent = determineLeader(stats.ranks, RANK_LABELS);

  renderRankStats();
}

function renderRankStats() {
  statsRanksEl.innerHTML = "";
  const fragment = document.createDocumentFragment();
  RANKS_WITH_JOKER.forEach((rank) => {
    const item = document.createElement("div");
    item.className = "rank-item";
    const title = document.createElement("strong");
    title.textContent = rank;
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

updateDisplays();
resetLog();
resetCards();
updateStatsDisplay();
