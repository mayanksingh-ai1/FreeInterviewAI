import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    APP_NAME: str = "FreeInterviewAI Local Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    
    # Network & host settings
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000
    
    # Ollama Local Service Configuration
    OLLAMA_BASE_URL: str = Field(
        default="http://127.0.0.1:11434",
        description="Local URL for the Ollama inference engine"
    )
    DEFAULT_MODEL: str = Field(
        default="llama3.2:1b",
        description="Default lightweight model recommended for 8GB RAM laptops (1.3 GB download, ~1.2 GB RAM)"
    )
    
    # Performance & Safety bounds for Intel Core i5 / 8 GB RAM
    REQUEST_TIMEOUT_SECONDS: int = Field(
        default=60,
        description="Timeout for local CPU token generation"
    )
    MAX_TOKENS_LIMIT: int = Field(
        default=1024,
        description="Maximum generation tokens to prevent CPU thread starvation"
    )
    NUM_THREAD_LIMIT: int = Field(
        default=4,
        description="Number of CPU threads to allocate (i5-1135G7 has 4 physical cores)"
    )
    
    # Allow simulated mock fallback if Ollama daemon is offline
    ALLOW_MOCK_FALLBACK: bool = Field(
        default=True,
        description="Return simulated local AI response if Ollama is not yet installed/running"
    )

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
