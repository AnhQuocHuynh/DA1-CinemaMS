from app.services.answer_guard import (
    clip_snippet,
    fold,
    guard_answer,
    has_letter_or_digit,
    mentions_foreign_title,
    strip_emoji,
)

REFUSAL = "Sorry, I can only share movies from the current context."


def test_fold_vietnamese_and_whitespace():
    assert fold("  Tình   Người\tDuyên\nMa  ") == "tinh nguoi duyen ma"
    assert fold("Đào, Phở và Piano") == "dao, pho va piano"
    assert fold(None) == ""
    assert fold("   ") == ""


def test_has_letter_or_digit():
    assert has_letter_or_digit("Dune") is True
    assert has_letter_or_digit("1917") is True
    assert has_letter_or_digit("...") is False
    assert has_letter_or_digit("   ") is False
    assert has_letter_or_digit("") is False
    assert has_letter_or_digit(None) is False


def test_strip_emoji_removes_emoji_and_modifiers():
    assert strip_emoji("  Now showing Avatar 🎬🔥☀️  ") == "Now showing Avatar"
    assert strip_emoji("Family 👨‍👩‍👧‍👦 movie ❤️") == "Family  movie"
    assert strip_emoji("🎬\u200d🔥\ufe0f   ") == ""
    assert strip_emoji(None) == ""


def test_clip_snippet_behaviors():
    assert clip_snippet("  short text  ", 20) == "short text"
    assert clip_snippet("line one\nline two\nline three", 19) == "line one\nline two"
    assert clip_snippet("ab\ncdefghijklmnop", 10) == "ab\ncdefghi"
    assert clip_snippet("hello world   extra", 12) == "hello world"
    assert clip_snippet("   ", 10) == ""
    assert clip_snippet("", 10) == ""
    assert clip_snippet(None, 10) == ""
    assert clip_snippet("hello", 0) == ""
    assert clip_snippet("hello", -5) == ""


def test_allowed_title_passes_and_strips_emoji():
    allowed = "Now showing: Avatar: The Way of Water at 19:30."
    catalog = ["Avatar: The Way of Water", "Dune", "Oppenheimer"]
    result = guard_answer(
        "  You can watch Avatar: The Way of Water at 19:30 🍿  ",
        allowed,
        catalog,
        REFUSAL,
    )
    assert result == "You can watch Avatar: The Way of Water at 19:30"


def test_short_titles_under_four_alnum_chars_ignored():
    allowed = "Showing: Dune"
    catalog = ["It", "Up", "A.I.", "Dune"]
    assert mentions_foreign_title("It is up for you to enjoy A.I. and Dune.", allowed, catalog) is False


def test_vietnamese_accent_folding_matches_allowed_and_foreign():
    catalog = ["Tình Người Duyên Ma", "Đào, Phở và Piano"]
    assert (
        mentions_foreign_title(
            "Ban co the xem tinh nguoi duyen ma toi nay.",
            "Lich chieu: Tình Người Duyên Ma luc 20:00",
            catalog,
        )
        is False
    )
    assert (
        mentions_foreign_title(
            "Ban co the xem dao, pho va piano toi nay.",
            "Lich chieu: Tình Người Duyên Ma luc 20:00",
            catalog,
        )
        is True
    )


def test_longer_allowed_title_does_not_trigger_shorter_catalog_title():
    allowed = "Showing tonight: Avatar: The Way of Water."
    catalog = ["Avatar", "Avatar: The Way of Water"]
    assert (
        mentions_foreign_title(
            "Avatar: The Way of Water is playing tonight.",
            allowed,
            catalog,
        )
        is False
    )


def test_shorter_allowed_title_still_flags_longer_foreign_sequel():
    allowed = "Showing tonight: Avatar."
    catalog = ["Avatar", "Avatar: The Way of Water"]
    assert (
        mentions_foreign_title(
            "You can watch Avatar: The Way of Water tonight.",
            allowed,
            catalog,
        )
        is True
    )


def test_word_boundary_prevents_partial_word_match():
    allowed = "Cinema in Dunedin."
    catalog = ["Dune"]
    assert (
        mentions_foreign_title(
            "Visit our cinema in Dunedin for great movies.",
            allowed,
            catalog,
        )
        is False
    )


def test_guard_answer_refuses_foreign_title_and_blank_after_strip():
    allowed = "Showing: Dune at 18:00."
    catalog = ["Dune", "Interstellar"]
    assert (
        guard_answer("How about Interstellar at 20:00? 🎬", allowed, catalog, REFUSAL)
        == REFUSAL
    )
    assert guard_answer("🎬🔥   ✨", allowed, catalog, REFUSAL) == REFUSAL
    assert guard_answer("", allowed, catalog, REFUSAL) == REFUSAL
    assert guard_answer(None, allowed, catalog, REFUSAL) == REFUSAL
