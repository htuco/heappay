import cohere


class EmbeddingService:
    _MODEL = "embed-multilingual-light-v3.0"

    def __init__(self, api_key: str) -> None:
        self._client = cohere.ClientV2(api_key)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        response = self._client.embed(
            texts=texts,
            model=self._MODEL,
            input_type="search_document",
            embedding_types=["float"],
        )
        return response.embeddings.float_

    def embed_query(self, text: str) -> list[float]:
        response = self._client.embed(
            texts=[text],
            model=self._MODEL,
            input_type="search_query",
            embedding_types=["float"],
        )
        return response.embeddings.float_[0]
