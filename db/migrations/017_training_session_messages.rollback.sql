DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM training_session_messages) THEN
    RAISE EXCEPTION 'Refusing to drop training_session_messages while records exist';
  END IF;
END
$$;

DROP TABLE IF EXISTS training_session_messages;
