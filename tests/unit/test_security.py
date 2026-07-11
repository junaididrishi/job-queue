import pytest
from app.core.security import hash_password, verify_password, create_access_token, decode_token


def test_password_hash_and_verify():
    password = "supersecret123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_create_and_decode_token():
    data = {"sub": "user-123", "email": "test@example.com"}
    token = create_access_token(data)
    assert isinstance(token, str)
    decoded = decode_token(token)
    assert decoded["sub"] == "user-123"
    assert decoded["email"] == "test@example.com"


def test_token_has_expiry():
    token = create_access_token({"sub": "user-456"})
    decoded = decode_token(token)
    assert "exp" in decoded
