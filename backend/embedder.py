from sentence_transformers import SentenceTransformer

# Load the model locally
model = SentenceTransformer('all-MiniLM-L6-v2')

def get_embedding(text: str) -> list[float]:
    """Generates a 384-dimensional embedding for the given text."""
    if not text or not text.strip():
        # Return a zero vector if there's no text (384 dimensions)
        return [0.0] * 384
    embedding = model.encode(text)
    return embedding.tolist()

def get_embeddings_batch(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """Generates 384-dimensional embeddings for a batch of texts using PyTorch tensor batching."""
    if not texts:
        return []
    cleaned_texts = [t if (t and t.strip()) else " " for t in texts]
    embeddings = model.encode(cleaned_texts, batch_size=batch_size, show_progress_bar=False)
    return embeddings.tolist()
