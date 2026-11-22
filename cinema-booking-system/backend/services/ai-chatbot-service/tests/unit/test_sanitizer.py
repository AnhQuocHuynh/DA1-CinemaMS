from app.services.sanitizer import sanitize_output


def test_masks_token_and_card():
    out = sanitize_output("token local-dev-internal-token card 4111 1111 1111 1111")
    assert "local-dev-internal-token" not in out
    assert "4111" not in out

