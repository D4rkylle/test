"""Simple command-line implementation of the custom card betting game.

The game follows the rules described in the prompt:
- A 52-card French deck with two jokers is shuffled.
- Five cards are revealed.
- A six-sided die selects which of the five cards resolves the per-card bets.
  Rolling a six results in a push for every player.

The script supports a single player with an adjustable bankroll who can place
multiple bets per round.
"""
from __future__ import annotations

import random
from collections import Counter
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


SUITS = ["hearts", "diamonds", "clubs", "spades"]
RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
FACE_RANKS = {"J", "Q", "K", "A"}
NUMBER_RANKS = set(RANKS) - FACE_RANKS
RANK_ORDER = {rank: index for index, rank in enumerate(RANKS, start=2)}


@dataclass(frozen=True)
class Card:
    """Representation of a playing card."""

    rank: str
    suit: Optional[str]

    @property
    def is_joker(self) -> bool:
        return self.suit is None

    @property
    def color(self) -> Optional[str]:
        if self.is_joker:
            return None
        return "red" if self.suit in {"hearts", "diamonds"} else "black"

    @property
    def is_number(self) -> bool:
        return self.rank in NUMBER_RANKS

    @property
    def is_face(self) -> bool:
        return self.rank in FACE_RANKS

    def description(self) -> str:
        if self.is_joker:
            return "Joker"
        return f"{self.rank.capitalize()} of {self.suit.capitalize()}"


def build_deck() -> List[Card]:
    deck = [Card(rank=rank, suit=suit) for suit in SUITS for rank in RANKS]
    deck.extend([Card(rank="Joker", suit=None), Card(rank="Joker", suit=None)])
    return deck


def roll_die() -> int:
    return random.randint(1, 6)


def shuffle_deck(deck: List[Card]) -> None:
    random.shuffle(deck)


def deal_cards(deck: List[Card], count: int = 5) -> List[Card]:
    return [deck.pop() for _ in range(count)]


def evaluate_poker_combinations(cards: List[Card]) -> Dict[str, bool]:
    """Return a dictionary indicating which poker combinations are present.

    Jokers are treated as unique ranks and do not act as wild cards in this
    simplified interpretation.
    """

    ranks = [card.rank for card in cards]
    suits = [card.suit for card in cards if card.suit is not None]
    rank_counter = Counter(ranks)

    # Pair, drill, poker
    counts = sorted(rank_counter.values(), reverse=True)
    has_pair = 2 in counts
    has_three = 3 in counts
    has_four = 4 in counts

    # Full house
    has_full_house = has_three and has_pair

    # Flush (ignore jokers)
    has_flush = len(suits) == 5 and len(set(suits)) == 1

    # Straight (only if all cards are non-jokers and sequential)
    non_joker_cards = [card for card in cards if not card.is_joker]
    has_straight = False
    if len(non_joker_cards) == 5:
        ordered = sorted(RANK_ORDER[card.rank] for card in non_joker_cards)
        has_straight = all(b - a == 1 for a, b in zip(ordered, ordered[1:]))

    return {
        "pair": has_pair,
        "drill": has_three,
        "straight": has_straight,
        "flush": has_flush,
        "full_house": has_full_house,
        "poker": has_four,
    }


PAYOUTS = {
    "color": 1.0,
    "suit": 3.0,
    "number": 0.5,  # 1:2 payout -> player receives half of wager as profit
    "face": 2.0,
    "high_low_seven": 1.0,
    "high_low_previous": 1.0,
    "pair": 1.0,
    "drill": 5.0,
    "straight": 10.0,
    "flush": 15.0,
    "full_house": 20.0,
    "poker": 50.0,
    "joker": 25.0,
}


Bet = Tuple[str, str, float]


def prompt_float(prompt: str, minimum: float = 0.0) -> float:
    while True:
        raw = input(prompt).strip()
        try:
            value = float(raw)
        except ValueError:
            print("Please enter a valid number.")
            continue
        if value < minimum:
            print(f"Please enter a value >= {minimum}.")
            continue
        return value


def prompt_choice(prompt: str, choices: List[str]) -> str:
    lower_choices = {choice.lower(): choice for choice in choices}
    while True:
        raw = input(prompt).strip().lower()
        if raw in lower_choices:
            return lower_choices[raw]
        print(f"Please choose from: {', '.join(choices)}")


def display_cards(cards: List[Card]) -> None:
    print("\nRevealed cards:")
    for index, card in enumerate(cards, start=1):
        print(f"  {index}. {card.description()}")


