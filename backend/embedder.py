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
