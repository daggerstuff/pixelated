def test_au_frame_parses():
    from src.video_emotion.types import AUFrame

    frame = AUFrame(timestamp_ms=150, au_scores={12: 0.85}, face_bbox=(10, 20, 100, 120))
    assert frame.au_scores[12] == 0.85