def collect_bets(bankroll: float) -> Tuple[List[Bet], float]:
    bets: List[Bet] = []
    remaining = bankroll
    print(f"\nYou have {remaining:.2f} credits available.")

    while remaining > 0:
        place = prompt_choice("Place a bet? (yes/no): ", ["yes", "no"])
        if place.lower() == "no":
            break

        print("\nBet types:")
        print("  1) Color (red/black)")
        print("  2) Suit (hearts, diamonds, clubs, spades)")
        print("  3) Rank type (number or face)")
        print("  4) Higher or lower than 7")
        print("  5) Higher or lower than previous card")
        print("  6) Poker combinations (pair, drill, straight, flush, full_house, poker)")
        print("  7) Joker")

        bet_type = prompt_choice("Select a bet type (1-7): ", list("1234567"))

        if bet_type == "1":
            option = prompt_choice("Choose color (red/black): ", ["red", "black"])
            internal_type = "color"
            internal_key = option
        elif bet_type == "2":
            option = prompt_choice("Choose suit (hearts/diamonds/clubs/spades): ", SUITS)
            internal_type = "suit"
            internal_key = option
        elif bet_type == "3":
            option = prompt_choice("Choose rank type (number/face): ", ["number", "face"])
            internal_type = option
            internal_key = option
        elif bet_type == "4":
            option = prompt_choice("Bet on (higher/lower) than 7: ", ["higher", "lower"])
            internal_type = "high_low_seven"
            internal_key = option
        elif bet_type == "5":
            option = prompt_choice("Bet on (higher/lower) than previous card: ", ["higher", "lower"])
            internal_type = "high_low_previous"
            internal_key = option
        elif bet_type == "6":
            option = prompt_choice(
                "Choose poker combo (pair/drill/straight/flush/full_house/poker): ",
                ["pair", "drill", "straight", "flush", "full_house", "poker"],
            )
            internal_type = option
            internal_key = option
        else:
            internal_type = "joker"
            internal_key = "joker"

        max_bet = remaining
        amount = prompt_float(f"Enter wager (max {max_bet:.2f}): ", minimum=0.01)
        if amount > remaining:
            print("Insufficient funds for that wager. Try again.")
            continue
        bets.append((internal_type, internal_key, amount))
        remaining -= amount
        print(f"Bet placed on {internal_key} for {amount:.2f}. Remaining bankroll: {remaining:.2f}")

    return bets, remaining


def resolve_bets(
    bets: List[Bet],
    cards: List[Card],
    die_result: int,
    bankroll_after_bets: float,
    total_wager: float,
) -> float:
    if die_result == 6:
        print("\nDealer rolled a six. All bets push; wagers are returned.")
        return bankroll_after_bets + total_wager

    winning_index = die_result - 1
    winning_card = cards[winning_index]
    print(f"\nWinning card is #{die_result}: {winning_card.description()}")

    poker_results = evaluate_poker_combinations(cards)
    winnings = bankroll_after_bets

    for bet_type, bet_key, amount in bets:
        won = False
        payout_multiplier = PAYOUTS[bet_type]

        if bet_type == "color":
            if winning_card.color == bet_key:
                won = True
        elif bet_type == "suit":
            if winning_card.suit == bet_key:
                won = True
        elif bet_type == "number":
            if winning_card.is_number:
                won = True
        elif bet_type == "face":
            if winning_card.is_face:
                won = True
        elif bet_type == "high_low_seven":
            if winning_card.is_joker:
                winnings += amount
                print(" - Joker drawn; higher/lower than 7 bet pushes. Wager returned.")
                continue
            comparison = "higher" if RANK_ORDER[winning_card.rank] > 7 else "lower"
            if RANK_ORDER[winning_card.rank] == 7:
                comparison = "push"
            if bet_key == comparison:
                won = True
            elif comparison == "push":
                winnings += amount
                print(f" - Bet on higher/lower than 7 pushes (card is a 7). Wager {amount:.2f} returned.")
                continue
        elif bet_type == "high_low_previous":
            if winning_index == 0:
                winnings += amount
                print(" - No previous card; bet pushes. Wager returned.")
                continue
            previous_card = cards[winning_index - 1]
            if winning_card.is_joker or previous_card.is_joker:
                winnings += amount
                print(" - Comparison involves a joker; bet pushes. Wager returned.")
                continue
            else:
                comparison = "higher" if RANK_ORDER[winning_card.rank] > RANK_ORDER[previous_card.rank] else "lower"
                if RANK_ORDER[winning_card.rank] == RANK_ORDER[previous_card.rank]:
                    winnings += amount
                    print(" - Cards equal; higher/lower bet pushes. Wager returned.")
                    continue
                if bet_key == comparison:
                    won = True
        elif bet_type in {"pair", "drill", "straight", "flush", "full_house", "poker"}:
            if poker_results[bet_type]:
                won = True
        elif bet_type == "joker":
            if winning_card.is_joker:
                won = True

        if won:
            gain = amount * payout_multiplier
            winnings += amount + gain
            print(f" - Bet on {bet_key} wins! Profit: {gain:.2f}")
        else:
            print(f" - Bet on {bet_key} loses.")

    return winnings


def play_game() -> None:
    print("Welcome to the Card Betting Game!\n")
    bankroll = 100.0

    while True:
        print("=" * 60)
        print(f"Current bankroll: {bankroll:.2f}")
        deck = build_deck()
        shuffle_deck(deck)
        cards = deal_cards(deck, 5)

        bets, remaining = collect_bets(bankroll)
        bankroll = remaining

        if not bets:
            print("No bets placed. Ending game.")
            break

        display_cards(cards)
        die_result = roll_die()
        print(f"\nDealer rolls the die... result: {die_result}")

        total_wager = sum(amount for *_, amount in bets)
        bankroll = resolve_bets(bets, cards, die_result, bankroll, total_wager)
        print(f"Updated bankroll: {bankroll:.2f}")

        if bankroll <= 0:
            print("You have run out of funds. Game over!")
            break

        continue_playing = prompt_choice("Play another round? (yes/no): ", ["yes", "no"])
        if continue_playing.lower() == "no":
            print("Thanks for playing!")
            break


if __name__ == "__main__":
    random.seed()
    play_game()
