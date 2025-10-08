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

const bankrollDisplay = document.getElementById("bankroll-display");
const betTotalDisplay = document.getElementById("bet-total-display");
const logList = document.getElementById("log");
const cardsContainer = document.getElementById("cards-container");
const diceResultEl = document.getElementById("dice-result");
const dealButton = document.getElementById("deal-button");
const clearAllButton = document.getElementById("clear-all");
const chipButtons = Array.from(document.querySelectorAll(".chip"));
const betSpots = Array.from(document.querySelectorAll(".bet-spot"));

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
  return bankroll - currentBetTotal;
}

function formatCurrency(value) {
  return `${value.toFixed(2)} kredit`;
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
  const newAmount = currentAmount + selectedChip;
  currentBets.set(key, newAmount);
  currentBetTotal += selectedChip;
  spot.classList.add("has-bet");
  spot.querySelector(".bet-amount").textContent = formatCurrency(newAmount);
  updateDisplays();
}

function clearSpot(spot) {
  if (roundLocked) return;
  const key = spotKey(spot);
  const currentAmount = currentBets.get(key);
  if (!currentAmount) return;
  currentBetTotal -= currentAmount;
  currentBets.delete(key);
  spot.classList.remove("has-bet");
  spot.querySelector(".bet-amount").textContent = "";
  updateDisplays();
}

function clearAllBets() {
  if (roundLocked) return;
  currentBetTotal = 0;
  currentBets.clear();
  betSpots.forEach((spot) => {
    spot.classList.remove("has-bet");
    const amountEl = spot.querySelector(".bet-amount");
    if (amountEl) amountEl.textContent = "";
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
  bankroll -= totalWager;
  currentBetTotal = 0;

  if (dieResult === 6) {
    bankroll += totalWager;
    addLog("A dobókocka hatost mutatott: minden tét visszajár.");
    updateDisplays();
    return;
  }

  const winningIndex = dieResult - 1;
  const winningCard = cards[winningIndex];
  addLog(`Nyerő lap: #${dieResult} – ${describeCard(winningCard)}.`);
  const pokerResults = evaluatePokerCombinations(cards);

  let winnings = 0;

  betEntries.forEach(([key, amount]) => {
    const [betType, betKey] = key.split(":");
    const outcome = resolveBet(betType, betKey, amount, cards, winningIndex, pokerResults);
    if (outcome.type === "win") {
      winnings += amount + outcome.profit;
      addLog(`✔ ${describeBet(betType, betKey)} nyert! Nyereség: ${outcome.profit.toFixed(2)} kredit.`);
    } else if (outcome.type === "push") {
      winnings += amount;
      addLog(`↺ ${describeBet(betType, betKey)} push. A tét visszajár.`);
    } else {
      addLog(`✖ ${describeBet(betType, betKey)} veszített.`);
    }
  });

  bankroll += winnings;
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
    const cardEl = document.createElement("div");
    cardEl.className = `card ${cardColor(card) ?? ""}`.trim();
    const rankEl = document.createElement("div");
    rankEl.className = "rank";
    rankEl.textContent = card.rank;
    const indexEl = document.createElement("div");
    indexEl.className = "index";
    indexEl.textContent = `#${index + 1}`;
    const suitEl = document.createElement("div");
    suitEl.className = "suit";
    suitEl.textContent = cardSuitSymbol(card);
    cardEl.append(indexEl, rankEl, suitEl);
    cardsContainer.appendChild(cardEl);
  });
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

updateDisplays();
resetLog();
resetCards();
