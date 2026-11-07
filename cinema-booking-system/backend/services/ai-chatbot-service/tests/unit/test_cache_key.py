from app.services import cache_service


def test_normalizer_produces_same_key():
    assert cache_service.exact_key("What is refund policy?") == cache_service.exact_key("what is refund policy")


def test_bypass_keywords():
    assert cache_service.should_bypass("movies tonight?")
    assert not cache_service.should_bypass("refund policy")

