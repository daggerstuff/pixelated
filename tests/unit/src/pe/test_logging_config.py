from unittest.mock import MagicMock, patch

from src.pe.logging_config import setup_logging


@patch("src.pe.logging_config.logging.getLogger")
@patch("src.pe.logging_config.logging.StreamHandler")
@patch("src.pe.logging_config.structlog.configure")
def test_setup_logging_default_info(mock_configure, mock_stream_handler, mock_get_logger):
    """Test setup_logging configures default logging level to INFO."""
    mock_handler_instance = MagicMock()
    mock_stream_handler.return_value = mock_handler_instance
    mock_root_logger = MagicMock()
    mock_get_logger.return_value = mock_root_logger

    setup_logging()

    # Verify structlog configuration is called
    mock_configure.assert_called_once()

    # Verify handler level is set to INFO
    mock_handler_instance.setLevel.assert_called_once_with("INFO")

    # Verify root logger level is set to INFO
    mock_root_logger.setLevel.assert_any_call("INFO")

    # Verify handler is added to root logger
    mock_root_logger.addHandler.assert_called_once_with(mock_handler_instance)

    # Verify noisy libraries are quieted
    mock_get_logger.assert_any_call("uvicorn.access")
    mock_get_logger.assert_any_call("asyncpg")


@patch("src.pe.logging_config.logging.getLogger")
@patch("src.pe.logging_config.logging.StreamHandler")
@patch("src.pe.logging_config.structlog.configure")
def test_setup_logging_custom_level(mock_configure, mock_stream_handler, mock_get_logger):
    """Test setup_logging configures custom logging level correctly."""
    mock_handler_instance = MagicMock()
    mock_stream_handler.return_value = mock_handler_instance
    mock_root_logger = MagicMock()
    mock_get_logger.return_value = mock_root_logger

    setup_logging(level="DEBUG")

    # Verify structlog configuration is called
    mock_configure.assert_called_once()

    # Verify handler level is set to DEBUG
    mock_handler_instance.setLevel.assert_called_once_with("DEBUG")

    # Verify root logger level is set to DEBUG
    mock_root_logger.setLevel.assert_any_call("DEBUG")
